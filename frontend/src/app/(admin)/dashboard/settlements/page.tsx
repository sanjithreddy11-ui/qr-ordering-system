"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  Clock3,
  Banknote,
  Smartphone,
  Users,
  Search,
  Download,
  CreditCard,
  Receipt,
  Percent,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader, Card, Badge, SecondaryButton, adminColors } from "@/components/admin/ui";
import { getSocket } from "@/lib/socket";
import {
  fetchSettlements,
  fetchSettlementHistory,
  fetchCreditCustomers,
  fetchSettlementAnalytics,
  fetchDateWiseReport,
  clearCreditBalance,
  type Settlement,
  type SettlementPaymentStatus,
  type SettlementPaymentMethod,
  type SettlementCollectionStatus,
  type SettlementHistoryRange,
  type ReportRange,
  type CreditCustomer,
  type SettlementAnalytics,
  type DateWiseReport,
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
  return (
    <Suspense fallback={null}>
      <SettlementsPageInner />
    </Suspense>
  );
}

// useSearchParams() requires a Suspense boundary above it, or Next.js fails
// the production build (see the same note in (customer)/layout.tsx) — split
// into an outer wrapper + inner component just for that, reads ?tab=reports
// so the Dashboard's "View Date-wise Reports" link can deep-link here.
function SettlementsPageInner() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") === "reports" ? "reports" : "pending";
  const [tab, setTab] = useState<Tab>(initialTab);
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
      {tab === "reports" && <ReportsTab />}

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
// Tab 4: Reports — Date-wise Collection & Settlement Report
// ---------------------------------------------------------------------------
const REPORT_RANGES: { key: ReportRange; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "custom", label: "Custom Range" },
];

const METHOD_FILTER_OPTIONS: { key: SettlementPaymentMethod | ""; label: string }[] = [
  { key: "", label: "All Methods" },
  { key: "cash", label: "Cash" },
  { key: "upi", label: "UPI" },
  { key: "card", label: "Card" },
  { key: "bank_transfer", label: "Bank Transfer" },
  { key: "credit", label: "Credit" },
];

const STATUS_FILTER_OPTIONS: { key: SettlementPaymentStatus | ""; label: string }[] = [
  { key: "", label: "All Statuses" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
  { key: "credit", label: "Credit" },
  { key: "cancelled", label: "Cancelled" },
];

const COLLECTION_FILTER_OPTIONS: { key: SettlementCollectionStatus | ""; label: string }[] = [
  { key: "", label: "All Collection" },
  { key: "PAID", label: "Paid" },
  { key: "PARTIALLY_PAID", label: "Partially Paid" },
  { key: "UNPAID", label: "Unpaid" },
];

// Formats a "YYYY-MM-DD" bucket date for display without going through the
// Date constructor (which would reinterpret it in the browser's own
// timezone and could shift it by a day) — the string is already an
// Asia/Kolkata business date straight from the backend.
function formatBucketDate(dateStr: string, withYear = false): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleDateString("en-IN", { day: "2-digit", month: "short", ...(withYear ? { year: "numeric" } : {}), timeZone: "UTC" });
}

function splitDateTime(iso: string | null): { date: string; time: string } {
  if (!iso) return { date: "—", time: "—" };
  const d = new Date(iso);
  return {
    date: d.toLocaleDateString("en-IN", { day: "2-digit", month: "short" }),
    time: d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  };
}

function buildReportCsv(report: DateWiseReport): string {
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  const lines: string[] = [];
  lines.push(esc("Collection & Settlement Report"));
  lines.push(`${esc("From")},${esc(new Date(report.range.from).toLocaleString("en-IN"))}`);
  lines.push(`${esc("To")},${esc(new Date(report.range.to).toLocaleString("en-IN"))}`);
  lines.push("");
  lines.push(esc("Summary"));
  lines.push(`${esc("Total Sales")},${report.summary.totalSales}`);
  lines.push(`${esc("Cash Collection")},${report.summary.cashCollected}`);
  lines.push(`${esc("UPI Collection")},${report.summary.upiCollected}`);
  lines.push(`${esc("Card Collection")},${report.summary.cardCollected}`);
  lines.push(`${esc("Online Payments")},${report.summary.onlineCollected}`);
  lines.push(`${esc("Credit / Pending")},${report.summary.creditPending}`);
  lines.push(`${esc("Discounts")},${report.summary.totalDiscount}`);
  lines.push(`${esc("Total Bills")},${report.summary.totalBills}`);
  lines.push("");
  lines.push(esc("Daily Breakdown"));
  lines.push(["Date", "Bills", "Cash", "UPI", "Card", "Online", "Credit/Pending", "Discounts", "Total"].map(esc).join(","));
  report.dailyBreakdown.forEach((d) => {
    lines.push([d.date, d.bills, d.cash, d.upi, d.card, d.onlinePayments, d.creditPending, d.discounts, d.totalSales].map(esc).join(","));
  });
  lines.push("");
  lines.push(esc("Transactions"));
  lines.push(
    ["Bill No.", "Date", "Time", "Table", "Customer", "Grand Total", "Received", "Remaining", "Payment Method", "Status", "Collection Status"]
      .map(esc)
      .join(",")
  );
  report.transactions.forEach((s) => {
    const { date, time } = splitDateTime(s.settlementTime || s.submittedAt);
    lines.push(
      [
        s.billNumber,
        date,
        time,
        s.tableLabel,
        s.customerName || "Walk-in",
        s.grandTotal,
        s.totalReceived,
        Math.max(s.remainingAmount, 0),
        formatPaymentBreakdown(s),
        STATUS_LABEL[s.paymentStatus],
        COLLECTION_LABEL[s.collectionStatus],
      ]
        .map(esc)
        .join(",")
    );
  });
  return lines.join("\n");
}

