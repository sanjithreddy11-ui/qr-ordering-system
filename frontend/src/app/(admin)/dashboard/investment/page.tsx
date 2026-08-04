"use client";

import React, { useState } from "react";
import { PageHeader, adminColors } from "@/components/admin/ui";
import { useAuthStore } from "@/store/auth-store";
import OverviewTab from "@/components/admin/investment/OverviewTab";
import PurchasesTab from "@/components/admin/investment/PurchasesTab";
import ExpensesTab from "@/components/admin/investment/ExpensesTab";
import AssetsTab from "@/components/admin/investment/AssetsTab";
import VendorsTab from "@/components/admin/investment/VendorsTab";
import InvestmentGstReportsTab from "@/components/admin/investment/InvestmentGstReportsTab";
import ProfitAnalysisTab from "@/components/admin/investment/ProfitAnalysisTab";
import ReportsTab from "@/components/admin/investment/ReportsTab";
import SettingsTab from "@/components/admin/investment/SettingsTab";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants — matches the convention already used on the GST page

type InvestmentTab = "overview" | "purchases" | "expenses" | "assets" | "vendors" | "gst" | "profit" | "reports" | "settings";

const TABS: { key: InvestmentTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "purchases", label: "Purchases" },
  { key: "expenses", label: "Expenses" },
  { key: "assets", label: "Assets" },
  { key: "vendors", label: "Vendors" },
  { key: "gst", label: "GST Reports" },
  { key: "profit", label: "Profit Analysis" },
  { key: "reports", label: "Reports" },
  { key: "settings", label: "Settings" },
];

export default function InvestmentExpensesPage() {
  const [activeTab, setActiveTab] = useState<InvestmentTab>("overview");
  const staff = useAuthStore((s) => s.staff);

  // Owner/Admin-only module — the backend already rejects non-admin
  // requests with a 403 (see requireAdminRole), this is just the
  // client-side mirror of that so non-admin staff see a clear message
  // instead of a page full of failed requests.
  if (staff && staff.role !== "admin") {
    return (
      <div>
        <PageHeader title="Investment & Expenses" description="Restricted section" />
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 14, color: adminColors.textSecondary }}>
          This section is only available to restaurant admins.
        </p>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Investment & Expenses"
        description="Track purchases, Input GST, vendors, assets, and business expenses"
      />

      <div className="investment-report-no-print" style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${adminColors.border}`, flexWrap: "wrap" }}>
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

      {activeTab === "overview" && <OverviewTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "purchases" && <PurchasesTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "expenses" && <ExpensesTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "assets" && <AssetsTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "vendors" && <VendorsTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "gst" && <InvestmentGstReportsTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "profit" && <ProfitAnalysisTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "reports" && <ReportsTab restaurantId={RESTAURANT_ID} />}
      {activeTab === "settings" && <SettingsTab restaurantId={RESTAURANT_ID} />}
    </div>
  );
}
