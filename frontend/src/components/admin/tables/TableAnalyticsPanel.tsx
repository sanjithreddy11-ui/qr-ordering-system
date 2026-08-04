"use client";

import React from "react";
import { Card, adminColors } from "@/components/admin/ui";
import type { TableAnalyticsData } from "@/lib/admin-api";

export default function TableAnalyticsPanel({ analytics }: { analytics: TableAnalyticsData }) {
  const stats: { label: string; value: string | number }[] = [
    { label: "Occupied", value: analytics.counts.occupied ?? 0 },
    { label: "Available", value: analytics.counts.available ?? 0 },
    { label: "Reserved", value: analytics.counts.reserved ?? 0 },
    { label: "Cleaning", value: analytics.counts.cleaning ?? 0 },
    { label: "Avg. Dining Duration", value: `${analytics.averageDiningDurationMinutes}m` },
    { label: "Avg. Turnover / Table", value: analytics.averageTurnoverPerTable },
  ];

  return (
    <Card style={{ marginBottom: 20 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
          gap: 16,
        }}
      >
        {stats.map((s) => (
          <div key={s.label}>
            <div
              style={{
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontVariantNumeric: "tabular-nums",
                fontSize: 26,
                fontWeight: 700,
                color: adminColors.text,
              }}
            >
              {s.value}
            </div>
            <div
              style={{
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 11,
                color: adminColors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
