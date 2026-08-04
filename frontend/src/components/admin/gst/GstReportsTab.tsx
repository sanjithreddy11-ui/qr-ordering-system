"use client";

import React, { useState } from "react";
import { Printer, FileDown, FileSpreadsheet } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Select, adminColors } from "@/components/admin/ui";
import { fetchGstReport, GstReportData } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

type RangeMode = "daily" | "monthly" | "custom";

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

export default function GstReportsTab({ restaurantId }: { restaurantId: string }) {
  const today = new Date();
  const [mode, setMode] = useState<RangeMode>("daily");
  const [fromDate, setFromDate] = useState(toInputDate(today));
  const [toDate, setToDate] = useState(toInputDate(today));
  const [report, setReport] = useState<GstReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applyMode = (next: RangeMode) => {
    setMode(next);
    const now = new Date();
    if (next === "daily") {
      const d = toInputDate(now);
      setFromDate(d);
      setToDate(d);
    } else if (next === "monthly") {
      setFromDate(toInputDate(new Date(now.getFullYear(), now.getMonth(), 1)));
      setToDate(toInputDate(now));
    }
    // "custom" leaves the current from/to dates for the admin to edit
  };

  const runReport = async () => {
    setLoading(true);
    setError(null);
    try {
      const from = new Date(fromDate);
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      const groupBy = mode === "monthly" ? "month" : "day";
      const data = await fetchGstReport(restaurantId, from.toISOString(), to.toISOString(), groupBy);
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
    const rows = report.rows.map((r) => ({
      Period: r.period,
      "Total Sales": r.totalSales,
      "Taxable Sales": r.taxableSales,
      CGST: r.cgstCollected,
      SGST: r.sgstCollected,
      IGST: r.igstCollected,
      "GST Collected": r.gstCollected,
      Orders: r.orderCount,
    }));
    rows.push({
      Period: "TOTAL",
      "Total Sales": report.summary.totalSales,
      "Taxable Sales": report.summary.taxableSales,
      CGST: report.summary.cgstCollected,
      SGST: report.summary.sgstCollected,
      IGST: report.summary.igstCollected,
      "GST Collected": report.summary.gstCollected,
      Orders: report.summary.orderCount,
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GST Report");
    XLSX.writeFile(wb, `gst-report-${fromDate}-to-${toDate}.xlsx`);
  };

  const handleExportPdf = async () => {
    if (!report) return;
    const { default: jsPDF } = await import("jspdf");
    const autoTableModule = await import("jspdf-autotable");
    const autoTable = autoTableModule.default;

    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("GST Report", 14, 16);
    doc.setFontSize(10);
    doc.text(`Range: ${fromDate} to ${toDate}`, 14, 22);

    autoTable(doc, {
      startY: 28,
      head: [["Period", "Total Sales", "Taxable Sales", "CGST", "SGST", "IGST", "GST Collected", "Orders"]],
      body: [
        ...report.rows.map((r) => [
          r.period,
          formatRupees(r.totalSales),
          formatRupees(r.taxableSales),
          formatRupees(r.cgstCollected),
          formatRupees(r.sgstCollected),
          formatRupees(r.igstCollected),
          formatRupees(r.gstCollected),
          String(r.orderCount),
        ]),
        [
          "TOTAL",
          formatRupees(report.summary.totalSales),
          formatRupees(report.summary.taxableSales),
          formatRupees(report.summary.cgstCollected),
          formatRupees(report.summary.sgstCollected),
          formatRupees(report.summary.igstCollected),
          formatRupees(report.summary.gstCollected),
          String(report.summary.orderCount),
        ],
      ],
      styles: { fontSize: 8 },
      headStyles: { fillColor: [58, 76, 59] },
    });

    doc.save(`gst-report-${fromDate}-to-${toDate}.pdf`);
  };

  return (
    <div>
      {/* ---- Filters — hidden on print, only the report table below prints ---- */}
      <div className="gst-report-no-print">
        <Card style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-end" }}>
            <Select
              label="Report Type"
              value={mode}
              onChange={(v) => applyMode(v as RangeMode)}
              options={[
                { value: "daily", label: "Daily Report" },
                { value: "monthly", label: "Monthly Report" },
                { value: "custom", label: "Custom Date Range" },
              ]}
            />
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontFamily: bodyFont,
                  fontSize: 12,
                  fontWeight: 700,
                  color: adminColors.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                From
              </span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${adminColors.border}`,
                  fontFamily: bodyFont,
                  fontSize: 14,
                  color: adminColors.text,
                  outline: "none",
                }}
              />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span
                style={{
                  fontFamily: bodyFont,
                  fontSize: 12,
                  fontWeight: 700,
                  color: adminColors.textSecondary,
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                To
              </span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{
                  padding: "10px 12px",
                  borderRadius: 8,
                  border: `1px solid ${adminColors.border}`,
                  fontFamily: bodyFont,
                  fontSize: 14,
                  color: adminColors.text,
                  outline: "none",
                }}
              />
            </label>
            <PrimaryButton onClick={runReport} disabled={loading}>
              {loading ? "Generating…" : "Generate Report"}
            </PrimaryButton>
          </div>
        </Card>

        {error && (
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.danger, marginBottom: 16 }}>{error}</p>
        )}

        {report && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <SecondaryButton onClick={handlePrint}>
              <Printer size={14} /> Print
            </SecondaryButton>
            <SecondaryButton onClick={handleExportPdf}>
              <FileDown size={14} /> PDF Export
            </SecondaryButton>
            <SecondaryButton onClick={handleExportExcel}>
              <FileSpreadsheet size={14} /> Excel Export
            </SecondaryButton>
          </div>
        )}
      </div>

      {report && (
        <Card>
          <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text, marginBottom: 4 }}>
            GST Summary — {fromDate} to {toDate}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
              gap: 12,
              margin: "14px 0 20px",
            }}
          >
            {[
              ["Total Sales", report.summary.totalSales],
              ["Taxable Sales", report.summary.taxableSales],
              ["GST Collected", report.summary.gstCollected],
              ["CGST", report.summary.cgstCollected],
              ["SGST", report.summary.sgstCollected],
              ["IGST", report.summary.igstCollected],
            ].map(([label, value]) => (
              <div key={label as string}>
                <div
                  style={{
                    fontFamily: bodyFont,
                    fontSize: 11,
                    fontWeight: 700,
                    color: adminColors.textSecondary,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    marginBottom: 2,
                  }}
                >
                  {label}
                </div>
                <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 800, color: adminColors.text }}>
                  {formatRupees(value as number)}
                </div>
              </div>
            ))}
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: bodyFont, fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                  {["Period", "Total Sales", "Taxable Sales", "CGST", "SGST", "IGST", "GST Collected", "Orders"].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          textAlign: "left",
                          padding: "8px 10px",
                          fontSize: 11,
                          fontWeight: 700,
                          color: adminColors.textSecondary,
                          textTransform: "uppercase",
                          letterSpacing: "0.04em",
                        }}
                      >
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {report.rows.map((r) => (
                  <tr key={r.period} style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                    <td style={{ padding: "8px 10px", fontWeight: 600, color: adminColors.text }}>{r.period}</td>
                    <td style={{ padding: "8px 10px", color: adminColors.text }}>{formatRupees(r.totalSales)}</td>
                    <td style={{ padding: "8px 10px", color: adminColors.text }}>{formatRupees(r.taxableSales)}</td>
                    <td style={{ padding: "8px 10px", color: adminColors.text }}>{formatRupees(r.cgstCollected)}</td>
                    <td style={{ padding: "8px 10px", color: adminColors.text }}>{formatRupees(r.sgstCollected)}</td>
                    <td style={{ padding: "8px 10px", color: adminColors.text }}>{formatRupees(r.igstCollected)}</td>
                    <td style={{ padding: "8px 10px", fontWeight: 700, color: adminColors.text }}>
                      {formatRupees(r.gstCollected)}
                    </td>
                    <td style={{ padding: "8px 10px", color: adminColors.text }}>{r.orderCount}</td>
                  </tr>
                ))}
                {report.rows.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ padding: "16px 10px", color: adminColors.textSecondary }}>
                      No GST-relevant orders in this range.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <style>{`
        @media print {
          .gst-report-no-print { display: none !important; }
        }
      `}</style>
    </div>
  );
}
