"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  TrendingUp,
  Clock3,
  Banknote,
  Smartphone,
  Users,
  Search,
  CheckCircle2,
} from "lucide-react";
import { PageHeader, Card, Badge, SecondaryButton, adminColors } from "@/components/admin/ui";
import { getSocket } from "@/lib/socket";
import {
  fetchSettlements,
  fetchSettlementHistory,
  fetchCreditCustomers,
  fetchSettlementAnalytics,
  clearCreditBalance,
  type Settlement,
  type SettlementPaymentStatus,
  type SettlementPaymentMethod,
  type SettlementCollectionStatus,
  type SettlementHistoryRange,
  type CreditCustomer,
  type SettlementAnalytics,
} from "@/lib/admin-api";
import CollectPaymentModal from "@/components/admin/settlements/CollectPaymentModal";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const LIVE_EVENTS = [
  "settlementCreated",
  "settlementUpdated",
  "tableAwaitingPayment",
  "tableAvailable",
  "sessionEnded",
];

type Tab = "pending" | "credits" | "history" | "reports";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const STATUS_COLOR: Record<SettlementPaymentStatus, string> = {
  pending: adminColors.warning,
  paid: adminColors.success,
  credit: "#7C3AED",
  cancelled: adminColors.textSecondary,
};

const STATUS_LABEL: Record<SettlementPaymentStatus, string> = {
  pending: "Pending",
  paid: "Paid",
  credit: "Credit",
  cancelled: "Cancelled",
};

// Payment Collection Tracking: how much of the bill has actually been
// received, independent of STATUS_COLOR/STATUS_LABEL above (which are the
// workflow state — pending/paid/credit/cancelled).
const COLLECTION_COLOR: Record<SettlementCollectionStatus, string> = {
  PAID: adminColors.success,
  PARTIALLY_PAID: adminColors.warning,
  UNPAID: adminColors.danger,
};

const COLLECTION_LABEL: Record<SettlementCollectionStatus, string> = {
  PAID: "Paid",
  PARTIALLY_PAID: "Partially Paid",
  UNPAID: "Unpaid",
};

const METHOD_LABEL: Record<SettlementPaymentMethod, string> = {
  cash: "Cash",
  upi: "UPI",
  card: "Card",
  bank_transfer: "Bank Transfer",
  credit: "Credit",
};

// Split Payments: render a settlement's payment breakdown for table cells,
// e.g. "Cash ₹200 + UPI ₹344". Falls back to "—" before collection.
function formatPaymentBreakdown(s: Settlement): string {
  if (!s.paymentMethods || s.paymentMethods.length === 0) return "—";
  return s.paymentMethods.map((p) => `${METHOD_LABEL[p.method]} ${formatCurrency(p.amount)}`).join(" + ");
}

