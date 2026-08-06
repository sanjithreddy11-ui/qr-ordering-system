"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  Grid3x3,
  Banknote,
  Smartphone,
  CreditCard,
  Plus,
  QrCode,
  Printer,
  Tag,
  ArrowRight,
  BarChart3,
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
import { PageHeader, Card, adminColors } from "@/components/admin/ui";
import { getSocket } from "@/lib/socket";
import {
  fetchAnalytics,
  fetchRecentOrders,
  fetchDashboardSummary,
  fetchSettlementAnalytics,
  AnalyticsData,
  RecentOrder,
  DashboardSummary,
  SettlementAnalytics,
} from "@/lib/admin-api";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

// Not part of adminColors since they're specific to the payment-method
// breakdown cards — every other accent on the dashboard already exists in
// the shared design system.
const UPI_ACCENT = "#7E57C2";
const CARD_ACCENT = "#2E86AB";
const DISCOUNT_ACCENT = "#C9971F";

// Discount Tracking Module: the dashboard should always show live values —
// refetch analytics whenever a bill is submitted/collected, or an offer is
// applied/removed on any active session. Mirrors the Settlements page's
// LIVE_EVENTS (see dashboard/settlements/page.tsx) plus sessionPaymentUpdated,
// which is what fires on offer apply/remove (see
// sockets/socket.js:emitSessionPaymentUpdated).
const LIVE_EVENTS = [
  "settlementCreated",
  "settlementUpdated",
  "sessionPaymentUpdated",
  "sessionEnded",
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 14 }}>
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
          background: `${color}12`,
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
        <div style={{ fontFamily: bodyFont, fontSize: 22, fontWeight: 800, color: adminColors.text }}>
          {value}
        </div>
      </div>
    </Card>
  );
}

function PaymentHighlightCard({
  icon: Icon,
  label,
  value,
  subtitle,
  accent,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  subtitle: string;
  accent: string;
}) {
  return (
    <Card
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 14,
        background: `${accent}0D`,
        border: `1px solid ${accent}26`,
      }}
    >
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
        <div style={{ fontFamily: bodyFont, fontSize: 24, fontWeight: 800, color: adminColors.text, marginTop: 2 }}>
          {value}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
      <div
        style={{
          width: 48,
          height: 48,
          borderRadius: "50%",
          background: accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={22} color="#FFFFFF" strokeWidth={2} />
      </div>
    </Card>
  );
}

