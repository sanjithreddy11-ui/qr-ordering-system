"use client";

import React, { useState } from "react";
import { PageHeader, adminColors } from "@/components/admin/ui";
import GstDashboardTab from "@/components/admin/gst/GstDashboardTab";
import GstSettingsTab from "@/components/admin/gst/GstSettingsTab";
import GstSlabsTab from "@/components/admin/gst/GstSlabsTab";
import GstReportsTab from "@/components/admin/gst/GstReportsTab";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants

type GstTab = "dashboard" | "settings" | "slabs" | "reports";

const TABS: { key: GstTab; label: string }[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "settings", label: "GST Settings" },
  { key: "slabs", label: "GST Slabs" },
  { key: "reports", label: "GST Reports" },
];

export default function GstManagementPage() {
  const [activeTab, setActiveTab] = useState<GstTab>("dashboard");

  return (
    <div>
      <PageHeader
        title="GST Management"
        description="Configure GST, review collections, and generate tax reports for this restaurant"
      />

      {/* ---- Tabs ---- */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${adminColors.border}` }}>
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === tab.key ? adminColors.primary : adminColors.textSecondary,
              borderBottom: `2px solid ${activeTab === tab.key ? adminColors.primary : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "dashboard" && <GstDashboardTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "settings" && <GstSettingsTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "slabs" && <GstSlabsTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "reports" && <GstReportsTab restaurantId={RESTAURANT_ID} />}
    </div>
  );
}
