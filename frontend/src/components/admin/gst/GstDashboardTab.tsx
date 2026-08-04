"use client";

import React, { useEffect, useState, useCallback } from "react";
import { IndianRupee, Receipt, Percent, Landmark, Scale, Layers, Globe2 } from "lucide-react";
import { Card, adminColors } from "@/components/admin/ui";
import { fetchGstDashboard, GstDashboardData } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const RANGE_OPTIONS = [
  { label: "Today", days: 0 },
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "This month", days: -1 }, // handled specially below
];

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  emphasis,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  emphasis?: boolean;
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
        <div
          style={{
            fontFamily: bodyFont,
            fontSize: emphasis ? 24 : 20,
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

export default function GstDashboardTab({ restaurantId }: { restaurantId: string }) {
  const [rangeDays, setRangeDays] = useState(30);
  const [data, setData] = useState<GstDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (days: number) => {
      setLoading(true);
      setError(null);
      let from: Date;
      const to = new Date();
      if (days === -1) {
        from = new Date(to.getFullYear(), to.getMonth(), 1);
      } else if (days === 0) {
        from = new Date(to.getFullYear(), to.getMonth(), to.getDate());
      } else {
        from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
      }
      fetchGstDashboard(restaurantId, { from: from.toISOString(), to: to.toISOString() })
        .then(setData)
        .catch(() => setError("Couldn't load GST dashboard"))
        .finally(() => setLoading(false));
    },
    [restaurantId]
  );

  useEffect(() => {
    load(rangeDays);
  }, [rangeDays, load]);

  return (
    <div>
      {/* ---- Range filter ---- */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {RANGE_OPTIONS.map((opt) => (
          <button
            key={opt.label}
            onClick={() => setRangeDays(opt.days)}
            style={{
              padding: "8px 14px",
              borderRadius: 999,
              border: `1px solid ${rangeDays === opt.days ? adminColors.primary : adminColors.border}`,
              background: rangeDays === opt.days ? `${adminColors.primary}12` : "#FFFFFF",
              color: rangeDays === opt.days ? adminColors.primary : adminColors.textSecondary,
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

      {loading && (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>
      )}
      {error && (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.danger }}>{error}</p>
      )}

      {data && !loading && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
              marginBottom: 14,
            }}
          >
            <StatCard icon={IndianRupee} label="Total Sales" value={formatRupees(data.totalSales)} emphasis />
            <StatCard icon={Receipt} label="Taxable Sales" value={formatRupees(data.taxableSales)} emphasis />
            <StatCard icon={Percent} label="GST Collected" value={formatRupees(data.gstCollected)} emphasis />
            <StatCard icon={Landmark} label="GST Payable" value={formatRupees(data.gstPayable)} emphasis />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 14,
            }}
          >
            <StatCard icon={Scale} label="CGST Collected" value={formatRupees(data.cgstCollected)} />
            <StatCard icon={Scale} label="SGST Collected" value={formatRupees(data.sgstCollected)} />
            <StatCard icon={Layers} label="Orders in range" value={String(data.orderCount)} />
          </div>

         
        </>
      )}
    </div>
  );
}
