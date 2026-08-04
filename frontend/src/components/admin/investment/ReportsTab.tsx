"use client";

import React, { useState } from "react";
import { FileDown, FileSpreadsheet, Printer } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Select, adminColors } from "@/components/admin/ui";
import { fetchInvestmentReport, InvestmentReportData, InvestmentReportType } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

const REPORT_TYPES: { value: InvestmentReportType; label: string }[] = [
  { value: "daily", label: "Daily Expense Report" },
  { value: "weekly", label: "Weekly Expense Report" },
  { value: "monthly", label: "Monthly Expense Report" },
  { value: "gst", label: "GST Report" },
  { value: "vendor", label: "Vendor Report" },
  { value: "purchase", label: "Purchase Report" },
  { value: "investment", label: "Investment Report (Assets)" },
  { value: "pnl", label: "Profit & Loss Report" },
];

export default function ReportsTab({ restaurantId }: { restaurantId: string }) {
  const today = new Date();
  const [type, setType] = useState<InvestmentReportType>("monthly");
  const [fromDate, setFromDate] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth() - 2, 1)));
  const [toDate, setToDate] = useState(toInputDate(today));
  const [report, setReport] = useState<InvestmentReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(fromDate).toISOString();
      const to = new Date(new Date(toDate).setHours(23, 59, 59, 999)).toISOString();
      const data = await fetchInvestmentReport(restaurantId, { type, from, to });
      setReport(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleExportExcel = async () => {
    if (!report) return;
    const XLSX = await import("xlsx");
    const sheetRows = report.rows.map((row) => Object.fromEntries(report.columns.map((c, i) => [c, row[i]])));
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type);
    XLSX.writeFile(wb, `${type}-report-${fromDate}-to-${toDate}.xlsx`);
  };

  const handleExportPdf = async () => {
    if (!report) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(REPORT_TYPES.find((r) => r.value === type)?.label ?? "Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Range: ${fromDate} to ${toDate}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [report.columns],
      body: report.rows.map((row) => row.map(String)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [58, 76, 59] },
    });

    doc.save(`${type}-report-${fromDate}-to-${toDate}.pdf`);
  };

  return (
    <div>
      <div className="investment-report-no-print">
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select label="Report Type" value={type} onChange={(v) => setType(v as InvestmentReportType)} options={REPORT_TYPES} />
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>From</span>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 14 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>To</span>
              <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={{ padding: "10px 12px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 14 }} />
            </label>
            <PrimaryButton onClick={runReport} disabled={loading}>
              {loading ? "Generating…" : "Generate Report"}
            </PrimaryButton>
            {report && (
              <>
                <SecondaryButton onClick={handlePrint}>
                  <Printer size={14} /> Print
                </SecondaryButton>
                <SecondaryButton onClick={handleExportExcel}>
                  <FileSpreadsheet size={14} /> Excel
                </SecondaryButton>
                <SecondaryButton onClick={handleExportPdf}>
                  <FileDown size={14} /> PDF
                </SecondaryButton>
              </>
            )}
          </div>
          {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13, marginTop: 10 }}>{error}</p>}
        </Card>
      </div>

      {report && (
        <Card style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: bodyFont, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${adminColors.border}`, textAlign: "left" }}>
                {report.columns.map((c) => (
                  <th key={c} style={{ padding: "12px 14px", color: adminColors.textSecondary, fontSize: 11, textTransform: "uppercase" }}>
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {report.rows.length === 0 && (
                <tr>
                  <td colSpan={report.columns.length} style={{ padding: 20, textAlign: "center", color: adminColors.textSecondary }}>
                    No data for this range.
                  </td>
                </tr>
              )}
              {report.rows.map((row, i) => (
                <tr key={i} style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                  {row.map((cell, j) => (
                    <td key={j} style={{ padding: "10px 14px" }}>
                      {String(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
