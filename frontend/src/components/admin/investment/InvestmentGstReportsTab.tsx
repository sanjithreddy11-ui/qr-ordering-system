"use client";

import React, { useState } from "react";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Select, adminColors } from "@/components/admin/ui";
import { fetchInvestmentGstReport, InvestmentGstReportRow } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

type RangeMode = "daily" | "monthly" | "custom";

export default function InvestmentGstReportsTab({ restaurantId }: { restaurantId: string }) {
  const today = new Date();
  const [mode, setMode] = useState<RangeMode>("monthly");
  const [fromDate, setFromDate] = useState(toInputDate(new Date(today.getFullYear(), today.getMonth(), 1)));
  const [toDate, setToDate] = useState(toInputDate(today));
  const [rows, setRows] = useState<InvestmentGstReportRow[]>([]);
  const [totals, setTotals] = useState<Omit<InvestmentGstReportRow, "period"> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyMode = (next: RangeMode) => {
    setMode(next);
    const now = new Date();
    if (next === "daily") {
      setFromDate(toInputDate(now));
      setToDate(toInputDate(now));
    } else if (next === "monthly") {
      setFromDate(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(toInputDate(now));
    }
  };

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      const groupBy = mode === "monthly" ? "month" : "day";
      const data = await fetchInvestmentGstReport(restaurantId, { from: from.toISOString(), to: to.toISOString(), groupBy });
      setRows(data.rows);
      setTotals(data.totals);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate the GST report");
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => window.print();

  const handleExportExcel = async () => {
    if (!totals) return;
    const XLSX = await import("xlsx");
    const sheetRows = rows.map((r) => ({
      Period: r.period,
      "Taxable Amount": r.taxableAmount,
      CGST: r.cgst,
      SGST: r.sgst,
      IGST: r.igst,
      "Input GST": r.inputGst,
      Purchases: r.purchaseCount,
    }));
    sheetRows.push({
      Period: "TOTAL",
      "Taxable Amount": totals.taxableAmount,
      CGST: totals.cgst,
      SGST: totals.sgst,
      IGST: totals.igst,
      "Input GST": totals.inputGst,
      Purchases: totals.purchaseCount,
    });
    const ws = XLSX.utils.json_to_sheet(sheetRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Input GST Report");
    XLSX.writeFile(wb, `input-gst-report-${fromDate}-to-${toDate}.xlsx`);
  };

  const handleExportPdf = async () => {
    if (!totals) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("Input GST Report (Purchases)", 14, 16);
    doc.setFontSize(10);
    doc.text(`Range: ${fromDate} to ${toDate}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Period", "Taxable Amount", "CGST", "SGST", "IGST", "Input GST", "Purchases"]],
      body: [
        ...rows.map((r) => [r.period, formatRupees(r.taxableAmount), formatRupees(r.cgst), formatRupees(r.sgst), formatRupees(r.igst), formatRupees(r.inputGst), String(r.purchaseCount)]),
        ["TOTAL", formatRupees(totals.taxableAmount), formatRupees(totals.cgst), formatRupees(totals.sgst), formatRupees(totals.igst), formatRupees(totals.inputGst), String(totals.purchaseCount)],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [58, 76, 59] },
    });

    doc.save(`input-gst-report-${fromDate}-to-${toDate}.pdf`);
  };

  return (
    <div>
      <div className="investment-report-no-print">
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select
              label="Report Type"
              value={mode}
              onChange={(v) => applyMode(v as RangeMode)}
              options={[
                { value: "daily", label: "Daily" },
                { value: "monthly", label: "Monthly" },
                { value: "custom", label: "Custom Date Range" },
              ]}
            />
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
            {totals && (
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

      {totals && (
        <Card style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: bodyFont, fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${adminColors.border}`, textAlign: "left" }}>
                {["Period", "Taxable Amount", "CGST", "SGST", "IGST", "Input GST", "Purchases"].map((h) => (
                  <th key={h} style={{ padding: "12px 14px", color: adminColors.textSecondary, fontSize: 11, textTransform: "uppercase" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.period} style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                  <td style={{ padding: "10px 14px" }}>{r.period}</td>
                  <td style={{ padding: "10px 14px" }}>{formatRupees(r.taxableAmount)}</td>
                  <td style={{ padding: "10px 14px" }}>{formatRupees(r.cgst)}</td>
                  <td style={{ padding: "10px 14px" }}>{formatRupees(r.sgst)}</td>
                  <td style={{ padding: "10px 14px" }}>{formatRupees(r.igst)}</td>
                  <td style={{ padding: "10px 14px", fontWeight: 700 }}>{formatRupees(r.inputGst)}</td>
                  <td style={{ padding: "10px 14px" }}>{r.purchaseCount}</td>
                </tr>
              ))}
              <tr style={{ fontWeight: 800 }}>
                <td style={{ padding: "10px 14px" }}>TOTAL</td>
                <td style={{ padding: "10px 14px" }}>{formatRupees(totals.taxableAmount)}</td>
                <td style={{ padding: "10px 14px" }}>{formatRupees(totals.cgst)}</td>
                <td style={{ padding: "10px 14px" }}>{formatRupees(totals.sgst)}</td>
                <td style={{ padding: "10px 14px" }}>{formatRupees(totals.igst)}</td>
                <td style={{ padding: "10px 14px" }}>{formatRupees(totals.inputGst)}</td>
                <td style={{ padding: "10px 14px" }}>{totals.purchaseCount}</td>
              </tr>
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
