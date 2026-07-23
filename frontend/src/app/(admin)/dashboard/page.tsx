"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  TrendingUp,
  ShoppingBag,
  Clock,
  ChefHat,
  CheckCircle2,
  Grid3x3,
  Plus,
  QrCode,
  ChefHat as KitchenIcon,
  Tag,
  ArrowRight,
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
import { PageHeader, Card, Badge, adminColors } from "@/components/admin/ui";
import {
  fetchAnalytics,
  fetchRecentOrders,
  fetchDashboardSummary,
  AnalyticsData,
  RecentOrder,
  DashboardSummary,
} from "@/lib/admin-api";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const STATUS_COLOR: Record<string, string> = {
  pending: adminColors.warning,
  preparing: adminColors.warning,
  ready: adminColors.success,
  completed: adminColors.success,
  cancelled: adminColors.danger,
};

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

function KitchenStatusCard({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <Card style={{ textAlign: "center", padding: "18px 14px" }}>
      <div style={{ fontFamily: bodyFont, fontSize: 28, fontWeight: 800, color }}>{count}</div>
      <div
        style={{
          fontFamily: bodyFont,
          fontSize: 12,
          fontWeight: 700,
          color: adminColors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginTop: 2,
        }}
      >
        {label}
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
  const [revenueTrend, setRevenueTrend] = useState<AnalyticsData | null>(null);
  const [liveOrders, setLiveOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const toDate = new Date();
    const fromDate = new Date(toDate.getTime() - 6 * 24 * 60 * 60 * 1000); // last 7 days incl. today

    Promise.all([
      fetchDashboardSummary(RESTAURANT_ID),
      fetchAnalytics(RESTAURANT_ID, fromDate.toISOString(), toDate.toISOString()),
      fetchRecentOrders(RESTAURANT_ID, { status: "pending,preparing,ready", limit: 8 }),
    ])
      .then(([s, trend, orders]) => {
        setSummary(s);
        setRevenueTrend(trend);
        setLiveOrders(orders);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" description="What's happening in your restaurant right now" />

      {loading && (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>
      )}

      {!loading && (
        <>
          {/* ---- KPI cards ---- */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: 16,
              marginBottom: 24,
            }}
          >
            <StatCard icon={TrendingUp} label="Today's Revenue" value={`₹ ${(summary?.todayRevenue ?? 0).toLocaleString("en-IN")}`} />
            <StatCard icon={ShoppingBag} label="Today's Orders" value={`${summary?.todayOrders ?? 0}`} />
            <StatCard icon={Clock} label="Pending Orders" value={`${summary?.pendingOrders ?? 0}`} accent={adminColors.warning} />
            <StatCard icon={ChefHat} label="Preparing Orders" value={`${summary?.preparingOrders ?? 0}`} accent={adminColors.warning} />
            <StatCard icon={CheckCircle2} label="Completed Orders" value={`${summary?.completedOrders ?? 0}`} accent={adminColors.success} />
            <StatCard icon={Grid3x3} label="Active Tables" value={`${summary?.activeTables ?? 0}`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 16, marginBottom: 24, alignItems: "start" }}>
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

            {/* ---- Kitchen Status ---- */}
            <Card>
              <SectionTitle>Kitchen Status</SectionTitle>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                <KitchenStatusCard label="Pending" count={summary?.pendingOrders ?? 0} color={adminColors.warning} />
                <KitchenStatusCard label="Preparing" count={summary?.preparingOrders ?? 0} color={adminColors.warning} />
                <KitchenStatusCard label="Ready" count={summary?.readyOrders ?? 0} color={adminColors.success} />
              </div>
            </Card>
          </div>

          {/* ---- Quick Actions ---- */}
          <Card style={{ marginBottom: 24 }}>
            <SectionTitle>Quick Actions</SectionTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <QuickAction icon={Plus} label="Add Menu Item" href="/dashboard/menu" />
              <QuickAction icon={QrCode} label="Generate QR" href="/dashboard/tables" />
              <QuickAction icon={KitchenIcon} label="View Kitchen" href="/kds" newTab />
              <QuickAction icon={Tag} label="Create Offer" href="/dashboard/offers" />
            </div>
          </Card>

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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Order", "Table", "Type", "Status", "Amount", "Time"].map((h) => (
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
                      <td style={cellStyle}>
                        <Badge color={STATUS_COLOR[o.status] ?? adminColors.textSecondary}>{o.status}</Badge>
                      </td>
                      <td style={cellStyle}>₹ {o.totalAmount}</td>
                      <td style={cellStyle}>
                        <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                        {new Date(o.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
