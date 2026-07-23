"use client";

import React from "react";
import { Tag, Percent, Ticket, Sun, PartyPopper } from "lucide-react";
import { PageHeader, Card, adminColors } from "@/components/admin/ui";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const SECTIONS = [
  { icon: Ticket, title: "Coupons", description: "One-off or reusable codes customers apply at checkout." },
  { icon: Percent, title: "Discount Campaigns", description: "Percentage or flat discounts across the menu or a category." },
  { icon: Tag, title: "Promo Codes", description: "Time-limited codes for marketing pushes." },
  { icon: Sun, title: "Happy Hour Offers", description: "Automatic discounts during set hours of the day." },
  { icon: PartyPopper, title: "Festival Offers", description: "Seasonal campaigns tied to specific dates." },
];

// No offers/coupons backend exists yet — this page is a ready-to-wire
// shell for that future module.
export default function AdminOffersPage() {
  return (
    <div>
      <PageHeader title="Offers" description="Coupons, discounts, and promotional campaigns" />

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
          <Tag size={26} color={adminColors.primary} />
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 700, color: adminColors.text, marginBottom: 6 }}>
          No offers yet
        </div>
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, maxWidth: 420, margin: "0 auto" }}>
          This page is ready for the Offers module. Once coupons and campaigns can be created, they&apos;ll be managed here.
        </p>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16 }}>
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
