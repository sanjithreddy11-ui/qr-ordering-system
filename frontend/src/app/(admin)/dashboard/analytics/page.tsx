"use client";

import React, { useEffect, useState, useCallback } from "react";
import { TrendingUp, ShoppingBag, Receipt, Flame } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { PageHeader, Card, adminColors } from "@/components/admin/ui";
import {
  fetchAnalytics,
  fetchRevenueBreakdown,
  fetchPeakHours,
  AnalyticsData,
  RevenueBreakdown,
  PeakHourData,
} from "@/lib/admin-api";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "Last 90 days", days: 90 },
];

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 16 }}>
      {children}
    </div>
  );
}

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
        <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {label}
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 22, fontWeight: 800, color: adminColors.text }}>
          {value}
        </div>
      </div>
    </Card>
  );
}

function ReportStat({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ flex: "1 1 140px", minWidth: 140 }}>
      <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 800, color: adminColors.text }}>
        ₹ {value.toLocaleString("en-IN")}
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const [rangeDays, setRangeDays] = useState(7);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [revenue, setRevenue] = useState<RevenueBreakdown | null>(null);
  const [peakHours, setPeakHours] = useState<PeakHourData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback((days: number) => {
    setLoading(true);
    const to = new Date();
    const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
    Promise.all([
      fetchAnalytics(RESTAURANT_ID, from.toISOString(), to.toISOString()),
      fetchRevenueBreakdown(RESTAURANT_ID),
      fetchPeakHours(RESTAURANT_ID, from.toISOString(), to.toISOString()),
    ])
      .then(([a, r, p]) => {
        setData(a);
        setRevenue(r);
        setPeakHours(p);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load(rangeDays);
  }, [rangeDays, load]);

  const maxPeakOrders = Math.max(1, ...peakHours.map((h) => h.orderCount));

  return (
    <div>
      <PageHeader
        title="Analytics"
        description="Business intelligence — revenue, trends, and sales performance"
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

      {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && data && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16, marginBottom: 20 }}>
            <StatCard icon={TrendingUp} label="Total Revenue" value={`₹ ${data.totalRevenue}`} />
            <StatCard icon={ShoppingBag} label="Total Orders" value={`${data.orderCount}`} />
            <StatCard icon={Receipt} label="Avg. Order Value" value={`₹ ${data.averageOrderValue}`} />
          </div>

          {/* ---- Weekly / Monthly report ---- */}
          <Card style={{ marginBottom: 20 }}>
            <SectionTitle>Revenue Reports</SectionTitle>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
              <ReportStat label="Today" value={revenue?.today ?? 0} />
              <ReportStat label="Yesterday" value={revenue?.yesterday ?? 0} />
              <ReportStat label="Weekly Report" value={revenue?.weekly ?? 0} />
              <ReportStat label="Monthly Report" value={revenue?.monthly ?? 0} />
            </div>
          </Card>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 20 }}>
            <Card>
              <SectionTitle>Revenue Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data.dailyTotals}>
                  <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: bodyFont }} tickFormatter={(d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })} />
                  <YAxis tick={{ fontSize: 10, fontFamily: bodyFont }} />
                  <Tooltip contentStyle={{ fontFamily: bodyFont, fontSize: 12, borderRadius: 8 }} formatter={(value) => [`₹ ${value}`, "Revenue"]} />
                  <Line type="monotone" dataKey="revenue" stroke={adminColors.primary} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <SectionTitle>Orders Trend</SectionTitle>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.dailyTotals}>
                  <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: bodyFont }} tickFormatter={(d: string) => new Date(d).toLocaleDateString([], { day: "numeric", month: "short" })} />
                  <YAxis tick={{ fontSize: 10, fontFamily: bodyFont }} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontFamily: bodyFont, fontSize: 12, borderRadius: 8 }} />
                  <Bar dataKey="orderCount" fill={adminColors.primary} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20, alignItems: "start" }}>
            <Card>
              <SectionTitle>Peak Hours</SectionTitle>
              {peakHours.every((h) => h.orderCount === 0) ? (
                <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No order data in this range.</p>
              ) : (
                <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 140 }}>
                  {peakHours.map((h) => (
                    <div key={h.hour} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div
                        title={`${h.hour}:00 — ${h.orderCount} orders`}
                        style={{
                          width: "100%",
                          height: `${Math.max(2, (h.orderCount / maxPeakOrders) * 110)}px`,
                          background: h.orderCount === maxPeakOrders && maxPeakOrders > 0
                            ? adminColors.primary
                            : `${adminColors.primary}55`,
                          borderRadius: "3px 3px 0 0",
                        }}
                      />
                      {h.hour % 3 === 0 && (
                        <span style={{ fontSize: 8, color: adminColors.textSecondary, fontFamily: bodyFont }}>
                          {h.hour}h
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
              {maxPeakOrders > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
                  <Flame size={13} color={adminColors.primary} />
                  <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
                    Busiest hour: {peakHours.find((h) => h.orderCount === maxPeakOrders)?.hour}:00
                  </span>
                </div>
              )}
            </Card>

            <Card>
              <SectionTitle>Best Selling Items</SectionTitle>
              {data.topItems.length === 0 ? (
                <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No sales data yet.</p>
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
                        <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 600, color: adminColors.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {item.name}
                        </div>
                        <div style={{ fontFamily: bodyFont, fontSize: 11, color: adminColors.textSecondary }}>
                          {item.quantitySold} sold · ₹{item.revenue}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          {/* ---- Revenue by Date ---- */}
          <Card>
            <SectionTitle>Revenue by Date</SectionTitle>
            {data.dailyTotals.length === 0 ? (
              <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No orders in this range.</p>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left" }}>
                    {["Date", "Orders", "Revenue"].map((h) => (
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
                  {[...data.dailyTotals].reverse().map((d) => (
                    <tr key={d.date}>
                      <td style={cellStyle}>{new Date(d.date).toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" })}</td>
                      <td style={cellStyle}>{d.orderCount}</td>
                      <td style={cellStyle}>₹ {d.revenue.toLocaleString("en-IN")}</td>
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
