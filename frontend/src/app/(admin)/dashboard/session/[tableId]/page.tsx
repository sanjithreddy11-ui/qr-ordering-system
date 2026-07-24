"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, CheckCircle2, ClipboardList } from "lucide-react";
import { adminColors, Card, SecondaryButton } from "@/components/admin/ui";
import { getSocket } from "@/lib/socket";
import {
  fetchTableDetails,
  fetchSessionOrders,
  fetchSessionReceipt,
  setSessionPaymentMethod,
  printSessionBill,
  collectSessionPayment,
  type TableGridItem,
  type RecentOrder,
  type ReceiptData,
  type PaymentMethod,
} from "@/lib/admin-api";
import { statusMeta, formatCurrency, formatDuration, formatTime } from "@/components/admin/tables/tableStatus";
import { TablePrimaryButton } from "@/components/admin/tables/tableButtons";
import ThermalReceipt from "@/components/admin/tables/ThermalReceipt";

const RESTAURANT_ID = "lifafa";

const LIVE_EVENTS = [
  "new-order",
  "order-status-updated",
  "sessionPaymentUpdated",
  "sessionEnded",
  "tableBilling",
];

export default function DiningSessionPage() {
  const { tableId } = useParams<{ tableId: string }>();
  const router = useRouter();

  const [table, setTable] = useState<TableGridItem | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [receipt, setReceipt] = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [transactionId, setTransactionId] = useState("");
  const [printModal, setPrintModal] = useState<{ heading: string; receipt: ReceiptData } | null>(null);

  // Populated once collect-payment succeeds. Kept separate from `table` /
  // `receipt` above because collecting payment immediately closes the
  // session and frees the table server-side — refetching table details at
  // that point would show "no active session", losing the very data we
  // want to display + let the cashier print a final receipt for.
  const [closedReceipt, setClosedReceipt] = useState<ReceiptData | null>(null);

  const load = useCallback(async () => {
    try {
      const { table: t, activeSession } = await fetchTableDetails(tableId);
      setTable({ ...(t as TableGridItem), activeSession, activeReservation: null });

      if (activeSession) {
        const [{ orders: sessionOrders }, receiptResult] = await Promise.all([
          fetchSessionOrders(activeSession.sessionId),
          fetchSessionReceipt(tableId).catch(() => ({ receipt: null as ReceiptData | null })),
        ]);
        setOrders(sessionOrders);
        setReceipt(receiptResult.receipt);
      } else {
        setOrders([]);
        setReceipt(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load session");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: re-fetch on any order/payment event for this restaurant. Simple
  // full refetch, same reasoning as the Tables grid — cheap at this scale
  // and can't drift out of sync.
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-tables", RESTAURANT_ID);
    const handler = () => load();
    LIVE_EVENTS.forEach((evt) => socket.on(evt, handler));
    return () => {
      LIVE_EVENTS.forEach((evt) => socket.off(evt, handler));
      socket.emit("leave-tables", RESTAURANT_ID);
    };
  }, [load]);

  // Elapsed time ticks every 30s without a refetch.
  const [, forceTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const session = table?.activeSession;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const handleChoosePaymentMethod = (method: PaymentMethod) => {
    setTransactionId("");
    run(() => setSessionPaymentMethod(tableId, method));
  };

  const handlePrintBill = async () => {
    setBusy(true);
    setError(null);
    try {
      const { receipt: r } = await printSessionBill(tableId);
      await load();
      setPrintModal({ heading: "Bill (Before Payment)", receipt: r });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not print bill");
    } finally {
      setBusy(false);
    }
  };

  const handleCollectPayment = async () => {
    setBusy(true);
    setError(null);
    try {
      const needsTxnId = session?.paymentMethod === "upi" || session?.paymentMethod === "card";
      const { receipt: r } = await collectSessionPayment(tableId, needsTxnId ? transactionId || undefined : undefined);
      setClosedReceipt(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not collect payment");
    } finally {
      setBusy(false);
    }
  };

  const meta = statusMeta(table?.status);

  if (loading) {
    return <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>Loading session…</p>;
  }

  // Payment was just collected — show the closing confirmation instead of
  // the (now stale) live session view.
  if (closedReceipt) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <BackButton router={router} />
        <Card style={{ textAlign: "center", padding: 40 }}>
          <CheckCircle2 size={40} color={adminColors.success} style={{ marginBottom: 12 }} />
          <h2 style={{ ...textStyle(20, 700), margin: "0 0 6px" }}>Payment Collected</h2>
          <p style={{ ...textStyle(13), color: adminColors.textSecondary, margin: "0 0 20px" }}>
            {closedReceipt.table.label} is now available for the next guest.
          </p>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <TablePrimaryButton onClick={() => setPrintModal({ heading: "Receipt", receipt: closedReceipt })}>
              <Printer size={15} /> Print Receipt
            </TablePrimaryButton>
            <SecondaryButton onClick={() => router.push("/dashboard/tables")}>Back to Tables</SecondaryButton>
          </div>
        </Card>

        {printModal && (
          <ThermalReceipt heading={printModal.heading} receipt={printModal.receipt} onClose={() => setPrintModal(null)} />
        )}
      </div>
    );
  }

  if (!table || !session) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <BackButton router={router} />
        <Card>
          <p style={{ ...textStyle(13), color: adminColors.textSecondary, margin: 0 }}>
            This table has no active dining session right now.
          </p>
        </Card>
      </div>
    );
  }

  const isPaid = session.paymentStatus === "paid";

  return (
    <div style={{ maxWidth: 720, margin: "0 auto" }}>
      <BackButton router={router} />

      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
          <div>
            <div style={{ ...textStyle(12), color: adminColors.textSecondary }}>
              {receipt?.restaurant?.name || "Restaurant"}
            </div>
            <h1 style={{ ...textStyle(24, 800), margin: "2px 0 0" }}>{table.label}</h1>
          </div>
          <span
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              background: `${meta.color}1A`,
              color: meta.color,
              ...textStyle(12, 700),
            }}
          >
            {meta.label}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 }}>
          <Info label="Session Start" value={formatTime(session.sessionStart)} />
          <Info label="Elapsed Time" value={formatDuration(session.sessionStart)} />
          <Info label="Customer Name" value={session.customerName || "Walk-in"} />
          <Info label="Customer Phone" value={session.phoneNumber || "—"} />
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionTitle icon={<ClipboardList size={15} />}>Complete Order History</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {orders.length === 0 && (
            <p style={{ ...textStyle(13), color: adminColors.textSecondary, margin: 0 }}>No orders yet.</p>
          )}
          {orders.map((o, i) => (
            <div key={o.orderId} style={{ border: `1px solid ${adminColors.border}`, borderRadius: 10, padding: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ ...textStyle(13, 700) }}>
                  Order #{i + 1} · {formatTime(o.placedAt)}
                </span>
                <span style={{ ...textStyle(13, 700) }}>{formatCurrency(o.totalAmount)}</span>
              </div>
              {o.items?.map((it, idx) => (
                <div
                  key={idx}
                  style={{ display: "flex", justifyContent: "space-between", ...textStyle(12), color: adminColors.textSecondary }}
                >
                  <span>
                    {it.quantity} {it.item.name}
                  </span>
                  <span>{formatCurrency(it.item.price * it.quantity)}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <SectionTitle>Running Bill</SectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>
          <BillRow label="Subtotal" value={formatCurrency(receipt?.subtotal ?? 0)} />
          <BillRow label="GST" value={formatCurrency(receipt?.gst ?? 0)} />
          <div style={{ borderTop: `1px solid ${adminColors.border}`, margin: "4px 0" }} />
          <BillRow label="Grand Total" value={formatCurrency(receipt?.grandTotal ?? session.currentBill)} bold />
        </div>
      </Card>

      {error && <p style={{ ...textStyle(12), color: adminColors.danger, marginBottom: 12 }}>{error}</p>}

      <Card>
        <SectionTitle>Payment</SectionTitle>

        {!isPaid && (
          <div style={{ display: "flex", gap: 8, margin: "10px 0 16px" }}>
            {(["upi", "card", "cash"] as PaymentMethod[]).map((m) => (
              <button
                key={m}
                disabled={busy}
                onClick={() => handleChoosePaymentMethod(m)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: `1px solid ${session.paymentMethod === m ? adminColors.primary : adminColors.border}`,
                  background: session.paymentMethod === m ? `${adminColors.primary}1A` : "#FFFFFF",
                  color: session.paymentMethod === m ? adminColors.primary : adminColors.text,
                  ...textStyle(13, 700),
                  cursor: busy ? "not-allowed" : "pointer",
                }}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
        )}

        {isPaid && (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
            <BillRow label="Payment Status" value="Paid" />
            <BillRow label="Payment Method" value={(session.paymentMethod || "—").toUpperCase()} />
            {session.transactionId && <BillRow label="Transaction ID" value={session.transactionId} />}
            {session.paidAt && <BillRow label="Paid At" value={formatTime(session.paidAt)} />}
          </div>
        )}

        {!isPaid && session.paymentMethod === "upi" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BillRow label="Payment Status" value="Pending" />
            <input
              value={transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              placeholder="Enter UPI transaction ID"
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: `1px solid ${adminColors.border}`,
                ...textStyle(13),
              }}
            />
            <TablePrimaryButton disabled={busy || !transactionId.trim()} onClick={handleCollectPayment}>
              Collect Payment
            </TablePrimaryButton>
          </div>
        )}

        {!isPaid && session.paymentMethod === "card" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <BillRow label="Payment Status" value="Card Paid" />
            <TablePrimaryButton disabled={busy} onClick={handleCollectPayment}>
              Collect Payment
            </TablePrimaryButton>
          </div>
        )}

        {!isPaid && session.paymentMethod === "cash" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button
              disabled={busy}
              onClick={handlePrintBill}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                padding: "18px 0",
                borderRadius: 12,
                border: "none",
                background: adminColors.primary,
                color: "#FFFFFF",
                ...textStyle(16, 800),
                cursor: busy ? "not-allowed" : "pointer",
              }}
            >
              <Printer size={20} /> Print Bill
            </button>
            <p style={{ ...textStyle(12), color: adminColors.textSecondary, margin: 0 }}>
              Print the bill for the customer before collecting cash.
            </p>
            <TablePrimaryButton disabled={busy || !session.billPrinted} onClick={handleCollectPayment}>
              Collect Payment
            </TablePrimaryButton>
          </div>
        )}
      </Card>

      {printModal && (
        <ThermalReceipt heading={printModal.heading} receipt={printModal.receipt} onClose={() => setPrintModal(null)} />
      )}
    </div>
  );
}

function BackButton({ router }: { router: ReturnType<typeof useRouter> }) {
  return (
    <button
      onClick={() => router.push("/dashboard/tables")}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        border: "none",
        background: "transparent",
        color: adminColors.textSecondary,
        cursor: "pointer",
        marginBottom: 16,
        ...textStyle(13, 600),
      }}
    >
      <ArrowLeft size={15} /> Back to Tables
    </button>
  );
}

function SectionTitle({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, ...textStyle(14, 700) }}>
      {icon}
      {children}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...textStyle(11), color: adminColors.textSecondary }}>{label}</div>
      <div style={{ ...textStyle(13, 700) }}>{value}</div>
    </div>
  );
}

function BillRow({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ ...textStyle(13, bold ? 700 : 400), color: bold ? adminColors.text : adminColors.textSecondary }}>
        {label}
      </span>
      <span style={{ ...textStyle(13, 700) }}>{value}</span>
    </div>
  );
}

function textStyle(size: number, weight = 400): React.CSSProperties {
  return {
    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
    fontSize: size,
    fontWeight: weight,
  };
}
