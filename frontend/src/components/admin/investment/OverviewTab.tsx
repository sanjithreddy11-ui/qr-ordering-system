"use client";

import React, { useEffect, useState } from "react";
import {
  IndianRupee,
  Receipt,
  CalendarClock,
  Percent,
  Scale,
  Truck,
  Boxes,
  Clock3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Card, adminColors } from "@/components/admin/ui";
import { fetchInvestmentOverview, InvestmentOverview } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";
const PIE_COLORS = ["#3A4C3B", "#C9971F", "#2E86AB", "#7E57C2", "#C24C2E", "#2E7D4F", "#999999", "#5C4033"];

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
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
        <div style={{ fontFamily: bodyFont, fontSize: 20, fontWeight: 800, color: adminColors.text }}>{value}</div>
      </div>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text, marginBottom: 14 }}>{title}</div>
      <div style={{ width: "100%", height: 260 }}>{children}</div>
    </Card>
  );
}

export default function OverviewTab({ restaurantId }: { restaurantId: string }) {
  const [data, setData] = useState<InvestmentOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchInvestmentOverview(restaurantId)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load overview"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  if (loading) return <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>;
  if (error) return <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.danger }}>{error}</p>;
  if (!data) return null;

  const { cards, charts } = data;

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14, marginBottom: 24 }}>
        <StatCard icon={IndianRupee} label="Total Investment" value={formatRupees(cards.totalInvestment)} />
        <StatCard icon={Receipt} label="Total Expenses" value={formatRupees(cards.totalExpenses)} />
        <StatCard icon={CalendarClock} label="This Month Expenses" value={formatRupees(cards.thisMonthExpenses)} />
        <StatCard icon={Percent} label="Input GST Paid" value={formatRupees(cards.inputGstPaid)} />
        <StatCard icon={Scale} label="Net Business Cost" value={formatRupees(cards.netBusinessCost)} />
        <StatCard icon={Truck} label="Total Vendors" value={String(cards.totalVendors)} />
        <StatCard icon={Boxes} label="Total Assets" value={String(cards.totalAssets)} />
        <StatCard icon={Clock3} label="Pending Payments" value={formatRupees(cards.pendingPayments)} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: 16 }}>
        <ChartCard title="Monthly Expense Trend">
          <ResponsiveContainer>
            <LineChart data={charts.monthlyExpenseTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRupees(Number(v))} />
              <Line type="monotone" dataKey="total" stroke={adminColors.primary} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Expense Category Breakdown">
          <ResponsiveContainer>
            <PieChart>
              <Pie data={charts.categoryBreakdown} dataKey="total" nameKey="category" outerRadius={90} label={(d: any) => d.category}>
                {charts.categoryBreakdown.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatRupees(Number(v))} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Vendor Spending">
          <ResponsiveContainer>
            <BarChart data={charts.vendorSpending}>
              <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
              <XAxis dataKey="vendor" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRupees(Number(v))} />
              <Bar dataKey="total" fill={adminColors.warning} radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Monthly Profit">
          <ResponsiveContainer>
            <BarChart data={charts.monthlyProfit}>
              <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRupees(Number(v))} />
              <Legend />
              <Bar dataKey="revenue" fill={adminColors.success} radius={[6, 6, 0, 0]} name="Revenue" />
              <Bar dataKey="expenses" fill={adminColors.danger} radius={[6, 6, 0, 0]} name="Expenses" />
              <Bar dataKey="profit" fill={adminColors.primary} radius={[6, 6, 0, 0]} name="Profit" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="GST Paid (Monthly)">
          <ResponsiveContainer>
            <LineChart data={charts.monthlyGst}>
              <CartesianGrid strokeDasharray="3 3" stroke={adminColors.border} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatRupees(Number(v))} />
              <Line type="monotone" dataKey="total" stroke={adminColors.warning} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}
