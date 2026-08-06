"use client";

import React, { useEffect, useState } from "react";
import { Printer, Receipt, Check, Plus } from "lucide-react";
import { Modal, SecondaryButton, PrimaryButton, Select, Badge, adminColors } from "@/components/admin/ui";
import {
  fetchTableDetails,
  markTableBilling,
  markTableAvailable,
  markTableOutOfService,
  cancelReservation,
  checkInReservation,
  markReservationNoShow,
  fetchSessionOrders,
  fetchSessionReceipt,
  printSessionBill,
  submitTableBill,
  fetchAdminOffers,
  applySessionOffer,
  removeSessionOffer,
  type TableGridItem,
  type RecentOrder,
  type ReceiptData,
  type Offer,
} from "@/lib/admin-api";
import { statusMeta, formatCurrency, formatTime } from "./tableStatus";
import { TablePrimaryButton } from "./tableButtons";
import ModalHeader from "./ModalHeader";
import ThermalReceipt from "./ThermalReceipt";
import TableCreateOrderScreen from "./TableCreateOrderScreen";
import { usePrinterStore, PrinterError, type KotPrintResult } from "@/store/printer-store";
import type { KOTOrder } from "@/lib/printer/kot";
import { getGstBreakdown, getGstRateLabel } from "@/lib/billing";

// "₹100 Off" / "10% Off" — same label shown in the Offers & Discounts admin
// page's table, reused here for the billing popup's offer dropdown.
function discountValueLabel(offer: Pick<Offer, "discountType" | "discountValue">): string {
  return offer.discountType === "flat" ? `₹${offer.discountValue} Off` : `${offer.discountValue}% Off`;
}

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  preparing: "Preparing",
  ready: "Ready",
  completed: "Served",
  cancelled: "Cancelled",
};

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  upi: "UPI",
  cash: "Cash",
  card: "Card",
};

// A single overall status for the session's orders, so the popup can show
// one clear line ("Preparing") instead of forcing staff to scan every
// order card — takes whichever stage the *least* advanced active order is
// at, since that's the one still holding up the table.
function overallOrderStatus(orders: RecentOrder[]) {
  const active = orders.filter((o) => o.status !== "cancelled");
  if (active.length === 0) return null;
  const priority = ["pending", "preparing", "ready", "completed"];
  let worst = "completed";
  for (const o of active) {
    if (priority.indexOf(o.status) < priority.indexOf(worst)) worst = o.status;
  }
  return worst;
}

// Line items for the "Ordered Items" section — every item across every
// order in the session, quantities for the same item/price summed
// together (so a Cappuccino ordered twice shows as one "2 x Cappuccino"
// row with its combined line total), sourced from the receipt payload so
// the popup's item list always matches what gets printed.
function aggregateReceiptItems(receipt: ReceiptData | null) {
  if (!receipt) return [];
  const byKey = new Map<string, { name: string; price: number; quantity: number }>();
  for (const order of receipt.orders) {
    for (const it of order.items) {
      const key = `${it.name}__${it.price}`;
      const existing = byKey.get(key);
      if (existing) {
        existing.quantity += it.quantity;
      } else {
        byKey.set(key, { name: it.name, price: it.price, quantity: it.quantity });
      }
    }
  }
  return Array.from(byKey.values());
}

// Labels the session's overall order status for the "Order Status" row.
// Accepts either the receipt-derived status ("completed" | "in_progress")
// or the per-order fallback ("pending" | "preparing" | "ready" | "completed")
// so it works whether or not the receipt has loaded yet.
function orderStatusLabel(status: string | null): string {
  if (!status) return "—";
  if (status === "completed") return "Served";
  if (status === "in_progress") return "Preparing";
  return ORDER_STATUS_LABEL[status] || status;
}