function QuickAction({
  icon: Icon,
  label,
  href,
  newTab,
}: {
  icon: React.ElementType;
  label: string;
  href: string;
  newTab?: boolean;
}) {
  return (
    <Link
      href={href}
      target={newTab ? "_blank" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 14,
        border: `1px solid ${adminColors.border}`,
        background: "#FFFFFF",
        textDecoration: "none",
        transition: "border-color 0.15s ease",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          background: `${adminColors.primary}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={17} color={adminColors.primary} strokeWidth={2} />
      </div>
      <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text }}>{label}</span>
    </Link>
  );
}

export default function AdminOverviewPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [paymentsToday, setPaymentsToday] = useState<SettlementAnalytics | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<AnalyticsData | null>(null);
  const [liveOrders, setLiveOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Discount Tracking Module: split out so it can be re-run on live socket
  // events (below) without re-fetching the summary/trend/orders too.
  const loadPaymentsToday = useCallback(async () => {
    try {
      setPaymentsToday(await fetchSettlementAnalytics(RESTAURANT_ID, "today"));
    } catch {
      // Non-fatal — the payment/discount cards just stay at their last value.
    }
  }, []);

  useEffect(() => {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000); // last 7 days incl. today

    Promise.all([
      fetchDashboardSummary(RESTAURANT_ID),
      fetchSettlementAnalytics(RESTAURANT_ID, "today"),
      fetchAnalytics(RESTAURANT_ID, fromDate.toISOString(), toDate.toISOString()),
      fetchRecentOrders(RESTAURANT_ID, { status: "pending,preparing,ready", limit: 8 }),
    ])
      .then(([s, payments, trend, orders]) => {
        setSummary(s);
        setPaymentsToday(payments);
        setRevenueTrend(trend);
        setLiveOrders(orders);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Discount Tracking Module (Step 6): keep "Today's Discounts", Discount
  // Summary, and Offer Performance live — refresh the moment a bill is
  // submitted/collected or an offer is applied/removed on any table.
  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-tables", RESTAURANT_ID);
    const handler = () => loadPaymentsToday();
    LIVE_EVENTS.forEach((evt) => socket.on(evt, handler));
    return () => {
      LIVE_EVENTS.forEach((evt) => socket.off(evt, handler));
      socket.emit("leave-tables", RESTAURANT_ID);
    };
  }, [loadPaymentsToday]);

  return (
    <div>
      <PageHeader title="Dashboard" description="What's happening in your restaurant right now" />

      {loading && (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>
      )}

      {!loading && (
        <>
          {/* ---- Payment breakdown (today's settled payments) ---- */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 16,
            }}
          >
            <PaymentHighlightCard
              icon={TrendingUp}
              label="Today's Revenue"
              value={`₹ ${(summary?.todayRevenue ?? 0).toLocaleString("en-IN")}`}
              subtitle="From all payment methods"
              accent={adminColors.primary}
            />
            <PaymentHighlightCard
              icon={Banknote}
              label="Cash Collection"
              value={`₹ ${(paymentsToday?.cashCollected ?? 0).toLocaleString("en-IN")}`}
              subtitle="From cash payments"
              accent={adminColors.success}
            />
            <PaymentHighlightCard
              icon={Smartphone}
              label="UPI Collection"
              value={`₹ ${(paymentsToday?.upiCollected ?? 0).toLocaleString("en-IN")}`}
              subtitle="From UPI payments"
              accent={UPI_ACCENT}
            />
            <PaymentHighlightCard
              icon={CreditCard}
              label="Card Collection"
              value={`₹ ${(paymentsToday?.cardCollected ?? 0).toLocaleString("en-IN")}`}
              subtitle="From card payments"
              accent={CARD_ACCENT}
            />
            <PaymentHighlightCard
              icon={Percent}
              label="Today's Discounts"
              value={`₹ ${(paymentsToday?.totalDiscount ?? 0).toLocaleString("en-IN")}`}
              subtitle="Total discounts given today"
              accent={DISCOUNT_ACCENT}
            />
          </div>

          {/* ---- Orders / tables (today) ---- */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard icon={ShoppingBag} label="Today's Orders" value={`${summary?.todayOrders ?? 0}`} />
            <StatCard icon={Grid3x3} label="Active Tables" value={`${summary?.activeTables ?? 0}`} />
          </div>

          <div
            className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr]"
            style={{ gap: 16, marginBottom: 24, alignItems: "start" }}
          >
            {/* ---- Revenue chart (last 7 days) ---- */}
            <Card>
              <SectionTitle>Revenue — Last 7 Days</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={revenueTrend?.dailyTotals ?? []}>
                  <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 10, fontFamily: bodyFont }}
                    tickFormatter={(d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })}
                  />
                  <YAxis tick={{ fontSize: 10, fontFamily: bodyFont }} />
                  <Tooltip
                    contentStyle={{ fontFamily: bodyFont, fontSize: 12, borderRadius: 8 }}
                    formatter={(value) => [`₹ ${value}`, "Revenue"]}
                    labelFormatter={(d) => new Date(String(d)).toLocaleDateString()}
                  />
                  <Bar dataKey="revenue" fill={adminColors.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            {/* ---- Quick Actions ---- */}
            <Card>
              <SectionTitle>Quick Actions</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
                <QuickAction icon={Plus} label="Add Menu Item" href="/dashboard/menu" />
                <QuickAction icon={BarChart3} label="View Analytics" href="/dashboard/analytics" />
                <QuickAction icon={Printer} label="Printer Settings" href="/dashboard/settings" />
                <QuickAction icon={Tag} label="Create Offer" href="/dashboard/offers" />
              </div>
            </Card>
          </div>

  

          {/* ---- Live Orders ---- */}
          <Card>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>
                Live Orders
              </div>
              <Link
                href="/dashboard/orders"
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  fontFamily: bodyFont,
                  fontSize: 12,
                  fontWeight: 700,
                  color: adminColors.primary,
                  textDecoration: "none",
                }}
              >
                View All Orders <ArrowRight size={13} />
              </Link>
            </div>

            {liveOrders.length === 0 ? (
              <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>
                No active orders right now.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Order", "Table", "Type", "Amount", "Time"].map((h) => (
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
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {liveOrders.map((o) => (
                    <tr key={o.orderId}>
                      <td style={cellStyle}>#{o.orderId}</td>
                      <td style={cellStyle}>{o.tableLabel ?? "—"}</td>
                      <td style={cellStyle}>{o.orderType === "dine-in" ? "Dine-in" : "Takeaway"}</td>
                      <td style={cellStyle}>₹ {o.totalAmount}</td>
                      <td style={cellStyle}>
                        <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                        {new Date(o.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  padding: "10px 10px",
  borderBottom: `1px solid ${adminColors.border}`,
};