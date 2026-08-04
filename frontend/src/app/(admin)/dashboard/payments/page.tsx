"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  Wallet,
  Receipt,
  TrendingUp,
  Smartphone,
  Banknote,
  Search,
  Flame,
  CheckCircle2,
  XCircle,
  RotateCcw,
  FileDown,
  FileSpreadsheet,
  Printer,
  Lightbulb,
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { PageHeader, Card, Badge, SecondaryButton, adminColors } from "@/components/admin/ui";
import {
  fetchPaymentOverview,
  fetchPaymentDailyBreakdown,
  fetchPaymentTransactions,
  fetchPendingCashPayments,
  collectCashPayment,
  fetchPaymentSuccessMetrics,
  fetchPeakHours,
  PaymentOverview,
  PaymentDailyPoint,
  PaymentTransaction,
  PendingCashPayment,
  PaymentSuccessMetrics,
  PeakHourData,
} from "@/lib/admin-api";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const RANGE_OPTIONS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "7d", label: "Last 7 Days" },
  { key: "30d", label: "Last 30 Days" },
  { key: "custom", label: "Custom" },
] as const;
type RangeKey = (typeof RANGE_OPTIONS)[number]["key"];

const METHOD_FILTERS = [
  { key: "", label: "All" },
  { key: "online", label: "Online" },
  { key: "cash", label: "Cash" },
] as const;

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "paid", label: "Paid" },
  { key: "pending", label: "Pending" },
] as const;

const SORT_OPTIONS = [
  { key: "latest", label: "Latest" },
  { key: "highest", label: "Highest Amount" },
  { key: "lowest", label: "Lowest Amount" },
] as const;