function downloadCsv(csv: string, filename: string) {
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function ReportsTab() {
  const [range, setRange] = useState<ReportRange>("today");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [method, setMethod] = useState<SettlementPaymentMethod | "">("");
  const [status, setStatus] = useState<SettlementPaymentStatus | "">("");
  const [collectionStatus, setCollectionStatus] = useState<SettlementCollectionStatus | "">("");
  const [report, setReport] = useState<DateWiseReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const invalidCustomRange = range === "custom" && !!from && !!to && from > to;

  const load = useCallback(async () => {
    if (range === "custom" && (!from || !to)) return; // wait for both dates
    if (invalidCustomRange) {
      setError("From date must be before or equal to To date.");
      setReport(null);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await fetchDateWiseReport(RESTAURANT_ID, range, {
        from: from || undefined,
        to: to || undefined,
        method: method || undefined,
        status: status || undefined,
        collectionStatus: collectionStatus || undefined,
      });
      setReport(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load report.");
      setReport(null);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range, from, to, method, status, collectionStatus]);

  useEffect(() => {
    load();
  }, [load]);

  const maxMethodTotal = useMemo(() => {
    if (!report) return 0;
    const b = report.paymentMethodBreakdown;
    return Math.max(b.cash, b.upi, b.card, b.bankTransfer, b.credit, 1);
  }, [report]);

  const handleExport = () => {
    if (!report) return;
    const label = range === "custom" ? `${from}_to_${to}` : range;
    downloadCsv(buildReportCsv(report), `collection-report-${label}.csv`);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* ---- Header + date filters ---- */}
      <Card>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
          <div style={{ ...textStyle(16, 700), color: adminColors.text }}>Collection &amp; Settlement Reports</div>
          <SecondaryButton onClick={handleExport} disabled={!report || report.summary.totalBills === 0}>
            <Download size={14} /> Export Report
          </SecondaryButton>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12, alignItems: "center" }}>
          {REPORT_RANGES.map((r) => (
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
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} style={inputStyle} aria-label="From date" />
              <span style={{ ...textStyle(12), color: adminColors.textSecondary }}>to</span>
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)} style={inputStyle} aria-label="To date" />
            </>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <select value={method} onChange={(e) => setMethod(e.target.value as SettlementPaymentMethod | "")} style={inputStyle}>
            {METHOD_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as SettlementPaymentStatus | "")} style={inputStyle}>
            {STATUS_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={collectionStatus}
            onChange={(e) => setCollectionStatus(e.target.value as SettlementCollectionStatus | "")}
            style={inputStyle}
          >
            {COLLECTION_FILTER_OPTIONS.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {error && (
        <Card>
          <p style={{ ...textStyle(13), color: adminColors.danger, margin: 0 }}>{error}</p>
        </Card>
      )}

      {!error && loading && (
        <Card>
          <p style={{ ...textStyle(13), color: adminColors.textSecondary, margin: 0 }}>Loading report…</p>
        </Card>
      )}

      {!error && !loading && report && report.summary.totalBills === 0 && (
        <Card>
          <p style={{ ...textStyle(13), color: adminColors.textSecondary, margin: 0 }}>
            No collections found for the selected period.
          </p>
        </Card>
      )}

      {!error && !loading && report && report.summary.totalBills > 0 && (
        <>
          {/* ---- Summary cards ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16 }}>
            <StatCard icon={TrendingUp} label="Total Sales" value={formatCurrency(report.summary.totalSales)} accent={adminColors.primary} />
            <StatCard icon={Banknote} label="Cash Collection" value={formatCurrency(report.summary.cashCollected)} accent={adminColors.success} />
            <StatCard icon={Smartphone} label="UPI Collection" value={formatCurrency(report.summary.upiCollected)} accent="#7C3AED" />
            <StatCard icon={CreditCard} label="Card Collection" value={formatCurrency(report.summary.cardCollected)} accent="#2563EB" />
            <StatCard icon={Smartphone} label="Online Payments" value={formatCurrency(report.summary.onlineCollected)} accent="#7C3AED" />
            <StatCard icon={Clock3} label="Credit / Pending" value={formatCurrency(report.summary.creditPending)} accent={adminColors.warning} />
            <StatCard icon={Percent} label="Discounts" value={formatCurrency(report.summary.totalDiscount)} accent={adminColors.danger} />
            <StatCard icon={Receipt} label="Total Bills" value={String(report.summary.totalBills)} accent={adminColors.text} />
          </div>

          {/* ---- Payment method breakdown ---- */}
          <Card>
            <div style={{ ...textStyle(14, 700), color: adminColors.text, marginBottom: 16 }}>Payment Method Breakdown</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {(
                [
                  ["Cash", report.paymentMethodBreakdown.cash, adminColors.success],
                  ["UPI", report.paymentMethodBreakdown.upi, "#7C3AED"],
                  ["Card", report.paymentMethodBreakdown.card, "#2563EB"],
                  ["Bank Transfer", report.paymentMethodBreakdown.bankTransfer, "#0891B2"],
                  ["Credit / Pending", report.paymentMethodBreakdown.credit, adminColors.warning],
                ] as [string, number, string][]
              ).map(([label, value, color]) => (
                <div key={label} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ width: 110, ...textStyle(12, 600), color: adminColors.textSecondary, flexShrink: 0 }}>{label}</div>
                  <div style={{ flex: 1, background: adminColors.bg, borderRadius: 6, overflow: "hidden", height: 10 }}>
                    <div
                      style={{
                        width: `${Math.min(100, (value / maxMethodTotal) * 100)}%`,
                        background: color,
                        height: "100%",
                        borderRadius: 6,
                      }}
                    />
                  </div>
                  <div style={{ width: 90, textAlign: "right", ...textStyle(13, 700), color: adminColors.text, flexShrink: 0 }}>
                    {formatCurrency(value)}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {/* ---- Daily collection trend ---- */}
          {report.dailyBreakdown.length > 1 && (
            <Card>
              <div style={{ ...textStyle(14, 700), color: adminColors.text, marginBottom: 16 }}>Daily Collection Trend</div>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={report.dailyBreakdown}>
                  <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: bodyFont }} tickFormatter={(d: string) => formatBucketDate(d)} />
                  <YAxis tick={{ fontSize: 10, fontFamily: bodyFont }} />
                  <Tooltip
                    contentStyle={{ fontFamily: bodyFont, fontSize: 12, borderRadius: 8 }}
                    formatter={(value) => [formatCurrency(Number(value)), "Collection"]}
                    labelFormatter={(d) => formatBucketDate(String(d), true)}
                  />
                  <Bar dataKey="totalSales" fill={adminColors.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* ---- Date-wise breakdown table ---- */}
          <Card>
            <div style={{ ...textStyle(14, 700), color: adminColors.text, marginBottom: 16 }}>Date-wise Breakdown</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Date", "Bills", "Cash", "UPI", "Card", "Online", "Credit/Pending", "Discounts", "Total"].map((h) => (
                      <th key={h} style={thStyle}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.dailyBreakdown.map((d) => (
                    <tr key={d.date}>
                      <td style={tdStyle}>{formatBucketDate(d.date)}</td>
                      <td style={tdStyle}>{d.bills}</td>
                      <td style={tdStyle}>{formatCurrency(d.cash)}</td>
                      <td style={tdStyle}>{formatCurrency(d.upi)}</td>
                      <td style={tdStyle}>{formatCurrency(d.card)}</td>
                      <td style={tdStyle}>{formatCurrency(d.onlinePayments)}</td>
                      <td style={tdStyle}>{formatCurrency(d.creditPending)}</td>
                      <td style={tdStyle}>{formatCurrency(d.discounts)}</td>
                      <td style={{ ...tdStyle, fontWeight: 700 }}>{formatCurrency(d.totalSales)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* ---- Transaction details ---- */}
          <Card>
            <div style={{ ...textStyle(14, 700), color: adminColors.text, marginBottom: 4 }}>Transaction Details</div>
            {report.transactionsTruncated && (
              <p style={{ ...textStyle(12), color: adminColors.textSecondary, marginTop: 0, marginBottom: 12 }}>
                Showing the most recent 1,000 bills in this period — summary and daily totals above always reflect the
                full range.
              </p>
            )}
            <div style={{ overflowX: "auto", marginTop: 12 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Bill No.", "Date", "Time", "Table", "Customer", "Grand Total", "Received", "Remaining", "Payment Method", "Status", "Collection"].map(
                      (h) => (
                        <th key={h} style={thStyle}>
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody>
                  {report.transactions.map((s) => {
                    const { date, time } = splitDateTime(s.settlementTime || s.submittedAt);
                    return (
                      <tr key={s.settlementId}>
                        <td style={tdStyle}>{s.billNumber}</td>
                        <td style={tdStyle}>{date}</td>
                        <td style={tdStyle}>{time}</td>
                        <td style={tdStyle}>{s.tableLabel}</td>
                        <td style={tdStyle}>{s.customerName || "Walk-in"}</td>
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
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
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
