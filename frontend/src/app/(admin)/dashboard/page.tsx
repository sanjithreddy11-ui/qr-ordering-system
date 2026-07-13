"use client";

import React, { useEffect, useState } from "react";
import { TrendingUp, ShoppingBag, Receipt, Clock } from "lucide-react";
import { PageHeader, Card, Badge, adminColors } from "@/components/admin/ui";
import { fetchAnalytics, fetchRecentOrders, AnalyticsData, RecentOrder } from "@/lib/admin-api";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants

const STATUS_COLOR: Record<string, string> = {
  pending: adminColors.warning,
  preparing: adminColors.warning,
  ready: adminColors.success,
  completed: adminColors.success,
  cancelled: adminColors.danger,
};

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 12,
          background: `${adminColors.primary}12`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        <Icon size={20} color={adminColors.primary} strokeWidth={2} />
      </div>
      <div>
        <div
          style={{
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 11,
            fontWeight: 700,
            color: adminColors.textSecondary,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 22,
            fontWeight: 800,
            color: adminColors.text,
          }}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}

export default function AdminOverviewPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    Promise.all([
      fetchAnalytics(RESTAURANT_ID, todayStart.toISOString(), new Date().toISOString()),
      fetchRecentOrders(RESTAURANT_ID),
    ])
      .then(([a, orders]) => {
        setAnalytics(a);
        setRecentOrders(orders.slice(0, 8));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <PageHeader title="Dashboard" description="Today's snapshot at a glance" />

      {loading && (
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
          Loading…
        </p>
      )}

      {!loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 16,
              marginBottom: 28,
            }}
          >
            <StatCard icon={TrendingUp} label="Today's Revenue" value={`₹ ${analytics?.totalRevenue ?? 0}`} />
            <StatCard icon={ShoppingBag} label="Today's Orders" value={`${analytics?.orderCount ?? 0}`} />
            <StatCard icon={Receipt} label="Avg. Order Value" value={`₹ ${analytics?.averageOrderValue ?? 0}`} />
          </div>

          <Card>
            <div
              style={{
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 14,
                fontWeight: 700,
                color: adminColors.text,
                marginBottom: 14,
              }}
            >
              Recent Orders
            </div>

            {recentOrders.length === 0 ? (
              <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
                No orders yet.
              </p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Order", "Table", "Type", "Status", "Total", "Placed"].map((h) => (
                      <th
                        key={h}
                        style={{
                          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
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
                  {recentOrders.map((o) => (
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
  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
  fontSize: 13,
  color: adminColors.text,
  padding: "10px 10px",
  borderBottom: `1px solid ${adminColors.border}`,
};
