"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  X,
  ArrowLeft,
  Search,
  Plus,
  Minus,
  Trash2,
  UtensilsCrossed,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { adminColors, TextInput, Badge } from "@/components/admin/ui";
import {
  fetchAdminMenuItems,
  fetchAdminCategories,
  createAdminOrder,
  type AdminMenuItem,
  type AdminCategory,
  type TableGridItem,
} from "@/lib/admin-api";
import { API_BASE_URL } from "@/lib/config";
import { TablePrimaryButton } from "./tableButtons";
import { TABLE_BUTTON_COLORS, statusMeta } from "./tableStatus";
import { usePrinterStore } from "@/store/printer-store";
import type { KOTOrder } from "@/lib/printer/kot";

const FONT = "var(--font-body, 'Inter', system-ui, sans-serif)";
const TAX_RATE = 0.05; // Mirrors backend/src/services/orderService.js TAX_RATE — display only, server recomputes.

// Quick-add customization chips — the same examples called out in the spec.
// Tapping one appends it to the notes field rather than replacing it, so
// staff can stack a couple ("No Onion" + "Extra Spicy").
const QUICK_NOTES = ["No Onion", "Extra Cheese", "Extra Sugar", "Less Ice", "Extra Spicy"];

type OrderType = "dine-in" | "takeaway";
type Step = "orderType" | "table" | "customer" | "menu" | "summary";

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

// Tables the spec doesn't define behavior for (reserved/cleaning/out of
// service) are shown but disabled here, alongside billing ("Awaiting
// Payment") which the spec explicitly blocks. Kept local to this flow so
// the main Table Grid's own status handling is untouched.
function tableSelectable(table: TableGridItem): boolean {
  return table.status === "available" || table.status === "occupied";
}

function tableBlockedReason(table: TableGridItem): string {
  if (table.status === "billing") {
    return "Awaiting payment — settle the current session before starting a new order.";
  }
  if (table.status === "reserved") {
    return "Reserved — check in the reservation from the Reservations tab, or choose another table.";
  }
  return `Table is "${statusMeta(table.status).label}" and can't take a new order right now.`;
}

