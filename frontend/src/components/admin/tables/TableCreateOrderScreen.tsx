"use client";

import React, { useEffect, useState } from "react";
import { X, ArrowLeft, Search, Plus, Minus, Trash2 } from "lucide-react";
import { adminColors, Badge } from "@/components/admin/ui";
import {
  fetchAdminMenuItems,
  fetchAdminCategories,
  createAdminOrder,
  type AdminMenuItem,
  type AdminCategory,
} from "@/lib/admin-api";
import { API_BASE_URL } from "@/lib/config";
import { TablePrimaryButton } from "./tableButtons";
import { TABLE_BUTTON_COLORS } from "./tableStatus";
import { usePrinterStore, PrinterError, type KotPrintResult } from "@/store/printer-store";
import type { KOTOrder } from "@/lib/printer/kot";

const FONT = "var(--font-body, 'Inter', system-ui, sans-serif)";
const TAX_RATE = 0.05; // Mirrors backend/src/services/orderService.js TAX_RATE — display only, server recomputes.

const QUICK_NOTES = ["No Onion", "Extra Cheese", "Extra Sugar", "Less Ice", "Extra Spicy"];

interface CartLine {
  menuItem: AdminMenuItem;
  quantity: number;
  notes: string;
}

function resolveImageSrc(image: string) {
  if (!image) return "";
  if (image.startsWith("http") || image.startsWith("/uploads")) {
    return image.startsWith("/uploads") ? `${API_BASE_URL}${image}` : image;
  }
  return image;
}

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

