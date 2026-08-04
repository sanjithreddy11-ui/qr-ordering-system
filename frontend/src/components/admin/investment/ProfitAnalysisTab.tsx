"use client";

import React, { useState } from "react";
import { TrendingUp, TrendingDown, IndianRupee, Percent, Scale } from "lucide-react";
import { Card, PrimaryButton, adminColors } from "@/components/admin/ui";
import { fetchProfitAnalysis, ProfitAnalysis } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

function MetricCard({ icon: Icon, label, value, positive }: { icon: React.ElementType; label: string; value: string; positive?: boolean }) {
  const color = positive === undefined ? adminColors.primary : positive ? adminColors.success : adminColors.danger;
  return (
    <Card style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 44, height: 44, borderRadius: 12, background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={20} color={color} strokeWidth={2} />
      </div>
      <div>
        <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontFamily: bodyFont, fontSize: 22, fontWeight: 800, color: adminColors.text }}>{value}</div>
      </div>
    </Card>
  );
}

export default function ProfitAnalysisTab({ restaurantId }: { restaurantId: string }) {
  const today = new Date();
  const [fromDate, setFromDate] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toInputDate(today));
  const [analysis, setAnalysis] = useState<ProfitAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProfitAnalysis(restaurantId, new Date(fromDate).toISOString(), new Date(toDate).toISOString());
      setAnalysis(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load profit analysis");
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>From</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 14 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>To</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 14 }} />
          </label>
          <PrimaryButton onClick={run} disabled={loading}>
            {loading ? "Calculating…" : "Calculate"}
          </PrimaryButton>
        </div>
        {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13, marginTop: 10 }}>{error}</p>}
      </Card>

      {analysis && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14 }}>
          <MetricCard icon={IndianRupee} label="Revenue" value={formatRupees(analysis.revenue)} />
          <MetricCard icon={TrendingDown} label="Expenses" value={formatRupees(analysis.expenses)} positive={false} />
          <MetricCard icon={analysis.netProfit >= 0 ? TrendingUp : TrendingDown} label="Net Profit" value={formatRupees(analysis.netProfit)} positive={analysis.netProfit >= 0} />
          <MetricCard icon={Percent} label="Profit Margin" value={`${analysis.profitMargin.toFixed(1)}%`} positive={analysis.profitMargin >= 0} />
          <MetricCard icon={Scale} label="Expense Ratio" value={`${analysis.expenseRatio.toFixed(1)}%`} />
        </div>
      )}
    </div>
  );
}