export default function CreateOrderFlow({
  restaurantId,
  tables = [],
  lockedTable,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  tables?: TableGridItem[];
  // Admin Create Order From Table — when opened from a specific table's
  // Table Details Drawer (the "+ Create Order" button beside Print KOT),
  // the table is already known: no Order Type / Table Selection / Customer
  // Selection steps, straight to the menu. See TableDetailsDrawer.tsx.
  lockedTable?: TableGridItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [orderType, setOrderType] = useState<OrderType | null>(lockedTable ? "dine-in" : null);
  const [selectedTable, setSelectedTable] = useState<TableGridItem | null>(lockedTable ?? null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState("");

  const steps: Step[] = useMemo(() => {
    if (lockedTable) return ["menu", "summary"];
    return orderType === "takeaway" ? ["orderType", "customer", "menu", "summary"] : ["orderType", "table", "customer", "menu", "summary"];
  }, [orderType, lockedTable]);
  const [stepIndex, setStepIndex] = useState(0);
  const step = steps[stepIndex] ?? steps[0];

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const printKotViaQz = usePrinterStore((s) => s.printKOT);

  // Escape-to-close, matching every other modal in this module.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const goNext = () => setStepIndex((i) => Math.min(steps.length - 1, i + 1));
  const goBack = () => setStepIndex((i) => Math.max(0, i - 1));

  const subtotal = cart.reduce((sum, l) => sum + l.menuItem.price * l.quantity, 0);
  const taxAmount = Math.round(subtotal * TAX_RATE);
  const grandTotal = subtotal + taxAmount;

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

  // `printKot` — "Create & Print KOT" (Admin Create Order From Table):
  // after the order is created against the table's active session, force
  // a KOT print for just this new order via the existing QZ Tray
  // integration (same pipeline as TableDetailsDrawer's "Print KOT" /
  // Reprint button), regardless of the Auto Print KOT setting. Best-effort
  // — a print failure here is surfaced but never blocks the order from
  // having been created (the admin can always reprint from the table
  // popup's header button afterwards), matching the "never throws into
  // the order-creation response" pattern used elsewhere for KOT printing.
  const handleSubmit = async (printKot = false) => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await createAdminOrder({
        orderType: orderType!,
        tableId: orderType === "dine-in" ? selectedTable?._id : undefined,
        items: cart.map((l) => ({ id: l.menuItem.id, quantity: l.quantity, notes: l.notes })),
        customerName: customerName.trim(),
        customerPhone: customerPhone.trim(),
        specialInstructions: specialInstructions.trim() || undefined,
      });

      if (printKot) {
        try {
          const kot: KOTOrder = {
            orderId: order.orderId,
            tableLabel: order.tableLabel,
            orderType: order.orderType,
            placedAt: order.placedAt,
            specialInstructions: order.specialInstructions,
            items: (order.items ?? []).map((line) => ({
              item: { name: line.item.name, categoryTitle: line.item.categoryTitle },
              quantity: line.quantity,
            })),
          };
          await printKotViaQz(kot);
        } catch (printErr) {
          console.error("Create & Print KOT: KOT print failed (order was still created):", printErr);
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  const stepLabels: Record<Step, string> = {
    orderType: "Order Type",
    table: "Table",
    customer: "Customer",
    menu: "Menu",
    summary: "Summary",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "#FFFFFF",
        zIndex: 1200,
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
          {(stepIndex > 0 || Boolean(lockedTable)) && (
            <button
              type="button"
              aria-label="Back"
              onClick={stepIndex > 0 ? goBack : onClose}
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
          )}
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
              {lockedTable ? lockedTable.label : `Step ${stepIndex + 1} of ${steps.length} · ${stepLabels[step]}`}
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

      {/* ---- Body ---- */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px", maxWidth: 960, margin: "0 auto", width: "100%" }}>
        {step === "orderType" && (
          <OrderTypeStep
            value={orderType}
            onSelect={(t) => {
              setOrderType(t);
              setStepIndex(1);
            }}
          />
        )}

        {step === "table" && (
          <TableStep
            tables={tables}
            selectedTable={selectedTable}
            onSelect={(t) => {
              setSelectedTable(t);
              goNext();
            }}
          />
        )}

        {step === "customer" && (
          <CustomerStep
            customerName={customerName}
            customerPhone={customerPhone}
            onChangeName={setCustomerName}
            onChangePhone={setCustomerPhone}
            onNext={goNext}
          />
        )}

        {step === "menu" && (
          <MenuStep
            restaurantId={restaurantId}
            cart={cart}
            onAdd={upsertCartLine}
            onChangeQuantity={changeQuantity}
          />
        )}

        {step === "summary" && (
          <SummaryStep
            cart={cart}
            subtotal={subtotal}
            taxAmount={taxAmount}
            grandTotal={grandTotal}
            onChangeQuantity={changeQuantity}
            onRemove={removeLine}
            specialInstructions={specialInstructions}
            onChangeSpecialInstructions={setSpecialInstructions}
          />
        )}
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
              {cart.reduce((n, l) => n + l.quantity, 0)} item{cart.reduce((n, l) => n + l.quantity, 0) === 1 ? "" : "s"} ·{" "}
              <strong style={{ color: adminColors.text }}>{formatCurrency(grandTotal)}</strong>
            </>
          )}
        </div>

        {submitError && (
          <div style={{ fontFamily: FONT, fontSize: 12, color: TABLE_BUTTON_COLORS.danger, flex: 1, textAlign: "center" }}>
            {submitError}
          </div>
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

          {step === "menu" && (
            <TablePrimaryButton onClick={goNext} disabled={cart.length === 0}>
              Review Order ({cart.reduce((n, l) => n + l.quantity, 0)})
            </TablePrimaryButton>
          )}

          {step === "customer" && <TablePrimaryButton onClick={goNext}>Continue to Menu</TablePrimaryButton>}

          {step === "summary" && lockedTable && (
            <>
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting || cart.length === 0}
                style={{
                  padding: "10px 16px",
                  borderRadius: 10,
                  border: `1px solid ${adminColors.primary}`,
                  background: "#FFFFFF",
                  color: adminColors.primary,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: submitting || cart.length === 0 ? "not-allowed" : "pointer",
                  opacity: submitting || cart.length === 0 ? 0.6 : 1,
                }}
              >
                {submitting ? "Creating…" : "Create Order"}
              </button>
              <TablePrimaryButton onClick={() => handleSubmit(true)} disabled={submitting || cart.length === 0}>
                {submitting ? "Creating…" : "Create & Print KOT"}
              </TablePrimaryButton>
            </>
          )}

          {step === "summary" && !lockedTable && (
            <TablePrimaryButton onClick={() => handleSubmit(false)} disabled={submitting || cart.length === 0}>
              {submitting ? "Sending…" : "Send to Kitchen"}
            </TablePrimaryButton>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 1 — Order Type
// ---------------------------------------------------------------------------
function OrderTypeStep({
  value,
  onSelect,
}: {
  value: OrderType | null;
  onSelect: (t: OrderType) => void;
}) {
  const options: { key: OrderType; label: string; icon: React.ReactNode; disabled?: boolean }[] = [
    { key: "dine-in", label: "Dine In", icon: <UtensilsCrossed size={22} /> },
    { key: "takeaway", label: "Take Away", icon: <ShoppingBag size={22} /> },
  ];

  return (
    <div>
      <SectionTitle>How is this order being served?</SectionTitle>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, maxWidth: 640 }}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            onClick={() => onSelect(o.key)}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              padding: "28px 16px",
              borderRadius: 16,
              border: `2px solid ${value === o.key ? adminColors.primary : adminColors.border}`,
              background: value === o.key ? `${adminColors.primary}0D` : "#FFFFFF",
              color: adminColors.text,
              cursor: "pointer",
            }}
          >
            <span style={{ color: adminColors.primary }}>{o.icon}</span>
            <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700 }}>{o.label}</span>
          </button>
        ))}

        {/* Architecture note: orderType is a plain union today ("dine-in" |
            "takeaway") specifically so Home Delivery can be added as a third
            value later without restructuring this step — shown here,
            disabled, as a placeholder for that. */}
       
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 2 — Select Table (dine-in only)
// ---------------------------------------------------------------------------
function TableStep({
  tables,
  selectedTable,
  onSelect,
}: {
  tables: TableGridItem[];
  selectedTable: TableGridItem | null;
  onSelect: (t: TableGridItem) => void;
}) {
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);

  return (
    <div>
      <SectionTitle>Select a table</SectionTitle>
      {blockedMessage && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            borderRadius: 10,
            background: `${TABLE_BUTTON_COLORS.danger}14`,
            color: TABLE_BUTTON_COLORS.danger,
            fontFamily: FONT,
            fontSize: 13,
          }}
        >
          {blockedMessage}
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 }}>
        {tables.map((table) => {
          const meta = statusMeta(table.status);
          const selectable = tableSelectable(table);
          const isSelected = selectedTable?._id === table._id;
          const displayLabel = table.status === "billing" ? "Awaiting Payment" : meta.label;
          return (
            <button
              key={table._id}
              type="button"
              onClick={() => {
                if (!selectable) {
                  setBlockedMessage(tableBlockedReason(table));
                  return;
                }
                setBlockedMessage(null);
                onSelect(table);
              }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 6,
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${isSelected ? adminColors.primary : adminColors.border}`,
                borderTop: `3px solid ${meta.color}`,
                background: isSelected ? `${adminColors.primary}0D` : "#FFFFFF",
                textAlign: "left",
                cursor: selectable ? "pointer" : "not-allowed",
                opacity: selectable ? 1 : 0.55,
              }}
            >
              <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 800, color: adminColors.text }}>{table.label}</span>
              <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: meta.color }}>{displayLabel}</span>
              <span style={{ fontFamily: FONT, fontSize: 11, color: adminColors.textSecondary }}>Seats {table.capacity}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 3 — Customer Details
// ---------------------------------------------------------------------------
function CustomerStep({
  customerName,
  customerPhone,
  onChangeName,
  onChangePhone,
  onNext,
}: {
  customerName: string;
  customerPhone: string;
  onChangeName: (v: string) => void;
  onChangePhone: (v: string) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <SectionTitle>Customer details (optional)</SectionTitle>
      <p style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary, marginTop: -8, marginBottom: 18 }}>
        Walk-in customers are fully supported — leave these blank if not provided.
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 520 }}>
        <TextInput label="Customer Name" value={customerName} onChange={onChangeName} placeholder="Walk-in" />
        <TextInput label="Phone Number" value={customerPhone} onChange={onChangePhone} placeholder="+91 90000 00000" />
      </div>
      <div style={{ marginTop: 20 }}>
        <button
          type="button"
          onClick={onNext}
          style={{
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            color: adminColors.textSecondary,
            background: "none",
            border: "none",
            textDecoration: "underline",
            cursor: "pointer",
            padding: 0,
          }}
        >
          Skip — continue as walk-in
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Step 4 — Menu Selection
// ---------------------------------------------------------------------------
function MenuStep({
  restaurantId,
  cart,
  onAdd,
  onChangeQuantity,
}: {
  restaurantId: string;
  cart: CartLine[];
  onAdd: (item: AdminMenuItem, quantity: number, notes: string) => void;
  onChangeQuantity: (itemId: string, delta: number) => void;
}) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [activeItem, setActiveItem] = useState<AdminMenuItem | null>(null);

  useEffect(() => {
    fetchAdminCategories(restaurantId).then(setCategories).catch(() => {});
  }, [restaurantId]);

  useEffect(() => {
    setLoading(true);
    const handle = setTimeout(() => {
      fetchAdminMenuItems(restaurantId, {
        search: search || undefined,
        categoryId: categoryFilter || undefined,
        // Deliberately omitted `limit` — this picker has no server
        // pagination UI of its own (categories are filtered client-side
        // via the chips above), so it needs the WHOLE catalog every time,
        // not a capped page of it. Passing a numeric limit here previously
        // caused every item/category past the backend's page-size cap to
        // silently vanish once a restaurant's menu grew past that cap. See
        // adminMenuController.js:listMenuItemsAdmin — omitting limit is the
        // documented "return every item, unpaginated" mode.
      })
        .then((data) => setItems(data.items))
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250); // light debounce so typing in search doesn't fire a request per keystroke
    return () => clearTimeout(handle);
  }, [restaurantId, search, categoryFilter]);

  const cartQuantityFor = (itemId: string) => cart.find((l) => l.menuItem.id === itemId)?.quantity ?? 0;

  return (
    <div>
      <SectionTitle>Select items</SectionTitle>

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
            placeholder="Search menu items"
            style={{ border: "none", outline: "none", flex: 1, background: "transparent", fontFamily: FONT, fontSize: 13, color: adminColors.text }}
          />
        </div>

        <FilterChip label="All" active={!categoryFilter} onClick={() => setCategoryFilter("")} />
        {categories.map((c) => (
          <FilterChip key={c.categoryId} label={c.title} active={categoryFilter === c.categoryId} onClick={() => setCategoryFilter(c.categoryId)} />
        ))}
      </div>

      {loading && (
        <p style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary }}>Loading menu…</p>
      )}

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
                <div style={{ marginTop: "auto" }}>
                  <button
                    type="button"
                    disabled={!item.isAvailable}
                    onClick={() => setActiveItem(item)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: 8,
                      border: "none",
                      background: item.isAvailable ? adminColors.primary : "#A8B0A9",
                      color: "#FFFFFF",
                      fontFamily: FONT,
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: item.isAvailable ? "pointer" : "not-allowed",
                    }}
                  >
                    {inCart > 0 ? "Edit" : "Add"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {activeItem && (
        <ItemCustomizeModal
          item={activeItem}
          existing={cart.find((l) => l.menuItem.id === activeItem.id) ?? null}
          onClose={() => setActiveItem(null)}
          onAdd={(qty, notes) => {
            onAdd(activeItem, qty, notes);
            setActiveItem(null);
          }}
          onRemove={() => {
            onChangeQuantity(activeItem.id, -cartQuantityFor(activeItem.id));
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
    <span
      style={{
        display: "inline-block",
        width: 9,
        height: 9,
        borderRadius: 2,
        border: `1.5px solid ${color}`,
        position: "relative",
        flexShrink: 0,
      }}
    >
      <span style={{ position: "absolute", inset: 1.5, borderRadius: 1, background: color }} />
    </span>
  );
}

function ItemCustomizeModal({
  item,
  existing,
  onClose,
  onAdd,
  onRemove,
}: {
  item: AdminMenuItem;
  existing: CartLine | null;
  onClose: () => void;
  onAdd: (quantity: number, notes: string) => void;
  onRemove: () => void;
}) {
  const [quantity, setQuantity] = useState(existing?.quantity ?? 1);
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const appendQuickNote = (chip: string) => {
    setNotes((prev) => {
      const parts = prev
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
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
        zIndex: 1300,
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
          maxWidth: 420,
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
          display: "flex",
          flexDirection: "column",
          gap: 14,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: adminColors.text }}>{item.name}</div>
            <div style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary, marginTop: 2 }}>{formatCurrency(item.price)}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ border: "none", background: "transparent", color: adminColors.textSecondary, cursor: "pointer" }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>
            Quantity
          </span>
          <QuantityStepper value={quantity} onChange={setQuantity} />
        </div>

        <div>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>
            Special Instructions
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, margin: "8px 0" }}>
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

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          {existing && (
            <button
              type="button"
              onClick={onRemove}
              style={{
                padding: "9px 14px",
                borderRadius: 10,
                border: `1px solid ${TABLE_BUTTON_COLORS.danger}`,
                background: "#FFFFFF",
                color: TABLE_BUTTON_COLORS.danger,
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          )}
          <TablePrimaryButton onClick={() => onAdd(quantity, notes.trim())}>Add to Order</TablePrimaryButton>
        </div>
      </div>
    </div>
  );
}

function QuantityStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <StepperButton onClick={() => onChange(Math.max(1, value - 1))}>
        <Minus size={14} />
      </StepperButton>
      <span style={{ fontFamily: FONT, fontSize: 15, fontWeight: 700, color: adminColors.text, minWidth: 20, textAlign: "center" }}>
        {value}
      </span>
      <StepperButton onClick={() => onChange(value + 1)}>
        <Plus size={14} />
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
        width: 28,
        height: 28,
        borderRadius: 8,
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

// ---------------------------------------------------------------------------
// Step 5 — Order Summary
// ---------------------------------------------------------------------------
function SummaryStep({
  cart,
  subtotal,
  taxAmount,
  grandTotal,
  onChangeQuantity,
  onRemove,
  specialInstructions,
  onChangeSpecialInstructions,
}: {
  cart: CartLine[];
  subtotal: number;
  taxAmount: number;
  grandTotal: number;
  onChangeQuantity: (itemId: string, delta: number) => void;
  onRemove: (itemId: string) => void;
  specialInstructions?: string;
  onChangeSpecialInstructions?: (v: string) => void;
}) {
  if (cart.length === 0) {
    return (
      <div>
        <SectionTitle>Order Summary</SectionTitle>
        <p style={{ fontFamily: FONT, fontSize: 13, color: adminColors.textSecondary }}>
          No items added yet — go back to the menu to add something.
        </p>
      </div>
    );
  }

  return (
    <div>
      <SectionTitle>Order Summary</SectionTitle>
      <div style={{ border: `1px solid ${adminColors.border}`, borderRadius: 14, overflow: "hidden", maxWidth: 640 }}>
        {cart.map((line, idx) => (
          <div
            key={line.menuItem.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "14px 16px",
              borderBottom: idx < cart.length - 1 ? `1px solid ${adminColors.border}` : "none",
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: adminColors.text }}>{line.menuItem.name}</div>
              <div style={{ fontFamily: FONT, fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
                {formatCurrency(line.menuItem.price)} each
                {line.notes ? ` · ${line.notes}` : ""}
              </div>
            </div>
            <QuantityStepper value={line.quantity} onChange={(v) => onChangeQuantity(line.menuItem.id, v - line.quantity)} />
            <div style={{ fontFamily: FONT, fontSize: 14, fontWeight: 700, color: adminColors.text, minWidth: 64, textAlign: "right" }}>
              {formatCurrency(line.menuItem.price * line.quantity)}
            </div>
            <button
              type="button"
              aria-label={`Remove ${line.menuItem.name}`}
              onClick={() => onRemove(line.menuItem.id)}
              style={{ border: "none", background: "transparent", color: adminColors.textSecondary, cursor: "pointer" }}
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
      </div>

      <div style={{ maxWidth: 640, marginTop: 16, display: "flex", flexDirection: "column", gap: 6 }}>
        <SummaryRow label="Subtotal" value={formatCurrency(subtotal)} />
        <SummaryRow label="Taxes (5%)" value={formatCurrency(taxAmount)} />
        <SummaryRow label="Grand Total" value={formatCurrency(grandTotal)} bold />
      </div>

      {onChangeSpecialInstructions && (
        <div style={{ maxWidth: 640, marginTop: 20 }}>
          <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>
            Special Instructions (optional)
          </span>
          <textarea
            value={specialInstructions ?? ""}
            onChange={(e) => onChangeSpecialInstructions(e.target.value)}
            placeholder="Notes for the whole order, e.g. Serve quickly, birthday table"
            rows={2}
            style={{
              width: "100%",
              marginTop: 8,
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
      )}
    </div>
  );
}

function SummaryRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT }}>
      <span style={{ fontSize: bold ? 15 : 13, fontWeight: bold ? 700 : 500, color: bold ? adminColors.text : adminColors.textSecondary }}>
        {label}
      </span>
      <span style={{ fontSize: bold ? 17 : 13, fontWeight: bold ? 800 : 700, color: adminColors.text }}>{value}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
        fontSize: 19,
        fontWeight: 700,
        color: adminColors.text,
        marginBottom: 16,
      }}
    >
      {children}
    </div>
  );
}