// Single-stage, table-scoped Create Order screen.
//
// Replaces the old 5-step wizard (Order Type -> Table -> Customer -> Menu ->
// Summary). This is opened directly from a specific table's Table Details
// modal, so the table (and its active dining session, if one already
// exists) is already known — there is nothing left to ask the admin.
// Everything (search/filter, add items, adjust quantity, notes, totals,
// submit) lives on one screen.
export default function TableCreateOrderScreen({
  restaurantId,
  tableId,
  tableLabel,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  tableId: string;
  tableLabel: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeItem, setActiveItem] = useState<AdminMenuItem | null>(null);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [instructions, setInstructions] = useState("");

  const [submitting, setSubmitting] = useState<"order" | "order-kot" | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const printKotViaQz = usePrinterStore((s) => s.printKOT);
  const autoPrintKot = usePrinterStore((s) => s.autoPrintKot);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  useEffect(() => {
    fetchAdminCategories(restaurantId).then(setCategories).catch(() => {});
  }, [restaurantId]);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      fetchAdminMenuItems(restaurantId, {
        search: search || undefined,
        categoryId: categoryFilter || undefined,
        // No `limit` — see the matching note this was ported from: this
        // picker needs the whole catalog, categories are filtered
        // client-side via the chips above.
      })
        .then((data) => setItems(data.items))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(handle);
  }, [restaurantId, search, categoryFilter]);

  const cartQuantityFor = (itemId: string) => cart.find((l) => l.menuItem.id === itemId)?.quantity ?? 0;

  const upsertCartLine = (menuItem: AdminMenuItem, quantity: number, notes: string) => {
    setCart((prev) => {
      const existingIndex = prev.findIndex((l) => l.menuItem.id === menuItem.id);
      if (existingIndex === -1) return [...prev, { menuItem, quantity, notes }];
      const next = [...prev];
      next[existingIndex] = { menuItem, quantity, notes };
      return next;
    });
  };

  const changeQuantity = (itemId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((l) => (l.menuItem.id === itemId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  };

  const removeLine = (itemId: string) => {
    setCart((prev) => prev.filter((l) => l.menuItem.id !== itemId));
  };

  const subtotal = cart.reduce((sum, l) => sum + l.menuItem.price * l.quantity, 0);
  const taxAmount = Math.round(subtotal * TAX_RATE);
  const grandTotal = subtotal + taxAmount;
  const totalQty = cart.reduce((n, l) => n + l.quantity, 0);

  // Creates the order against this table's tableId. The backend
  // (validateAndBuildAdminOrder / syncTableOccupancyForOrder) already
  // attaches it to the table's existing active dining session if one
  // exists, or starts a new one only if the table has none — this screen
  // never chooses or creates a session itself, and never touches QR
  // ordering sessions.
  const handleSubmit = async (mode: "order" | "order-kot") => {
    setSubmitting(mode);
    setSubmitError(null);
    try {
      const order = await createAdminOrder({
        orderType: "dine-in",
        tableId,
        items: cart.map((l) => ({ id: l.menuItem.id, quantity: l.quantity, notes: l.notes })),
        specialInstructions: instructions.trim(),
      });

      // "Create & Print KOT" — explicitly print via QZ Tray. Skipped when
      // Auto Print KOT is on: KotAutoPrintProvider already prints this same
      // order the instant its "new-order" Socket.IO event arrives, so
      // firing this too would print the same KOT twice. Only fire the
      // explicit print when auto-print is off, so staff still get their
      // guaranteed ticket from this button in that case.
      if (mode === "order-kot" && !autoPrintKot) {
        const kot: KOTOrder = {
          orderId: order.orderId,
          tableLabel: order.tableLabel,
          orderType: order.orderType,
          placedAt: order.placedAt,
          specialInstructions: order.specialInstructions,
          tokenNumber: order.tokenNumber,
          items: (order.items ?? []).map((line) => ({
            item: { name: line.item.name, categoryTitle: line.item.categoryTitle },
            quantity: line.quantity,
          })),
        };
        try {
          const result: KotPrintResult = await printKotViaQz(kot);
          if (!result.kitchen.ok && !result.counter.ok) {
            // Order already succeeded — surface the print failure but don't
            // block closing the screen or refreshing the table.
            console.error("KOT print failed:", result.kitchen.error, result.counter.error);
          }
        } catch (printErr) {
          console.error("KOT print failed:", printErr instanceof PrinterError ? printErr.message : printErr);
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#FFFFFF",
        zIndex: 1400,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ---- Header ---- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: `1px solid ${adminColors.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            type="button"
            aria-label="Back"
            onClick={onClose}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: 8,
              border: `1px solid ${adminColors.border}`,
              background: "#FFFFFF",
              color: adminColors.text,
              cursor: "pointer",
            }}
          >
            <ArrowLeft size={15} />
          </button>
          <div>
            <div
              style={{
                fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
                fontSize: 22,
                fontWeight: 700,
                color: adminColors.text,
              }}
            >
              Create Order
            </div>
            <div style={{ fontFamily: FONT, fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
              {tableLabel}
            </div>
          </div>
        </div>
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 32,
            height: 32,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: adminColors.textSecondary,
            cursor: "pointer",
          }}
        >
          <X size={18} />
        </button>
      </div>

      {/* ---- Body: menu (left) + order summary (right) on one screen ---- */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(0, 2fr) minmax(280px, 1fr)",
            gap: 24,
            maxWidth: 1200,
            margin: "0 auto",
            alignItems: "start",
          }}
        >
          {/* Menu column */}
          <div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 12px",
                  borderRadius: 10,
                  border: `1px solid ${adminColors.border}`,
                  flex: "1 1 220px",
                }}
              >
                <Search size={14} color={adminColors.textSecondary} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search Menu..."
                  style={{
                    border: "none",
                    outline: "none",
                    flex: 1,
                    background: "transparent",
                    fontFamily: FONT,
                    fontSize: 13,
                    color: adminColors.text,
                  }}
                />
              </div>

              <FilterChip label="All" active={!categoryFilter} onClick={() => setCategoryFilter("")} />
              {categories.map((c) => (
                <FilterChip
                  key={c.categoryId}
                  label={c.title}
                  active={categoryFilter === c.categoryId}
                  onClick={() => setCategoryFilter(c.categoryId)}
                />
              ))}
            </div>

            {loading && <p style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary }}>Loading menu…</p>}

            {!loading && items.length === 0 && (
              <p style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary }}>No items match your search.</p>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
              {items.map((item) => {
                const inCart = cartQuantityFor(item.id);
                return (
                  <div
                    key={item.id}
                    style={{
                      border: `1px solid ${adminColors.border}`,
                      borderRadius: 14,
                      overflow: "hidden",
                      background: "#FFFFFF",
                      opacity: item.isAvailable ? 1 : 0.55,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <div style={{ width: "100%", aspectRatio: "4 / 3", background: adminColors.bg, position: "relative" }}>
                      {item.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={resolveImageSrc(item.image)} alt={item.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : null}
                      {inCart > 0 && (
                        <span
                          style={{
                            position: "absolute",
                            top: 8,
                            right: 8,
                            background: adminColors.primary,
                            color: "#FFFFFF",
                            borderRadius: 999,
                            minWidth: 22,
                            height: 22,
                            padding: "0 6px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontFamily: FONT,
                            fontSize: 12,
                            fontWeight: 800,
                          }}
                        >
                          {inCart}
                        </span>
                      )}
                    </div>
                    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <DietDot diet={item.diet} />
                        <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: adminColors.text }}>{item.name}</span>
                      </div>
                      <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: adminColors.text }}>{formatCurrency(item.price)}</div>
                      {!item.isAvailable && <Badge color={adminColors.textSecondary}>Unavailable</Badge>}

                      {item.isAvailable && (
                        <div style={{ marginTop: "auto" }}>
                          {inCart > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                              <QuantityStepper value={inCart} onChange={(v) => changeQuantity(item.id, v - inCart)} />
                              <button
                                type="button"
                                onClick={() => setActiveItem(item)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: adminColors.primary,
                                  fontFamily: FONT,
                                  fontSize: 12,
                                  fontWeight: 700,
                                  cursor: "pointer",
                                }}
                              >
                                Notes
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => upsertCartLine(item, 1, "")}
                              style={{
                                width: "100%",
                                padding: "8px 10px",
                                borderRadius: 8,
                                border: "none",
                                background: adminColors.primary,
                                color: "#FFFFFF",
                                fontFamily: FONT,
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              + Add
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Order summary column — always visible, no separate step */}
          <div
            style={{
              position: "sticky",
              top: 0,
              border: `1px solid ${adminColors.border}`,
              borderRadius: 14,
              padding: 16,
              display: "flex",
              flexDirection: "column",
              gap: 12,
            }}
          >
            <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 800, color: adminColors.text, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              Order Summary
            </div>

            {cart.length === 0 ? (
              <p style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
                No items added yet — tap &quot;+ Add&quot; on a menu item.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {cart.map((line) => (
                  <div key={line.menuItem.id} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: adminColors.text }}>
                        {line.quantity} × {line.menuItem.name}
                      </div>
                      {line.notes && (
                        <div style={{ fontFamily: FONT, fontSize: 11, color: adminColors.textSecondary, marginTop: 2 }}>{line.notes}</div>
                      )}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <QuantityStepper value={line.quantity} onChange={(v) => changeQuantity(line.menuItem.id, v - line.quantity)} />
                        <button
                          type="button"
                          aria-label={`Remove ${line.menuItem.name}`}
                          onClick={() => removeLine(line.menuItem.id)}
                          style={{ border: "none", background: "transparent", color: adminColors.textSecondary, cursor: "pointer" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                    <div style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: adminColors.text, whiteSpace: "nowrap" }}>
                      {formatCurrency(line.menuItem.price * line.quantity)}
                    </div>
                  </div>
                ))}

                <div style={{ borderTop: `1px solid ${adminColors.border}`, marginTop: 4, paddingTop: 10, display: "flex", flexDirection: "column", gap: 6 }}>
                  <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
                  <SummaryRow label="GST (5%)" value={formatCurrency(taxAmount)} />
                  <SummaryRow label="Grand Total" value={formatCurrency(grandTotal)} bold />
                </div>
              </div>
            )}

            <div>
              <div style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", marginBottom: 6 }}>
                Special Instructions
              </div>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="Any notes for the whole order…"
                rows={2}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${adminColors.border}`,
                  fontFamily: FONT,
                  fontSize: 13,
                  color: adminColors.text,
                  outline: "none",
                  resize: "vertical",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ---- Footer ---- */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "14px 24px",
          borderTop: `1px solid ${adminColors.border}`,
          flexShrink: 0,
          gap: 12,
        }}
      >
        <div style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary }}>
          {cart.length > 0 && (
            <>
              {totalQty} item{totalQty === 1 ? "" : "s"} · <strong style={{ color: adminColors.text }}>{formatCurrency(grandTotal)}</strong>
            </>
          )}
        </div>

        {submitError && (
          <div style={{ fontFamily: FONT, fontSize: 12, color: TABLE_BUTTON_COLORS.danger, flex: 1, textAlign: "center" }}>{submitError}</div>
        )}

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${TABLE_BUTTON_COLORS.secondaryBorder}`,
              background: "#FFFFFF",
              color: TABLE_BUTTON_COLORS.secondaryText,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => handleSubmit("order")}
            disabled={submitting !== null || cart.length === 0}
            style={{
              padding: "10px 16px",
              borderRadius: 10,
              border: `1px solid ${adminColors.primary}`,
              background: "#FFFFFF",
              color: adminColors.primary,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 700,
              cursor: submitting !== null || cart.length === 0 ? "not-allowed" : "pointer",
              opacity: submitting !== null || cart.length === 0 ? 0.6 : 1,
            }}
          >
            {submitting === "order" ? "Creating…" : "Create Order"}
          </button>

          <TablePrimaryButton onClick={() => handleSubmit("order-kot")} disabled={submitting !== null || cart.length === 0}>
            {submitting === "order-kot" ? "Creating…" : "Create & Print KOT"}
          </TablePrimaryButton>
        </div>
      </div>

      {activeItem && (
        <ItemNotesModal
          item={activeItem}
          existing={cart.find((l) => l.menuItem.id === activeItem.id) ?? null}
          onClose={() => setActiveItem(null)}
          onSave={(notes) => {
            const qty = cartQuantityFor(activeItem.id) || 1;
            upsertCartLine(activeItem, qty, notes);
            setActiveItem(null);
          }}
        />
      )}
    </div>
  );
}

function DietDot({ diet }: { diet: "veg" | "non-veg" }) {
  const color = diet === "veg" ? adminColors.success : adminColors.danger;
  return (
    <span style={{ display: "inline-block", width: 9, height: 9, borderRadius: 2, border: `1.5px solid ${color}`, position: "relative", flexShrink: 0 }}>
      <span style={{ position: "absolute", inset: 1.5, borderRadius: 1, background: color }} />
    </span>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <StepperButton onClick={() => onChange(Math.max(0, value - 1))}>
        <Minus size={12} />
      </StepperButton>
      <span style={{ fontFamily: FONT, fontSize: 13, fontWeight: 700, color: adminColors.text, minWidth: 16, textAlign: "center" }}>{value}</span>
      <StepperButton onClick={() => onChange(value + 1)}>
        <Plus size={12} />
      </StepperButton>
    </div>
  );
}

function StepperButton({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 24,
        height: 24,
        borderRadius: 6,
        border: `1px solid ${adminColors.border}`,
        background: "#FFFFFF",
        color: adminColors.text,
        cursor: "pointer",
      }}
    >
      {children}
    </button>
  );
}

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "6px 12px",
        borderRadius: 999,
        border: `1px solid ${active ? adminColors.primary : adminColors.border}`,
        background: active ? `${adminColors.primary}1A` : "#FFFFFF",
        color: active ? adminColors.primary : adminColors.textSecondary,
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT }}>
      <span style={{ fontSize: bold ? 14 : 12, fontWeight: bold ? 700 : 500, color: bold ? adminColors.text : adminColors.textSecondary }}>{label}</span>
      <span style={{ fontSize: bold ? 15 : 12, fontWeight: bold ? 800 : 700, color: adminColors.text }}>{value}</span>
    </div>
  );
}

// Lightweight notes-only editor for an item already in the cart — quantity
// is adjusted inline via the stepper, so this just captures special
// instructions (with the same quick-note chips as before).
function ItemNotesModal({
  item,
  existing,
  onClose,
  onSave,
}: {
  item: AdminMenuItem;
  existing: CartLine | null;
  onClose: () => void;
  onSave: (notes: string) => void;
}) {
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const appendQuickNote = (chip: string) => {
    setNotes((prev) => {
      const parts = prev.split(",").map((p) => p.trim()).filter(Boolean);
      if (parts.includes(chip)) return prev;
      return [...parts, chip].join(", ");
    });
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,28,28,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1500,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 18,
          padding: 22,
          width: "100%",
          maxWidth: 380,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: adminColors.text }}>{item.name}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ border: "none", background: "transparent", color: adminColors.textSecondary, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {QUICK_NOTES.map((chip) => (
            <button
              key={chip}
              type="button"
              onClick={() => appendQuickNote(chip)}
              style={{
                padding: "5px 10px",
                borderRadius: 999,
                border: `1px solid ${adminColors.border}`,
                background: "#FFFFFF",
                color: adminColors.text,
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + {chip}
            </button>
          ))}
        </div>

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Custom notes, e.g. No Onion, Extra Cheese"
          rows={3}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${adminColors.border}`,
            fontFamily: FONT,
            fontSize: 13,
            color: adminColors.text,
            outline: "none",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <TablePrimaryButton onClick={() => onSave(notes.trim())}>Save</TablePrimaryButton>
        </div>
      </div>
    </div>
  );
}