export default function SettlementsPage() {
  const [tab, setTab] = useState<Tab>("pending");
  const [analytics, setAnalytics] = useState<SettlementAnalytics | null>(null);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  const loadAnalytics = useCallback(async () => {
    try {
      setAnalytics(await fetchSettlementAnalytics(RESTAURANT_ID, "today"));
    } catch {
      // Non-fatal — overview cards just stay blank.
    }
  }, []);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-tables", RESTAURANT_ID);
    const handler = () => loadAnalytics();
    LIVE_EVENTS.forEach((evt) => socket.on(evt, handler));
    return () => {
      LIVE_EVENTS.forEach((evt) => socket.off(evt, handler));
      socket.emit("leave-tables", RESTAURANT_ID);
    };
  }, [loadAnalytics]);

  return (
    <div>
      <PageHeader title="Settlements" description="Bill submission and payment collection, separate from billing" />

      {/* ---- Overview cards ---- */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 16, marginBottom: 20 }}>
        <StatCard icon={TrendingUp} label="Today's Sales" value={formatCurrency(analytics?.todaysSales ?? 0)} accent={adminColors.primary} />
        <StatCard icon={Clock3} label="Pending Collection" value={formatCurrency(analytics?.pendingCollection ?? 0)} accent={adminColors.warning} />
        <StatCard icon={Banknote} label="Cash Collected" value={formatCurrency(analytics?.cashCollected ?? 0)} accent={adminColors.success} />
        <StatCard icon={Smartphone} label="Online Payments" value={formatCurrency(analytics?.onlinePayments ?? 0)} accent="#7C3AED" />
        <StatCard icon={Users} label="Credit Customers" value={String(analytics?.creditCustomers ?? 0)} accent={adminColors.danger} />
      </div>

      {/* ---- Tabs ---- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(
          [
            { key: "pending", label: "Settlements" },
            { key: "credits", label: "Credit Customers" },
            { key: "history", label: "Settlement History" },
            { key: "reports", label: "Reports" },
          ] as { key: Tab; label: string }[]
        ).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${tab === t.key ? adminColors.primary : adminColors.border}`,
              background: tab === t.key ? adminColors.primary : "#FFFFFF",
              color: tab === t.key ? "#FFFFFF" : adminColors.text,
              fontFamily: bodyFont,
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "pending" && <SettlementsTab onCollect={(id) => setCollectingId(id)} />}
      {tab === "credits" && <CreditCustomersTab onChanged={loadAnalytics} />}
      {tab === "history" && <HistoryTab />}
      {tab === "reports" && <ReportsTab analytics={analytics} />}

      {collectingId && (
        <CollectPaymentModal
          settlementId={collectingId}
          onClose={() => setCollectingId(null)}
          onCollected={() => {
            setCollectingId(null);
            loadAnalytics();
          }}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Settlement Table (Section 4) — every submitted bill, searchable and
// filterable by status/method (Section 11).
// ---------------------------------------------------------------------------
function SettlementsTab({ onCollect }: { onCollect: (settlementId: string) => void }) {
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<SettlementPaymentStatus | "">("");
  const [method, setMethod] = useState<SettlementPaymentMethod | "">("");
  const [collectionStatus, setCollectionStatus] = useState<SettlementCollectionStatus | "">("");

  const load = useCallback(async () => {
    try {
      const data = await fetchSettlements(RESTAURANT_ID, {
        search: search || undefined,
        status: status || undefined,
        method: method || undefined,
        collectionStatus: collectionStatus || undefined,
      });
      setSettlements(data);
    } finally {
      setLoading(false);
    }
  }, [search, status, method, collectionStatus]);

  useEffect(() => {
    load();
  }, [load]);

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

  return (
    <Card>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16, alignItems: "center" }}>
        <div style={{ position: "relative", flex: "1 1 240px" }}>
          <Search size={14} color={adminColors.textSecondary} style={{ position: "absolute", left: 10, top: 10 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search bill, customer, phone, table, transaction ID…"
            style={{ ...inputStyle, paddingLeft: 30, width: "100%" }}
          />
        </div>
        <select value={status} onChange={(e) => setStatus(e.target.value as SettlementPaymentStatus | "")} style={inputStyle}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="credit">Credit</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={method} onChange={(e) => setMethod(e.target.value as SettlementPaymentMethod | "")} style={inputStyle}>
          <option value="">All Methods</option>
          <option value="cash">Cash</option>
          <option value="upi">UPI</option>
          <option value="card">Card</option>
          <option value="bank_transfer">Bank Transfer</option>
          <option value="credit">Credit</option>
        </select>
        <select
          value={collectionStatus}
          onChange={(e) => setCollectionStatus(e.target.value as SettlementCollectionStatus | "")}
          style={inputStyle}
        >
          <option value="">All Collection Statuses</option>
          <option value="PAID">Paid</option>
          <option value="PARTIALLY_PAID">Partially Paid</option>
          <option value="UNPAID">Unpaid</option>
        </select>
      </div>

      {loading && <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>Loading…</p>}
      {!loading && settlements.length === 0 && (
        <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>No settlements match these filters.</p>
      )}

      {!loading && settlements.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Bill No.", "Table", "Customer", "Phone", "Grand Total", "Received", "Remaining", "Method", "Status", "Collection", "Submitted", "Action"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.settlementId}>
                  <td style={tdStyle}>{s.billNumber}</td>
                  <td style={tdStyle}>{s.tableLabel}</td>
                  <td style={tdStyle}>{s.customerName || "Walk-in"}</td>
                  <td style={tdStyle}>{s.phoneNumber || "—"}</td>
                  <td style={tdStyle}>{formatCurrency(s.grandTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(s.totalReceived)}</td>
                  <td style={tdStyle}>{formatCurrency(Math.max(s.remainingAmount, 0))}</td>
                  <td style={tdStyle}>{formatPaymentBreakdown(s)}</td>
                  <td style={tdStyle}>
                    <Badge color={STATUS_COLOR[s.paymentStatus]}>{STATUS_LABEL[s.paymentStatus]}</Badge>
                  </td>
                  <td style={tdStyle}>
                    <Badge color={COLLECTION_COLOR[s.collectionStatus]}>{COLLECTION_LABEL[s.collectionStatus]}</Badge>
                  </td>
                  <td style={tdStyle}>{formatDateTime(s.submittedAt)}</td>
                  <td style={tdStyle}>
                    {s.paymentStatus === "pending" ? (
                      <SecondaryButton onClick={() => onCollect(s.settlementId)}>Collect</SecondaryButton>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Credit Customers (Section 9)
// ---------------------------------------------------------------------------
function CreditCustomersTab({ onChanged }: { onChanged: () => void }) {
  const [customers, setCustomers] = useState<CreditCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearingPhone, setClearingPhone] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCustomers(await fetchCreditCustomers(RESTAURANT_ID));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleClear = async (phone: string) => {
    setClearingPhone(phone);
    try {
      await clearCreditBalance(RESTAURANT_ID, phone);
      await load();
      onChanged();
    } finally {
      setClearingPhone(null);
    }
  };

  return (
    <Card>
      <p style={{ ...textStyle(13), color: adminColors.textSecondary, marginTop: 0, marginBottom: 16 }}>
        Customers with an outstanding balance from a Credit (Pay Later) settlement.
      </p>

      {loading && <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>Loading…</p>}
      {!loading && customers.length === 0 && (
        <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>No customers currently owe an outstanding balance.</p>
      )}

      {!loading && customers.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Customer", "Phone", "Outstanding Balance", "Last Visit", "Due Date", "Status", "Action"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.phoneNumber}>
                  <td style={tdStyle}>{c.customerName || "—"}</td>
                  <td style={tdStyle}>{c.phoneNumber}</td>
                  <td style={tdStyle}>{formatCurrency(c.outstandingBalance)}</td>
                  <td style={tdStyle}>{formatDateTime(c.lastVisit)}</td>
                  <td style={tdStyle}>{c.dueDate ? formatDateTime(c.dueDate) : "—"}</td>
                  <td style={tdStyle}>
                    <Badge color={c.status === "overdue" ? adminColors.danger : adminColors.warning}>
                      {c.status === "overdue" ? "Overdue" : "Pending"}
                    </Badge>
                  </td>
                  <td style={tdStyle}>
                    <SecondaryButton onClick={() => handleClear(c.phoneNumber)}>
                      {clearingPhone === c.phoneNumber ? "Clearing…" : "Receive Payment"}
                    </SecondaryButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Settlement History (Section 10)
// ---------------------------------------------------------------------------
const HISTORY_RANGES: { key: SettlementHistoryRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last Month" },
  { key: "custom", label: "Custom Date Range" },
];

function HistoryTab() {
  const [range, setRange] = useState<SettlementHistoryRange>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [settlements, setSettlements] = useState<Settlement[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSettlements(await fetchSettlementHistory(RESTAURANT_ID, range, from || undefined, to || undefined));
    } finally {
      setLoading(false);
    }
  }, [range, from, to]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <Card>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16, alignItems: "center" }}>
        {HISTORY_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() => setRange(r.key)}
            style={{
              padding: "6px 12px",
              borderRadius: 999,
              border: `1px solid ${range === r.key ? adminColors.primary : adminColors.border}`,
              background: range === r.key ? `${adminColors.primary}1A` : "#FFFFFF",
              color: range === r.key ? adminColors.primary : adminColors.textSecondary,
              fontFamily: bodyFont,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {r.label}
          </button>
        ))}
        {range === "custom" && (
          <>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} />
          </>
        )}
      </div>

      {loading && <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>Loading…</p>}
      {!loading && settlements.length === 0 && (
        <p style={{ ...textStyle(13), color: adminColors.textSecondary }}>No completed settlements in this range.</p>
      )}

      {!loading && settlements.length > 0 && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Bill No.", "Customer", "Table", "Grand Total", "Received", "Remaining", "Method", "Collected By", "Settlement Time", "Status", "Collection"].map((h) => (
                  <th key={h} style={thStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {settlements.map((s) => (
                <tr key={s.settlementId}>
                  <td style={tdStyle}>{s.billNumber}</td>
                  <td style={tdStyle}>{s.customerName || "Walk-in"}</td>
                  <td style={tdStyle}>{s.tableLabel}</td>
                  <td style={tdStyle}>{formatCurrency(s.grandTotal)}</td>
                  <td style={tdStyle}>{formatCurrency(s.totalReceived)}</td>
                  <td style={tdStyle}>{formatCurrency(Math.max(s.remainingAmount, 0))}</td>
                  <td style={tdStyle}>{formatPaymentBreakdown(s)}</td>
                  <td style={tdStyle}>{s.receivedBy || "—"}</td>
                  <td style={tdStyle}>{formatDateTime(s.settlementTime)}</td>
                  <td style={tdStyle}>
                    <Badge color={STATUS_COLOR[s.paymentStatus]}>{STATUS_LABEL[s.paymentStatus]}</Badge>
                  </td>
                  <td style={tdStyle}>
                    <Badge color={COLLECTION_COLOR[s.collectionStatus]}>{COLLECTION_LABEL[s.collectionStatus]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Reports (Section 12)
// ---------------------------------------------------------------------------
function ReportsTab({ analytics }: { analytics: SettlementAnalytics | null }) {
  const reports = analytics?.reports;
  const collection = analytics?.collectionSummary;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <Card>
        <div style={{ ...textStyle(14, 700), color: adminColors.text, marginBottom: 16 }}>Today&apos;s Summary</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <ReportStat label="Total Cash Collection" value={formatCurrency(reports?.totalCashCollection ?? 0)} />
          <ReportStat label="Total Online Collection" value={formatCurrency(reports?.totalOnlineCollection ?? 0)} />
          <ReportStat label="Total Credit Outstanding" value={formatCurrency(reports?.totalCreditOutstanding ?? 0)} />
          <ReportStat label="Pending Collections" value={formatCurrency(reports?.pendingCollections ?? 0)} />
          <ReportStat label="Today's Revenue" value={formatCurrency(reports?.todaysRevenue ?? 0)} />
          <ReportStat label="Split Payments" value={formatCurrency(reports?.splitPayments ?? 0)} />
        </div>
      </Card>

      <Card>
        <div style={{ ...textStyle(14, 700), color: adminColors.text, marginBottom: 16 }}>Payment Collection Status</div>
        <p style={{ ...textStyle(13), color: adminColors.textSecondary, marginTop: 0, marginBottom: 16 }}>
          Settlements completed in this range, by how much of the bill was actually received — a settlement can be
          completed (and count here) even when it isn&apos;t fully paid.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          <ReportStat label="Paid" value={String(collection?.paid ?? 0)} />
          <ReportStat label="Partially Paid" value={String(collection?.partiallyPaid ?? 0)} />
          <ReportStat label="Unpaid" value={String(collection?.unpaid ?? 0)} />
          <ReportStat label="Outstanding (Partial + Unpaid)" value={formatCurrency(collection?.outstandingFromPartialOrUnpaid ?? 0)} />
        </div>
      </Card>

      <Card>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <CheckCircle2 size={16} color={adminColors.textSecondary} />
          <span style={{ ...textStyle(14, 700), color: adminColors.text }}>Future-Ready</span>
        </div>
        <p style={{ ...textStyle(13), color: adminColors.textSecondary, margin: 0 }}>
          Refunds aren&apos;t tracked yet — this field is wired up and ready to populate once that flow is built.
          Partial Payments now reflects real outstanding amounts from Payment Collection Tracking.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginTop: 12 }}>
          <ReportStat label="Refunds" value={formatCurrency(reports?.refunds ?? 0)} />
          <ReportStat label="Partial Payments" value={formatCurrency(reports?.partialPayments ?? 0)} />
        </div>
      </Card>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ ...textStyle(11), color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ ...textStyle(20, 800), color: adminColors.text }}>{value}</div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  accent?: string;
}) {
  const color = accent ?? adminColors.primary;
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${color}14`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={color} strokeWidth={2} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ ...textStyle(11, 700), color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </div>
        <div style={{ ...textStyle(20, 800), color: adminColors.text }}>{value}</div>
      </div>
    </Card>
  );
}

const thStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 11,
  fontWeight: 700,
  color: adminColors.textSecondary,
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  padding: "8px 10px",
  borderBottom: `1px solid ${adminColors.border}`,
  whiteSpace: "nowrap",
  textAlign: "left",
};

const tdStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  padding: "10px 10px",
  borderBottom: `1px solid ${adminColors.border}`,
  whiteSpace: "nowrap",
};

const inputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${adminColors.border}`,
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  outline: "none",
  background: "#fff",
};

function textStyle(size: number, weight = 400): React.CSSProperties {
  return { fontFamily: bodyFont, fontSize: size, fontWeight: weight };
}
