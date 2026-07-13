"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TrendingUp, ShoppingBag, Receipt } from "lucide-react";
import { PageHeader, Card, adminColors } from "@/components/admin/ui";
import { fetchAnalytics, AnalyticsData } from "@/lib/admin-api";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants

const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function StatCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
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
        <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </div>
        <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 22, fontWeight: 800, color: adminColors.text }}>
          {value}
        </div>
      </div>
    </Card>
  );
}

export default function AdminOrdersPage() {
  const [rangeDays, setRangeDays] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback((days: number) => {
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    fetchAnalytics(RESTAURANT_ID, from.toISOString(), to.toISOString())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(rangeDays);
  }, [rangeDays, load]);

  const maxDailyRevenue = data ? Math.max(1, ...data.dailyTotals.map((d) => d.revenue)) : 1;

  return (
    <div>
      <PageHeader
        title="Orders & Sales"
        description="Revenue and order trends over time"
        action={
          <div style={{ display: "flex", gap: 6 }}>
            {RANGE_OPTIONS.map((opt) => (
              <button
                key={opt.days}
                onClick={() => setRangeDays(opt.days)}
                style={{
                  padding: "8px 14px",
                  borderRadius: 10,
                  border: `1px solid ${rangeDays === opt.days ? "transparent" : adminColors.border}`,
                  background: rangeDays === opt.days ? adminColors.primary : "#FFFFFF",
                  color: rangeDays === opt.days ? "#FFFFFF" : adminColors.text,
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
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

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 24 }}>
            <StatCard icon={TrendingUp} label="Total Revenue" value={`₹ ${data.totalRevenue}`} />
            <StatCard icon={ShoppingBag} label="Total Orders" value={`${data.orderCount}`} />
            <StatCard icon={Receipt} label="Avg. Order Value" value={`₹ ${data.averageOrderValue}`} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: 16 }}>
            <Card>
              <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 16 }}>
                Daily Revenue
              </div>
              {data.dailyTotals.length === 0 ? (
                <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
                  No orders in this range.
                </p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 160 }}>
                  {data.dailyTotals.map((d) => (
                    <div key={d.date} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                      <div
                        title={`₹${d.revenue} — ${d.orderCount} orders`}
                        style={{
                          width: "100%",
                          height: `${Math.max(4, (d.revenue / maxDailyRevenue) * 130)}px`,
                          background: `linear-gradient(180deg, ${adminColors.primary} 0%, ${adminColors.primaryDark} 100%)`,
                          borderRadius: "4px 4px 0 0",
                        }}
                      />
                      <span style={{ fontSize: 9, color: adminColors.textSecondary, fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)" }}>
                        {new Date(d.date).toLocaleDateString([], { day: "numeric", month: "short" })}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>

            <Card>
              <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 16 }}>
                Top Selling Items
              </div>
              {data.topItems.length === 0 ? (
                <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
                  No sales data yet.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {data.topItems.map((item, idx) => (
                    <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: "50%",
                          background: `${adminColors.primary}12`,
                          color: adminColors.primary,
                          fontSize: 10,
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, fontWeight: 600, color: adminColors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </div>
                        <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 11, color: adminColors.textSecondary }}>
                          {item.quantitySold} sold · ₹{item.revenue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