export default function TableDetailsDrawer({
  tableId,
  onClose,
  onChanged,
}: {
  tableId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [table, setTable] = useState<TableGridItem | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Per-table Create Order screen — replaces the old global 5-step wizard.
  // Opened directly from this table's header, next to Print KOT, since the
  // table (and its active session, if any) is already known here.
  const [showCreateOrder, setShowCreateOrder] = useState(false);

  // Print workflow state — separate from `busy`/`error` above so a print
  // failure never blocks the other billing actions (Close Session, Mark
  // Out of Service), per "keep the session active, allow retry".
  const [printBusy, setPrintBusy] = useState(false);
  const [printNotice, setPrintNotice] = useState<{ ok: boolean; message: string } | null>(null);
  const [printModal, setPrintModal] = useState<{ heading: string; receipt: ReceiptData; qzPrinted: boolean } | null>(null);

  // Reprint KOT (drawer header button) — separate busy/notice state so a
  // KOT reprint failure never blocks Print Bill / Submit Bill / other
  // actions, and vice versa.
  const [kotBusy, setKotBusy] = useState(false);
  const [kotNotice, setKotNotice] = useState<{ ok: boolean; message: string } | null>(null);

  // Settlements Module — "Submit Bill" state, separate from `busy` so a
  // failure here never blocks Print Bill / other actions.
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitNotice, setSubmitNotice] = useState<{ ok: boolean; message: string } | null>(null);

  // Offers & Discounts Module — catalog of this restaurant's offers (for
  // the "Select Offer" dropdown, filtered to Active below) plus apply/
  // remove state, separate from `busy` so an offer failure never blocks
  // the other billing actions.
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOfferId, setSelectedOfferId] = useState("");
  const [offerBusy, setOfferBusy] = useState(false);
  const [offerNotice, setOfferNotice] = useState<{ ok: boolean; message: string } | null>(null);

  const printReceiptViaQz = usePrinterStore((s) => s.printReceipt);
  const printKotViaQz = usePrinterStore((s) => s.printKOT);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { table: t, activeSession, activeReservation } = await fetchTableDetails(tableId);
      const full: TableGridItem = { ...(t as TableGridItem), activeSession, activeReservation };
      setTable(full);
      if (activeSession) {
        const [{ orders: sessionOrders }, receiptResult, offerList] = await Promise.all([
          fetchSessionOrders(activeSession.sessionId),
          fetchSessionReceipt(tableId).catch(() => ({ receipt: null as ReceiptData | null })),
          fetchAdminOffers(t.restaurantId).catch(() => [] as Offer[]),
        ]);
        setOrders(sessionOrders);
        setReceipt(receiptResult.receipt);
        setOffers(offerList);
      } else {
        setOrders([]);
        setReceipt(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  // Print Bill / Reprint Bill: fetch the latest receipt, print via the
  // existing QZ Tray integration, then mark the bill printed server-side
  // (print history + invoice number) once QZ confirms. Never closes the
  // session — Close Session is a separate, explicit action below.
  const handlePrintBill = async () => {
    // Guards against a queued click firing while Apply/Remove Offer is
    // still saving — without this, the receipt fetched a moment later
    // could still race the offer's DB write and print pre-offer figures
    // even though the on-screen summary (updated from the offer response)
    // already looks correct. See the matching guard in
    // handleApplyOffer/handleRemoveOffer below.
    if (offerBusy) return;
    setPrintBusy(true);
    setPrintNotice(null);
    try {
      const { receipt: draft } = await fetchSessionReceipt(tableId);

      try {
        await printReceiptViaQz(draft, 80);
      } catch (printErr) {
        setPrintNotice({
          ok: false,
          message: printErr instanceof PrinterError ? printErr.message : "Could not print the bill via QZ Tray. You can retry, or use the browser print fallback below.",
        });
        setPrintModal({ heading: "Bill", receipt: draft, qzPrinted: false });
        return;
      }

      const { receipt: r } = await printSessionBill(tableId);
      await load();
      setPrintNotice({ ok: true, message: r.session.printCount > 1 ? "Bill reprinted successfully." : "Bill printed successfully." });
      setPrintModal({ heading: "Bill", receipt: r, qzPrinted: true });
    } catch (err) {
      setPrintNotice({ ok: false, message: err instanceof Error ? err.message : "Could not print bill" });
    } finally {
      setPrintBusy(false);
    }
  };

  // Settlements Module: "Submit Bill" — replaces "Close Session". Locks the
  // bill and files it as a Pending Settlement; the session stays active
  // and the table only leaves "Awaiting Payment" once the cashier
  // completes the settlement from the Settlements page.
  const handleSubmitBill = async () => {
    setSubmitBusy(true);
    setSubmitNotice(null);
    try {
      await submitTableBill(tableId);
      setSubmitNotice({ ok: true, message: "Bill submitted — awaiting payment in Settlements." });
      await load();
      onChanged();
    } catch (err) {
      setSubmitNotice({ ok: false, message: err instanceof Error ? err.message : "Could not submit bill" });
    } finally {
      setSubmitBusy(false);
    }
  };

  // Offers & Discounts Module: applies the selected offer to this session's
  // bill and refreshes the receipt so Billing Summary updates immediately.
  // Never automatic — only fires when the admin explicitly clicks "Apply
  // Offer". Validation (offer active / minimum order amount) is enforced
  // server-side; any failure just surfaces as a message here, the bill is
  // left untouched.
  const handleApplyOffer = async () => {
    if (!selectedOfferId || printBusy) return;
    setOfferBusy(true);
    setOfferNotice(null);
    try {
      const { session: updatedSession, receipt: updatedReceipt } = await applySessionOffer(tableId, selectedOfferId);
      setReceipt(updatedReceipt);
      setTable((t) => (t ? { ...t, activeSession: updatedSession } : t));
      setSelectedOfferId("");
      onChanged();
    } catch (err) {
      setOfferNotice({ ok: false, message: err instanceof Error ? err.message : "Could not apply offer" });
    } finally {
      setOfferBusy(false);
    }
  };

  // Offers & Discounts Module: removes whatever offer is applied and
  // restores the original (undiscounted) bill.
  const handleRemoveOffer = async () => {
    if (printBusy) return;
    setOfferBusy(true);
    setOfferNotice(null);
    try {
      const { session: updatedSession, receipt: updatedReceipt } = await removeSessionOffer(tableId);
      setReceipt(updatedReceipt);
      setTable((t) => (t ? { ...t, activeSession: updatedSession } : t));
      onChanged();
    } catch (err) {
      setOfferNotice({ ok: false, message: err instanceof Error ? err.message : "Could not remove offer" });
    } finally {
      setOfferBusy(false);
    }
  };

  // Reprint KOT — Table Details Drawer header button.
  //
  // This does NOT generate a new KOT or write anything to the database. It
  // simply re-runs the same two steps that already happen automatically
  // when an order is placed (see KotAutoPrintProvider.tsx):
  //   1. buildEscPosKOT/splitKOTItemsByPrinter (frontend/src/lib/printer/kot.ts)
  //   2. usePrinterStore().printKOT, which resolves the configured Kitchen
  //      Printer / Counter Printer and sends each ticket via QZ Tray.
  // The `orders` array here is exactly what fetchSessionOrders already
  // loaded for this drawer — the same Order documents (with each item's
  // categoryTitle) that were used to print the KOT the first time — so
  // this is a byte-for-byte reprint of the existing KOT(s) for the
  // session's active (non-cancelled) orders, not a new document.
  const handlePrintKot = async () => {
    setKotBusy(true);
    setKotNotice(null);
    try {
      const activeOrders = orders.filter((o) => o.status !== "cancelled");
      if (activeOrders.length === 0) {
        setKotNotice({ ok: false, message: "No active orders for this session to reprint." });
        return;
      }

      const results = await Promise.all(
        activeOrders.map(async (order) => {
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
          const result: KotPrintResult = await printKotViaQz(kot);
          return { orderId: order.orderId, result };
        })
      );

      const failures = results.flatMap(({ orderId, result }) => [
        !result.kitchen.ok ? `Order #${orderId.slice(-6)} · Kitchen Printer — ${result.kitchen.error}` : null,
        !result.counter.ok ? `Order #${orderId.slice(-6)} · Counter Printer — ${result.counter.error}` : null,
      ].filter((m): m is string => Boolean(m)));

      if (failures.length === 0) {
        setKotNotice({
          ok: true,
          message: results.length > 1 ? `KOT reprinted for ${results.length} orders.` : "KOT reprinted successfully.",
        });
      } else {
        setKotNotice({ ok: false, message: failures.join(" · ") });
      }
    } catch (err) {
      setKotNotice({ ok: false, message: err instanceof PrinterError ? err.message : "Could not reprint KOT." });
    } finally {
      setKotBusy(false);
    }
  };

  if (loading || !table) {
    return (
      <Modal title="Table" onClose={onClose}>
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
          Loading…
        </p>
      </Modal>
    );
  }

  const meta = statusMeta(table.status);
  const session = table.activeSession;
  const reservation = table.activeReservation;

  const items = aggregateReceiptItems(receipt);
  const breakdown = receipt ? getGstBreakdown(receipt) : null;
  const activeOrderCount = orders.filter((o) => o.status !== "cancelled").length;
  const orderStatus = receipt?.session.orderStatus ?? overallOrderStatus(orders);

  // Print Bill has no dependency on the Kitchen Dashboard or a "Served"
  // status — the Kitchen Dashboard has been removed from the project.
  // The waiter can print the bill the moment there's an active session
  // with at least one non-cancelled order, whenever they're ready.
  // Printing the bill only generates/prints the receipt and keeps payment
  // status Pending — it never closes the session, frees the table, marks
  // the invoice paid, or touches revenue. Those only happen once the
  // waiter completes Settlement (see collectPayment in
  // sessionPaymentController.js).
  const canPrintBill = Boolean(session) && activeOrderCount > 0;
  const printDisabledReason = !session
    ? null
    : activeOrderCount === 0
    ? "No orders yet — nothing to bill."
    : null;
  const hasBeenPrinted = Boolean(session?.billPrinted || (receipt?.session.printCount ?? 0) > 0);

  // Offers & Discounts Module: an offer can only be applied/removed while
  // the bill is still being put together — once it's been submitted to
  // Settlements or paid, it's locked (mirrors the backend guard in
  // applyOffer/removeOffer).
  const billLocked = Boolean(session?.billSubmitted || session?.paymentStatus === "paid");
  const activeOffers = offers.filter((o) => o.isActive);

  // Mirrors ADMIN_ORDERABLE_TABLE_STATUSES in
  // backend/src/services/orderService.js — a table can take a manually
  // created order while it's "available" (no session yet — one is opened
  // automatically) or "occupied" (attaches to the existing active
  // session). Reserved / billing / cleaning / out-of-service tables can't.
  const canCreateOrder = table.status === "available" || table.status === "occupied";

  return (
    <Modal
      title={table.label}
      titleNode={
        <ModalHeader
          title={table.label}
          onClose={onClose}
          actions={
            <>
              {session && (
                <button
                  type="button"
                  onClick={handlePrintKot}
                  disabled={kotBusy || activeOrderCount === 0}
                  title={activeOrderCount === 0 ? "No active orders to reprint" : "Reprint the KOT for this session"}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${adminColors.border}`,
                    background: "#FFFFFF",
                    color: kotBusy || activeOrderCount === 0 ? adminColors.textSecondary : adminColors.text,
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: kotBusy || activeOrderCount === 0 ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    opacity: kotBusy || activeOrderCount === 0 ? 0.6 : 1,
                  }}
                >
                  <Printer size={13} />
                  {kotBusy ? "Printing…" : "Print KOT"}
                </button>
              )}

              {canCreateOrder && (
                <button
                  type="button"
                  onClick={() => setShowCreateOrder(true)}
                  title={`Create a new order for ${table.label}`}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "6px 12px",
                    borderRadius: 8,
                    border: `1px solid ${adminColors.primary}`,
                    background: adminColors.primary,
                    color: "#FFFFFF",
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  <Plus size={13} />
                  Create Order
                </button>
              )}
            </>
          }
        />
      }
      onClose={onClose}
      maxWidth={session ? 520 : 440}
    >
      <Badge color={meta.color}>
        <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: meta.color }} />
        {meta.label}
      </Badge>

      {/* Occupied / Billing: full restaurant-billing interface */}
      {session && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Restaurant Information */}
          {receipt?.restaurant && (
            <Section title="Restaurant Information">
              <DetailRow label="Restaurant Name" value={receipt.restaurant.name || "—"} />
              {receipt.restaurant.gstNumber && <DetailRow label="GST Number" value={receipt.restaurant.gstNumber} />}
            </Section>
          )}

          {/* Billing Information */}
          <Section title="Billing Information">
            <DetailRow
              label="Order ID"
              value={orders.length ? orders.map((o) => `#${o.orderId.slice(-6)}`).join(", ") : "—"}
            />
            <DetailRow label="Table Number" value={table.label} />
            <DetailRow label="Date" value={receipt ? new Date(receipt.generatedAt).toLocaleDateString("en-IN") : "—"} />
            <DetailRow label="Time" value={receipt ? formatTime(receipt.generatedAt) : "—"} />
            <DetailRow label="Session Start Time" value={formatTime(session.sessionStart)} />
          </Section>

          {/* Customer Information */}
          <Section title="Customer Information">
            <DetailRow label="Customer Name" value={session.customerName || "Walk-in"} />
            <DetailRow label="Phone Number" value={session.phoneNumber || "—"} />
          </Section>

          {/* Ordered Items */}
          <Section title="Ordered Items">
            {items.length === 0 && (
              <p style={{ ...bodyText(12), color: adminColors.textSecondary, margin: 0 }}>No orders yet.</p>
            )}
            {items.map((line) => (
              <div key={`${line.name}-${line.price}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span style={{ ...bodyText(12), color: adminColors.text }}>
                  {line.quantity} × {line.name}
                  <span style={{ color: adminColors.textSecondary }}> ({formatCurrency(line.price)} each)</span>
                </span>
                <span style={{ ...bodyText(12, 700) }}>{formatCurrency(line.price * line.quantity)}</span>
              </div>
            ))}
          </Section>

          {/* Offers & Discounts */}
          <Section title="Offers & Discounts">
            {billLocked ? (
              <p style={{ ...bodyText(12), color: adminColors.textSecondary, margin: 0 }}>
                {session.appliedOffer ? `Applied: ${session.appliedOffer.name}` : "No offer was applied to this bill."}
              </p>
            ) : session.appliedOffer ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <span
                  style={{
                    ...bodyText(13, 700),
                    color: adminColors.success,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Check size={14} /> {session.appliedOffer.name}
                </span>
                <SecondaryButton danger onClick={handleRemoveOffer} disabled={offerBusy || printBusy}>
                  {offerBusy ? "Removing…" : "Remove"}
                </SecondaryButton>
              </div>
            ) : activeOffers.length === 0 ? (
              <p style={{ ...bodyText(12), color: adminColors.textSecondary, margin: 0 }}>No active offers available.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <Select
                  label="Select Offer"
                  value={selectedOfferId}
                  onChange={setSelectedOfferId}
                  options={[
                    { value: "", label: "Select Active Offer" },
                    ...activeOffers.map((o) => ({ value: o.id, label: `${o.name} — ${discountValueLabel(o)}` })),
                  ]}
                />
                <PrimaryButton onClick={handleApplyOffer} disabled={!selectedOfferId || offerBusy || printBusy}>
                  {offerBusy ? "Applying…" : "Apply Offer"}
                </PrimaryButton>
              </div>
            )}
            {offerNotice && (
              <p style={{ ...bodyText(12, 600), color: offerNotice.ok ? adminColors.success : adminColors.danger, margin: 0 }}>
                {offerNotice.message}
              </p>
            )}
          </Section>

          {/* Billing Summary */}
          <Section title="Billing Summary">
            <DetailRow label="Subtotal" value={formatCurrency(breakdown?.subtotal ?? session.currentBill)} />
            {Boolean(receipt?.discount) && (
              <DetailRow
                label={session.appliedOffer ? `Discount (${session.appliedOffer.name})` : "Discount"}
                value={`-${formatCurrency(receipt?.discount ?? 0)}`}
              />
            )}
            {breakdown?.gstEnabled !== false && (
              <>
                <DetailRow label="Taxable Amount" value={formatCurrency(breakdown?.taxableAmount ?? 0)} />
                <DetailRow
                  label={`CGST${breakdown ? ` (${getGstRateLabel(breakdown.cgst, breakdown.taxableAmount)})` : ""}`}
                  value={formatCurrency(breakdown?.cgst ?? 0)}
                />
                <DetailRow
                  label={`SGST${breakdown ? ` (${getGstRateLabel(breakdown.sgst, breakdown.taxableAmount)})` : ""}`}
                  value={formatCurrency(breakdown?.sgst ?? 0)}
                />
                {Boolean(breakdown?.igst) && (
                  <DetailRow label="IGST" value={formatCurrency(breakdown?.igst ?? 0)} />
                )}
              </>
            )}
            <div style={{ borderTop: `1px solid ${adminColors.border}`, margin: "2px 0" }} />
            <DetailRow label="Grand Total" value={formatCurrency(breakdown?.grandTotal ?? session.currentBill)} bold />
          </Section>

        </div>
      )}

      {/* Reserved: reservation details */}
      {reservation && !session && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <DetailRow label="Customer Name" value={reservation.customerName} />
          <DetailRow label="Phone Number" value={reservation.phoneNumber} />
          <DetailRow label="Reservation" value={`${reservation.reservationDate} · ${reservation.reservationTime}`} />
          <DetailRow label="Guests" value={String(reservation.guestCount)} />
          <DetailRow label="Expected Duration" value={`${reservation.expectedDuration} min`} />
          {reservation.specialNotes && <DetailRow label="Notes" value={reservation.specialNotes} />}
        </div>
      )}

      {table.status === "available" && (
        <p style={{ ...bodyText(13), color: adminColors.textSecondary, margin: 0 }}>
          This table is free. Customers can order by scanning its QR code, or use the &quot;+ Reserve Table&quot; button above to book it for a phone/walk-in reservation.
        </p>
      )}

      {error && <p style={{ color: adminColors.danger, fontSize: 12, ...bodyText(12), margin: 0 }}>{error}</p>}

      {/* Billing Actions — primary/secondary/danger, per spec */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {session && (
          <>
            <TablePrimaryButton onClick={handlePrintBill} disabled={printBusy || offerBusy || !canPrintBill}>
              <Printer size={14} /> {hasBeenPrinted ? "Reprint Bill" : "Print Bill"}
            </TablePrimaryButton>


            {session.billSubmitted || table.status === "awaiting_payment" ? (
              <Badge color={adminColors.primary}>
                <Receipt size={11} /> Awaiting Payment in Settlements
              </Badge>
            ) : (
              <TablePrimaryButton onClick={handleSubmitBill} disabled={submitBusy || busy}>
                <Receipt size={14} /> {submitBusy ? "Submitting…" : "Submit Bill"}
              </TablePrimaryButton>
            )}
          </>
        )}

        {reservation && table.status === "reserved" && (
          <>
            <TablePrimaryButton onClick={() => run(() => checkInReservation(reservation.reservationId))} disabled={busy}>
              Check In
            </TablePrimaryButton>
            <SecondaryButton onClick={() => run(() => markReservationNoShow(reservation.reservationId))}>
              No Show
            </SecondaryButton>
            <SecondaryButton danger onClick={() => run(() => cancelReservation(reservation.reservationId))}>
              Cancel Reservation
            </SecondaryButton>
          </>
        )}

        {!session && table.status === "cleaning" && (
          <TablePrimaryButton onClick={() => run(() => markTableAvailable(table._id))} disabled={busy}>
            Mark Available
          </TablePrimaryButton>
        )}

        {!session && table.status === "out_of_service" && (
          <TablePrimaryButton onClick={() => run(() => markTableAvailable(table._id))} disabled={busy}>
            Mark Available
          </TablePrimaryButton>
        )}
      </div>

      {printDisabledReason && session && (
        <p style={{ ...bodyText(11), color: adminColors.textSecondary, margin: "-6px 0 0" }}>{printDisabledReason}</p>
      )}

      {printModal && (
        <ThermalReceipt
          heading={printModal.heading}
          receipt={printModal.receipt}
          qzPrinted={printModal.qzPrinted}
          onClose={() => setPrintModal(null)}
        />
      )}

      {showCreateOrder && (
        <TableCreateOrderScreen
          restaurantId={table.restaurantId}
          tableId={table._id}
          tableLabel={table.label}
          onClose={() => setShowCreateOrder(false)}
          onCreated={async () => {
            // Refresh Ordered Items / Order Count / Total Amount / Kitchen
            // Status right here in the same Table Details popup, and let
            // the Table Grid behind it refresh too — the dining session
            // stays exactly as it was, just with the new order attached.
            await load();
            onChanged();
          }}
        />
      )}
    </Modal>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
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
          ...bodyText(12, 700),
          color: adminColors.text,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        {title}
      </span>
      {children}
    </div>
  );
}

function DetailRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ ...bodyText(12), color: adminColors.textSecondary }}>{label}</span>
      <span style={{ ...bodyText(12, bold ? 800 : 600), color: adminColors.text, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function bodyText(size: number, weight = 400): React.CSSProperties {
  return {
    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
    fontSize: size,
    fontWeight: weight,
  };
}