"use client";

import React, { useMemo, useState } from "react";
import { Printer } from "lucide-react";
import { Modal, SecondaryButton, PrimaryButton, adminColors } from "@/components/admin/ui";
import ModalHeader from "./ModalHeader";
import { orderItemLineKey, type RecentOrder } from "@/lib/admin-api";
import { resolvePrinterRole, type KOTOrder, type KOTOrderItem, type KOTPrinterRole } from "@/lib/printer/kot";
import { PrinterError, type KotPrintResult } from "@/store/printer-store";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const PRINTER_LABEL: Record<KOTPrinterRole, string> = {
  kitchen: "Kitchen Printer",
  counter: "Counter Printer",
};

// Optional Enhancement: a small colored dot beside each item's printer
// badge, so the admin can tell at a glance where it's headed without
// reading the label — green for Counter, red for Kitchen.
const PRINTER_DOT: Record<KOTPrinterRole, string> = {
  kitchen: adminColors.danger,
  counter: adminColors.success,
};

// One selectable row in the modal — one order line item, tagged with the
// session order it came from (needed to rebuild a KOTOrder per order at
// print time) and its destination printer (resolved via the existing,
// unmodified category-based routing in lib/printer/kot.ts).
interface SelectableKotItem {
  id: string;
  orderId: string;
  name: string;
  quantity: number;
  printerRole: KOTPrinterRole;
  kotItem: KOTOrderItem;
}

// Flattens every active order's line items into one selectable list for
// the whole table/session, each tagged with a stable composite id
// (orderId + line id, falling back to array position exactly like
// orderItemLineKey does elsewhere) so a selection can always be traced
// back to the exact order + line it came from.
function buildSelectableItems(orders: RecentOrder[]): SelectableKotItem[] {
  const rows: SelectableKotItem[] = [];
  for (const order of orders) {
    (order.items ?? []).forEach((line, index) => {
      const printerRole = resolvePrinterRole(line.item.categoryTitle);
      rows.push({
        id: `${order.orderId}::${orderItemLineKey(line, index)}`,
        orderId: order.orderId,
        name: line.item.name,
        quantity: line.quantity,
        printerRole,
        kotItem: {
          item: { name: line.item.name, categoryTitle: line.item.categoryTitle },
          quantity: line.quantity,
          modifiers: line.modifiers,
        },
      });
    });
  }
  return rows;
}

/**
 * Print KOT — selection modal.
 *
 * Replaces the old "click Print KOT → reprint the whole order" flow. The
 * admin ticks exactly the items they want reprinted; only those items are
 * grouped by printer and sent to QZ Tray — never the full order.
 *
 * This deliberately reuses, unchanged:
 *   - splitKOTItemsByPrinter / buildEscPosKOT / resolvePrinterRole
 *     (lib/printer/kot.ts) — the existing category → printer routing.
 *   - usePrinterStore().printKOT (store/printer-store.ts) — the existing
 *     QZ Tray print pipeline, one ticket per printer per order.
 * The only thing that changes is which items are handed to that pipeline:
 * this modal filters each order's `items` array down to the selection
 * before building the KOTOrder passed to printKOT. Printing in this app
 * happens entirely client-side (browser → QZ Tray → printer) — there is
 * no backend print endpoint to route through — so filtering at this
 * boundary is the equivalent of "send only the selected item IDs to the
 * backend": nothing beyond the selection ever reaches a printer.
 */
