"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, adminColors } from "@/components/admin/ui";
import { fetchPurchaseHistory, PurchaseRecord } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const cellStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  padding: "12px 16px",
  borderBottom: `1px solid ${adminColors.border}`,
};

// Read-only ledger of every restock — see components/admin/ui.tsx' Card
// for the shared surface. Rows are written by POST /api/admin/inventory/
// purchase (the "Purchase Stock" modal on the Inventory tab).
export default function PurchaseHistoryTab({ restaurantId }: { restaurantId: string }) {
  const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetchPurchaseHistory(restaurantId)
      .then(setPurchases)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  if (loading) {
    return <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>;
  }

  if (purchases.length === 0) {
    return (
      <Card>
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
          No purchases recorded yet — restock an ingredient from the Inventory tab to see it here.
        </p>
      </Card>
    );
  }

  return (
    <Card style={{ padding: 0 }}>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ textAlign: "left" }}>
              {["Purchase Date", "Supplier", "Ingredient", "Quantity", "Cost", "Added By"].map((h) => (
                <th
                  key={h}
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 11,
                    fontWeight: 700,
                    color: adminColors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "12px 16px",
                    borderBottom: `1px solid ${adminColors.border}`,
                  }}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {purchases.map((p) => (
              <tr key={p._id}>
                <td style={cellStyle}>{new Date(p.purchaseDate).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}</td>
                <td style={cellStyle}>{p.supplierName || "—"}</td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>{p.ingredientName}</td>
                <td style={cellStyle}>
                  {p.quantity} {p.unit}
                </td>
                <td style={{ ...cellStyle, fontWeight: 700 }}>₹ {p.cost.toLocaleString("en-IN")}</td>
                <td style={cellStyle}>{p.addedBy || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
