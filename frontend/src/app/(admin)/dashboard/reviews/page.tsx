"use client";

import React from "react";
import { Star, MessageSquare, BarChart3 } from "lucide-react";
import { PageHeader, Card, adminColors } from "@/components/admin/ui";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const SECTIONS = [
  { icon: Star, title: "Ratings", description: "Star ratings collected from customers after their order." },
  { icon: MessageSquare, title: "Customer Reviews", description: "Written feedback tied to individual orders." },
  { icon: BarChart3, title: "Review Analytics", description: "Rating trends over time and by menu item." },
];

// No review data model exists yet — this page is a ready-to-wire shell,
// matching the "Recent Reviews" placeholder that used to live on the
// Dashboard. Hook it up once a Review model + endpoints are built.
export default function AdminReviewsPage() {
  return (
    <div>
      <PageHeader title="Reviews" description="Customer feedback, ratings, and review analytics" />

      <Card style={{ textAlign: "center", padding: "48px 24px", marginBottom: 20 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: `${adminColors.primary}12`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <Star size={26} color={adminColors.primary} />
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 700, color: adminColors.text, marginBottom: 6 }}>
          No reviews yet
        </div>
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, maxWidth: 420, margin: "0 auto" }}>
          This page is ready for the Reviews module. Once customers can rate and review their orders, ratings, feedback, and analytics will appear here.
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
              <s.icon size={17} color={adminColors.primary} />
              <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text }}>{s.title}</div>
            </div>
            <p style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, margin: 0 }}>{s.description}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