function startOfDay(d: Date) {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

function rangeToDates(range: RangeKey, customFrom: string, customTo: string): { from: Date; to: Date } {
  const now = new Date();
  const today0 = startOfDay(now);
  switch (range) {
    case "today":
      return { from: today0, to: now };
    case "yesterday": {
      const y0 = new Date(today0.getTime() - 24 * 60 * 60 * 1000);
      return { from: y0, to: today0 };
    }
    case "7d":
      return { from: new Date(today0.getTime() - 7 * 24 * 60 * 60 * 1000), to: now };
    case "30d":
      return { from: new Date(today0.getTime() - 30 * 24 * 60 * 60 * 1000), to: now };
    case "custom":
      return {
        from: customFrom ? new Date(customFrom) : today0,
        to: customTo ? new Date(new Date(customTo).getTime() + 24 * 60 * 60 * 1000 - 1) : now,
      };
  }
}

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function timeAgo(iso: string): string {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m ago`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 16 }}>
      {children}
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
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: 11,
            fontWeight: 700,
            color: adminColors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 22, fontWeight: 800, color: adminColors.text }}>{value}</div>
      </div>
    </Card>
  );
}

function MethodBreakdownCard({
  icon: Icon,
  title,
  revenue,
  transactions,
  percentage,
  color,
}: {
  icon: React.ElementType;
  title: string;
  revenue: number;
  transactions: number;
  percentage: number;
  color: string;
}) {
  return (
    <Card style={{ flex: "1 1 260px", minWidth: 260 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: `${color}14`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon size={18} color={color} strokeWidth={2} />
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>{title}</div>
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 28, fontWeight: 800, color: adminColors.text, marginBottom: 4 }}>
        {formatCurrency(revenue)}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>
          {transactions} Transaction{transactions === 1 ? "" : "s"}
        </span>
        <Badge color={color}>{percentage}%</Badge>
      </div>
    </Card>
  );
}

export default function AdminPaymentsPage() {
  const [range, setRange] = useState<RangeKey>("today");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  const [overview, setOverview] = useState<PaymentOverview | null>(null);
  const [daily, setDaily] = useState<PaymentDailyPoint[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourData[]>([]);
  const [successMetrics, setSuccessMetrics] = useState<PaymentSuccessMetrics | null>(null);
  const [pendingCash, setPendingCash] = useState<PendingCashPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [collectingId, setCollectingId] = useState<string | null>(null);

  // Transaction history table state
  const [search, setSearch] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["key"]>("latest");
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [txLoading, setTxLoading] = useState(true);

  const { from, to } = useMemo(() => rangeToDates(range, customFrom, customTo), [range, customFrom, customTo]);

  const loadPending = useCallback(() => {
    fetchPendingCashPayments(RESTAURANT_ID).then(setPendingCash).catch(() => {});
  }, []);

  const loadSummary = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchPaymentOverview(RESTAURANT_ID, from.toISOString(), to.toISOString()),
      fetchPaymentDailyBreakdown(RESTAURANT_ID, from.toISOString(), to.toISOString()),
      fetchPeakHours(RESTAURANT_ID, from.toISOString(), to.toISOString()),
      fetchPaymentSuccessMetrics(RESTAURANT_ID, from.toISOString(), to.toISOString()),
    ])
      .then(([o, d, p, s]) => {
        setOverview(o);
        setDaily(d);
        setPeakHours(p);
        setSuccessMetrics(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [from, to]);

  const loadTransactions = useCallback(() => {
    setTxLoading(true);
    fetchPaymentTransactions(RESTAURANT_ID, {
      search: search || undefined,
      method: (methodFilter || undefined) as "online" | "cash" | undefined,
      status: (statusFilter || undefined) as "paid" | "pending" | undefined,
      from: from.toISOString(),
      to: to.toISOString(),
      sort,
      limit: 200,
    })
      .then(setTransactions)
      .catch(() => {})
      .finally(() => setTxLoading(false));
  }, [search, methodFilter, statusFilter, sort, from, to]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  useEffect(() => {
    loadTransactions();
  }, [loadTransactions]);

  useEffect(() => {
    loadPending();
    // Pending cash collections are time-sensitive for the cashier — refresh
    // every 30s so the list stays live without requiring a manual reload.
    const id = setInterval(loadPending, 30000);
    return () => clearInterval(id);
  }, [loadPending]);

  const handleCollect = async (orderId: string) => {
    setCollectingId(orderId);
    try {
      await collectCashPayment(orderId);
      loadPending();
      loadTransactions();
      loadSummary();
    } catch {
      // Swallow — the list will simply not update, which is a safe failure
      // mode for a "mark as paid" tap; the cashier can just tap again.
    } finally {
      setCollectingId(null);
    }
  };

  const maxPeakOrders = Math.max(1, ...peakHours.map((h) => h.orderCount));

  const distributionData = overview
    ? [
        { name: "Online", value: overview.online.revenue, color: adminColors.primary },
        { name: "Cash", value: overview.cash.revenue, color: adminColors.warning },
      ]
    : [];

  const insights = useMemo(() => {
    if (!overview) return [];
    const list: string[] = [];
    if (overview.totalRevenue > 0) {
      list.push(`${overview.online.percentage}% of payments in this range were made online.`);
      list.push(`Online payments generated ${formatCurrency(overview.online.revenue)}.`);
      list.push(`Cash collections were ${formatCurrency(overview.cash.revenue)}.`);
      if (overview.online.transactions > 0) {
        list.push(`Average online bill was ${formatCurrency(overview.online.averageBill)}.`);
      }
    } else {
      list.push("No payments recorded in this range yet.");
    }
    if (maxPeakOrders > 0 && peakHours.some((h) => h.orderCount > 0)) {
      const busiest = peakHours.find((h) => h.orderCount === maxPeakOrders);
      if (busiest) list.push(`Peak payment time was around ${busiest.hour}:00.`);
    }
    if (pendingCash.length > 0) {
      const pendingTotal = pendingCash.reduce((s, p) => s + p.amount, 0);
      list.push(`${pendingCash.length} cash bill${pendingCash.length === 1 ? "" : "s"} (${formatCurrency(pendingTotal)}) still awaiting collection.`);
    }
    return list;
  }, [overview, peakHours, maxPeakOrders, pendingCash]);

  const handleExportExcel = () => {
    const header = ["Time", "Order ID", "Table", "Customer", "Amount", "Payment Mode", "Status"];
    const rows = transactions.map((t) => [
      new Date(t.placedAt).toLocaleString("en-IN"),
      t.orderId,
      t.tableLabel,
      t.customerName,
      String(t.amount),
      t.paymentMethod,
      t.paymentStatus,
    ]);
    const csv = [header, ...rows].map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payments-report-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => window.print();

  return (
    <div>
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #payments-print-report, #payments-print-report * { visibility: visible; }
          #payments-print-report { position: absolute; top: 0; left: 0; width: 100%; }
        }
      `}</style>

      <PageHeader
        title="Payments"
        description="Track revenue by payment method, collect pending cash, and export daily reports"
        action={
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.key}
                onClick={() => setRange(opt.key)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1px solid ${range === opt.key ? "transparent" : adminColors.border}`,
                  background: range === opt.key ? adminColors.primary : "#FFFFFF",
                  color: range === opt.key ? "#FFFFFF" : adminColors.text,
                  fontFamily: bodyFont,
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        }
      />

      {range === "custom" && (
        <Card style={{ marginBottom: 20, display: "flex", gap: 14, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>From</span>
            <input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} style={dateInputStyle} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>To</span>
            <input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} style={dateInputStyle} />
          </label>
        </Card>
      )}

      {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && overview && (
        <div id="payments-print-report">
          {/* ---- 1. Overview cards ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
            <StatCard icon={TrendingUp} label="Total Revenue" value={formatCurrency(overview.totalRevenue)} />
            <StatCard icon={Receipt} label="Total Transactions" value={String(overview.totalTransactions)} />
            <StatCard icon={Wallet} label="Average Bill" value={formatCurrency(overview.averageBill)} />
            <StatCard icon={Smartphone} label="Online Revenue" value={formatCurrency(overview.online.revenue)} accent={adminColors.primary} />
            <StatCard icon={Banknote} label="Cash Revenue" value={formatCurrency(overview.cash.revenue)} accent={adminColors.warning} />
          </div>

          {/* ---- 2. Payment method breakdown ---- */}
          <div style={{ display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" }}>
            <MethodBreakdownCard
              icon={Smartphone}
              title="Online"
              revenue={overview.online.revenue}
              transactions={overview.online.transactions}
              percentage={overview.online.percentage}
              color={adminColors.primary}
            />
            <MethodBreakdownCard
              icon={Banknote}
              title="Cash"
              revenue={overview.cash.revenue}
              transactions={overview.cash.transactions}
              percentage={overview.cash.percentage}
              color={adminColors.warning}
            />
            {overview.online.card.transactions > 0 && (
              <MethodBreakdownCard
                icon={Receipt}
                title="Card"
                revenue={overview.online.card.revenue}
                transactions={overview.online.card.transactions}
                percentage={Math.round((overview.online.card.revenue / Math.max(1, overview.totalRevenue)) * 1000) / 10}
                color={adminColors.success}
              />
            )}
          </div>

          {/* ---- 3 & 4. Distribution + Revenue by method ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
            <Card>
              <SectionTitle>Payment Distribution</SectionTitle>
              {overview.totalRevenue === 0 ? (
                <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No payments in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={distributionData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                      {distributionData.map((d) => (
                        <Cell key={d.name} fill={d.color} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontFamily: bodyFont, fontSize: 12, borderRadius: 8 }} formatter={(value) => formatCurrency(Number(value))} />
                    <Legend wrapperStyle={{ fontFamily: bodyFont, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>

            <Card>
              <SectionTitle>Revenue by Payment Method</SectionTitle>
              {daily.length === 0 ? (
                <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No orders in this range.</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={daily}>
                    <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: bodyFont }} tickFormatter={(d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })} />
                    <YAxis tick={{ fontSize: 10, fontFamily: bodyFont }} />
                    <Tooltip contentStyle={{ fontFamily: bodyFont, fontSize: 12, borderRadius: 8 }} formatter={(value) => formatCurrency(Number(value))} />
                    <Legend wrapperStyle={{ fontFamily: bodyFont, fontSize: 12 }} />
                    <Bar dataKey="onlineRevenue" name="Online" fill={adminColors.primary} radius={[4, 4, 0, 0]} />
                    <Bar dataKey="cashRevenue" name="Cash" fill={adminColors.warning} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* ---- 6. Payment analytics detail + 7. Peak hours ---- */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20, alignItems: "start" }}>
            <Card>
              <SectionTitle>Payment Analytics</SectionTitle>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                <div>
                  <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.text, marginBottom: 6 }}>Online</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    <ReportStat label="Transactions" value={String(overview.online.transactions)} />
                    <ReportStat label="Revenue" value={formatCurrency(overview.online.revenue)} />
                    <ReportStat label="Average Bill" value={formatCurrency(overview.online.averageBill)} />
                  </div>
                </div>
                <div style={{ borderTop: `1px solid ${adminColors.border}`, paddingTop: 14 }}>
                  <div style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.text, marginBottom: 6 }}>Cash</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
                    <ReportStat label="Transactions" value={String(overview.cash.transactions)} />
                    <ReportStat label="Revenue" value={formatCurrency(overview.cash.revenue)} />
                    <ReportStat label="Average Bill" value={formatCurrency(overview.cash.averageBill)} />
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <SectionTitle>Peak Payment Hours</SectionTitle>
              {peakHours.every((h) => h.orderCount === 0) ? (
                <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No payment data in this range.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140 }}>
                  {peakHours.map((h) => (
                    <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div
                        title={`${h.hour}:00 — ${h.orderCount} payments`}
                        style={{
                          width: "100%",
                          height: `${Math.max(2, (h.orderCount / maxPeakOrders) * 110)}px`,
                          background: h.orderCount === maxPeakOrders && maxPeakOrders > 0 ? adminColors.primary : `${adminColors.primary}55`,
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                      {h.hour % 3 === 0 && (
                        <span style={{ fontSize: 8, color: adminColors.textSecondary, fontFamily: bodyFont }}>{h.hour}h</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {maxPeakOrders > 0 && peakHours.some((h) => h.orderCount > 0) && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                  <Flame size={13} color={adminColors.primary} />
                  <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
                    Busiest hour: {peakHours.find((h) => h.orderCount === maxPeakOrders)?.hour}:00
                  </span>
                </div>
              )}
            </Card>
          </div>

          {/* ---- 8. Pending cash payments ---- */}
          <Card style={{ marginBottom: 20 }}>
            <SectionTitle>Pending Cash Payments</SectionTitle>
            {pendingCash.length === 0 ? (
              <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Nothing waiting for collection right now.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {pendingCash.map((p) => (
                  <div
                    key={p.orderId}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 12,
                      padding: "12px 14px",
                      borderRadius: 12,
                      border: `1px solid ${adminColors.border}`,
                      flexWrap: "wrap",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>
                        {p.tableLabel} · {p.customerName}
                      </div>
                      <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
                        {formatCurrency(p.amount)} · Waiting for collection · {timeAgo(p.placedAt)}
                      </div>
                    </div>
                    <SecondaryButton onClick={() => handleCollect(p.orderId)}>
                      {collectingId === p.orderId ? "Marking…" : "Mark as Paid"}
                    </SecondaryButton>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* ---- 9. Payment success metrics ---- */}
          {successMetrics && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 }}>
              <StatCard icon={CheckCircle2} label="Successful" value={`${successMetrics.successful} (${successMetrics.successfulPercentage}%)`} accent={adminColors.success} />
              <StatCard icon={XCircle} label="Failed" value={`${successMetrics.failed} (${successMetrics.failedPercentage}%)`} accent={adminColors.danger} />
              <StatCard icon={RotateCcw} label="Refunded" value={String(successMetrics.refunded)} accent={adminColors.textSecondary} />
            </div>
          )}

          {/* ---- 11. Payment Insights ---- */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
              <Lightbulb size={16} color={adminColors.warning} />
              <span style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>Payment Insights</span>
            </div>
            <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
              {insights.map((line, idx) => (
                <li key={idx} style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.text }}>
                  {line}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      )}

      {/* ---- 10. Export options (kept outside the printable block itself) ---- */}
      <Card style={{ marginBottom: 20, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text, marginRight: 4 }}>Export Reports:</span>
        <SecondaryButton onClick={handlePrint}>
          <FileDown size={15} style={{ marginRight: 2 }} /> Export PDF
        </SecondaryButton>
        <SecondaryButton onClick={handleExportExcel}>
          <FileSpreadsheet size={15} style={{ marginRight: 2 }} /> Export Excel
        </SecondaryButton>
        <SecondaryButton onClick={handlePrint}>
          <Printer size={15} style={{ marginRight: 2 }} /> Print Daily Report
        </SecondaryButton>
      </Card>

      {/* ---- 5. Transaction history ---- */}
      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
          <SectionTitle>Transaction History</SectionTitle>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ position: "relative" }}>
              <Search size={14} color={adminColors.textSecondary} style={{ position: "absolute", left: 10, top: 10 }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search order, table, customer…"
                style={{ ...dateInputStyle, paddingLeft: 30, width: 220 }}
              />
            </div>
            <select value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} style={dateInputStyle}>
              {METHOD_FILTERS.map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={dateInputStyle}>
              {STATUS_FILTERS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
            <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={dateInputStyle}>
              {SORT_OPTIONS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {txLoading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

        {!txLoading && transactions.length === 0 && (
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No transactions match these filters.</p>
        )}

        {!txLoading && transactions.length > 0 && (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left" }}>
                  {["Time", "Order ID", "Table", "Customer", "Amount", "Payment Mode", "Status"].map((h) => (
                    <th
                      key={h}
                      style={{
                        fontFamily: bodyFont,
                        fontSize: 11,
                        fontWeight: 700,
                        color: adminColors.textSecondary,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        padding: "8px 10px",
                        borderBottom: `1px solid ${adminColors.border}`,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.orderId}>
                    <td style={cellStyle}>{new Date(t.placedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</td>
                    <td style={cellStyle}>{t.orderId}</td>
                    <td style={cellStyle}>{t.tableLabel}</td>
                    <td style={cellStyle}>{t.customerName}</td>
                    <td style={cellStyle}>{formatCurrency(t.amount)}</td>
                    <td style={cellStyle}>
                      <Badge color={t.paymentMethod === "cash" ? adminColors.warning : adminColors.primary}>
                        {t.paymentMethod.toUpperCase()}
                      </Badge>
                    </td>
                    <td style={cellStyle}>
                      <Badge color={t.paymentStatus === "paid" ? adminColors.success : adminColors.warning}>
                        {t.paymentStatus === "paid" ? "✅ Paid" : "Pending"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

function ReportStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ flex: "1 1 100px", minWidth: 100 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 10, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 800, color: adminColors.text }}>{value}</div>
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  padding: "10px 10px",
  borderBottom: `1px solid ${adminColors.border}`,
  whiteSpace: "nowrap",
};

const dateInputStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${adminColors.border}`,
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  outline: "none",
  background: "#fff",
};