export default function PrintKotModal({
  orders,
  printKOT,
  onClose,
  onPrinted,
}: {
  /** Active (non-cancelled) orders for the current table/session. */
  orders: RecentOrder[];
  printKOT: (order: KOTOrder) => Promise<KotPrintResult>;
  onClose: () => void;
  /** Called once, right before the modal closes itself on a fully
   *  successful print, so the parent can show its own success toast. */
  onPrinted: (message: string) => void;
}) {
  const items = useMemo(() => buildSelectableItems(orders), [orders]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(items.map((it) => it.id)));
  const clearSelection = () => setSelected(new Set());

  // Live summary: how many selected rows go to each printer, recomputed
  // instantly on every checkbox toggle since it's derived straight from
  // `selected`/`items` — never stored separately.
  const summary = useMemo(() => {
    const counts: Record<KOTPrinterRole, number> = { kitchen: 0, counter: 0 };
    for (const it of items) {
      if (selected.has(it.id)) counts[it.printerRole] += 1;
    }
    return counts;
  }, [items, selected]);

  const selectedCount = selected.size;
  const canPrint = selectedCount > 0 && !busy;

  const handlePrint = async () => {
    setBusy(true);
    setError(null);
    try {
      // Group the selected lines back by the order they came from — a
      // session can span multiple orders, and each KOT ticket still needs
      // its own order's table/time/special-instructions header.
      const byOrder = new Map<string, KOTOrderItem[]>();
      for (const it of items) {
        if (!selected.has(it.id)) continue;
        const bucket = byOrder.get(it.orderId) ?? [];
        bucket.push(it.kotItem);
        byOrder.set(it.orderId, bucket);
      }

      const ordersById = new Map(orders.map((o) => [o.orderId, o]));

      const results = await Promise.all(
        Array.from(byOrder.entries()).map(async ([orderId, selectedItems]) => {
          const order = ordersById.get(orderId);
          if (!order) return { orderId, result: { kitchen: { ok: true as const }, counter: { ok: true as const } } };
          const kot: KOTOrder = {
            orderId: order.orderId,
            tableLabel: order.tableLabel,
            orderType: order.orderType,
            placedAt: order.placedAt,
            specialInstructions: order.specialInstructions,
            items: selectedItems,
          };
          const result = await printKOT(kot);
          return { orderId, result };
        })
      );

      const failures = results.flatMap(({ orderId, result }) => [
        !result.kitchen.ok ? `Order #${orderId.slice(-6)} · Kitchen Printer — ${result.kitchen.error}` : null,
        !result.counter.ok ? `Order #${orderId.slice(-6)} · Counter Printer — ${result.counter.error}` : null,
      ].filter((m): m is string => Boolean(m)));

      if (failures.length > 0) {
        // Printer failure: keep the modal open (selection preserved) so
        // the admin can fix the printer and retry without re-selecting.
        setError(failures.join(" · "));
        return;
      }

      onPrinted(
        selectedCount > 1 ? `KOT printed successfully for ${selectedCount} items.` : "KOT printed successfully."
      );
      onClose();
    } catch (err) {
      setError(err instanceof PrinterError ? err.message : "Could not print KOT.");
    } finally {
      setBusy(false);
    }
  };

  const handleClose = () => {
    if (busy) return; // Never let an overlay click / Escape drop a print in flight.
    onClose();
  };

  return (
    <Modal
      title="Print KOT"
      titleNode={<ModalHeader title="Print KOT" onClose={handleClose} />}
      onClose={handleClose}
      closeOnOverlayClick={false}
      maxWidth={480}
    >
      <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, marginTop: -8 }}>
        Select the items to print
      </span>

      {items.length === 0 ? (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
          No active items for this session.
        </p>
      ) : (
        <>
          {/* Select All / Clear Selection */}
          <div style={{ display: "flex", gap: 8 }}>
            <SecondaryButton onClick={selectAll} disabled={busy || selectedCount === items.length}>
              Select All
            </SecondaryButton>
            <SecondaryButton onClick={clearSelection} disabled={busy || selectedCount === 0}>
              Clear Selection
            </SecondaryButton>
          </div>

          {/* Item checklist */}
          <div
            style={{
              border: `1px solid ${adminColors.border}`,
              borderRadius: 10,
              overflow: "hidden",
              maxHeight: 280,
              overflowY: "auto",
            }}
          >
            {items.map((it, idx) => (
              <label
                key={it.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 12px",
                  borderBottom: idx < items.length - 1 ? `1px solid ${adminColors.border}` : "none",
                  background: selected.has(it.id) ? `${adminColors.primary}0D` : "#FFFFFF",
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={selected.has(it.id)}
                  onChange={() => toggle(it.id)}
                  disabled={busy}
                  style={{ width: 16, height: 16, cursor: busy ? "not-allowed" : "pointer", accentColor: adminColors.primary, flexShrink: 0 }}
                />
                <span
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 13,
                    fontWeight: selected.has(it.id) ? 700 : 600,
                    color: adminColors.text,
                    flex: 1,
                  }}
                >
                  {it.quantity} × {it.name}
                </span>
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "3px 10px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    fontFamily: bodyFont,
                    background: `${PRINTER_DOT[it.printerRole]}1A`,
                    color: PRINTER_DOT[it.printerRole],
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: PRINTER_DOT[it.printerRole] }} />
                  {PRINTER_LABEL[it.printerRole]}
                </span>
              </label>
            ))}
          </div>

          {/* Live summary */}
          <div
            style={{
              border: `1px solid ${adminColors.border}`,
              borderRadius: 10,
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            <span
              style={{
                fontFamily: bodyFont,
                fontSize: 11,
                fontWeight: 700,
                color: adminColors.text,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Selected Items
            </span>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>Counter Printer</span>
              <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.text }}>
                {summary.counter} {summary.counter === 1 ? "Item" : "Items"}
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>Kitchen Printer</span>
              <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.text }}>
                {summary.kitchen} {summary.kitchen === 1 ? "Item" : "Items"}
              </span>
            </div>
          </div>

          {error && (
            <p style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.danger, margin: 0 }}>{error}</p>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <SecondaryButton onClick={onClose} disabled={busy}>
              Cancel
            </SecondaryButton>
            <PrimaryButton onClick={handlePrint} disabled={!canPrint}>
              {busy ? (
                "Printing…"
              ) : (
                <>
                  <Printer size={14} /> Print{selectedCount > 0 ? ` (${selectedCount})` : ""}
                </>
              )}
            </PrimaryButton>
          </div>
        </>
      )}
    </Modal>
  );
}
