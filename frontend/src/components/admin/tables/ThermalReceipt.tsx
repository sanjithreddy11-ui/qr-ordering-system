"use client";

import React, { useState } from "react";
import { X, Printer } from "lucide-react";
import { adminColors } from "@/components/admin/ui";
import type { ReceiptData } from "@/lib/admin-api";
import { TablePrimaryButton } from "./tableButtons";
import { getGstBreakdown, getGstRateLabel } from "@/lib/billing";
import {
  columnsFor,
  money,
  divider,
  doubleDivider,
  wrapCenteredAddress,
  contactLine,
  sectionHeading,
  padRow,
  fieldRow,
  itemTableHeader,
  itemRows,
  modifierRows,
  capitalize,
  tableNumberOnly,
} from "@/lib/printer/receiptLayout";

type PaperWidth = "58" | "80";

// Full-screen preview + print trigger for a dining-session bill/receipt.
// The actual printable markup lives in a DOM node that is invisible on
// screen and made visible ONLY inside @media print, via the print CSS
// below — the standard "print just this element" technique, so it works
// with the plain browser print dialog (and therefore any thermal printer
// registered as a system printer) with no extra libraries.
export default function ThermalReceipt({
  receipt,
  heading,
  onClose,
  qzPrinted,
}: {
  receipt: ReceiptData;
  heading: string;
  onClose: () => void;
  /** True if this receipt was already sent to the thermal printer via QZ Tray. */
  qzPrinted?: boolean;
}) {
  const [width, setWidth] = useState<PaperWidth>("80");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,28,28,0.55)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "40px 16px",
        overflowY: "auto",
      }}
      className="thermal-receipt-overlay"
    >
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #thermal-receipt-print, #thermal-receipt-print * { visibility: visible; }
          #thermal-receipt-print {
            position: absolute;
            top: 0;
            left: 50%;
            transform: translateX(-50%);
            width: ${width}mm !important;
          }
          .thermal-receipt-overlay { position: static !important; background: none !important; padding: 0 !important; }
          .thermal-receipt-chrome { display: none !important; }
          @page { size: ${width}mm auto; margin: 0; }
        }
      `}</style>

      <div
        style={{
          background: "#FFFFFF",
          borderRadius: 14,
          padding: 20,
          width: "fit-content",
          minWidth: 320,
          maxWidth: "95vw",
          boxShadow: "0 20px 60px rgba(0,0,0,0.25)",
        }}
      >
        <div
          className="thermal-receipt-chrome"
          style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}
        >
          <span
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 15,
              fontWeight: 700,
              color: adminColors.text,
            }}
          >
            {heading}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: adminColors.textSecondary,
              display: "flex",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          className="thermal-receipt-chrome"
          style={{ display: "flex", gap: 8, marginBottom: 14, alignItems: "center" }}
        >
          <span
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 12,
              color: adminColors.textSecondary,
            }}
          >
            Printer width
          </span>
          {(["58", "80"] as PaperWidth[]).map((w) => (
            <button
              key={w}
              onClick={() => setWidth(w)}
              style={{
                padding: "4px 10px",
                borderRadius: 8,
                border: `1px solid ${width === w ? adminColors.primary : adminColors.border}`,
                background: width === w ? `${adminColors.primary}1A` : "#FFFFFF",
                color: width === w ? adminColors.primary : adminColors.textSecondary,
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {w}mm
            </button>
          ))}
        </div>

        {/* Printable receipt body — also shown on screen as a preview.
            Width is NOT locked to a fixed pixel budget or to `${width}mm`
            on screen — both of those are independent of how wide the
            48/32-character monospace content actually renders and were
            the real source of the clipping. The `<pre>` below sizes
            itself to `${cols}ch` (character units, derived from the same
            `cols` value used to build every row), which is guaranteed to
            exactly fit the text regardless of font/zoom. This wrapper
            just hugs that. The @media print rule above still forces the
            correct physical page size for actual printing. */}
        <div
          id="thermal-receipt-print"
          style={{
            width: "fit-content",
            maxWidth: "100%",
            margin: "0 auto",
            padding: "10px 8px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 12,
            color: "#111111",
            border: `1px dashed ${adminColors.border}`,
          }}
        >
          <ReceiptBody receipt={receipt} width={width === "80" ? 80 : 58} />
        </div>

        <div className="thermal-receipt-chrome" style={{ marginTop: 16 }}>
          <TablePrimaryButton onClick={() => window.print()}>
            <Printer size={15} /> Print via Browser (fallback)
          </TablePrimaryButton>
          <p
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 11,
              color: adminColors.textSecondary,
              margin: "8px 0 0",
            }}
          >
            {qzPrinted
              ? "This copy already went to the thermal printer via QZ Tray. Use this only to reprint manually."
              : "The QZ Tray print didn't go through — use this browser print button as a fallback."}
          </p>
        </div>
      </div>
    </div>
  );
}

function ReceiptBody({ receipt, width }: { receipt: ReceiptData; width: 58 | 80 }) {
  const { restaurant, table, session, cashierName, orders } = receipt;
  const { subtotal, taxableAmount, cgst, sgst, igst, gstEnabled, grandTotal } = getGstBreakdown(receipt);
  const cols = columnsFor(width);
  const LABEL_WIDTH = 10;

  // Every line pushed here is already exactly the width it should visually
  // occupy — "centered" lines are pre-padded with leading spaces by
  // centerLine/contactLine/sectionHeading/wrapCenteredAddress (all in
  // receiptLayout.ts). They're rendered as plain left-aligned monospace
  // text below: applying CSS text-align:center on top of that padding
  // would re-center an already-centered string and shift it off-center —
  // exactly the bug this fixes. One centering method, used once, so the
  // preview always matches the raw bytes sent to the printer.
  const lines: { text: string; bold?: boolean }[] = [];
  const push = (text: string, opts: { bold?: boolean } = {}) => lines.push({ text, ...opts });

  // ---- Header -----------------------------------------------------------
  if (restaurant?.address) wrapCenteredAddress(restaurant.address, cols).forEach((l) => push(l));
  if (restaurant?.phone) push(contactLine("Phone", restaurant.phone, cols));
  if (restaurant?.email) push(contactLine("Email", restaurant.email, cols));
  if (restaurant?.fssaiNumber) push(contactLine("FSSAI", restaurant.fssaiNumber, cols));
  if (restaurant?.gstNumber) push(contactLine("GSTIN", restaurant.gstNumber, cols));
  push(divider(cols));

  // ---- Order details ------------------------------------------------------
  push(sectionHeading("DINE-IN", cols), { bold: true });
  push(fieldRow("Table", tableNumberOnly(table.label), LABEL_WIDTH));
  if (session.tokenNumber != null && session.tokenNumber !== "") {
    push(fieldRow("Token", String(session.tokenNumber), LABEL_WIDTH));
  }
  push(fieldRow("Invoice", session.invoiceNumber || "Pending", LABEL_WIDTH));
  push(fieldRow("Date", new Date(receipt.generatedAt).toLocaleDateString("en-IN"), LABEL_WIDTH));
  push(fieldRow("Time", new Date(receipt.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), LABEL_WIDTH));
  if (cashierName) push(fieldRow("Cashier", cashierName, LABEL_WIDTH));
  if (session.customerName) push(fieldRow("Customer", session.customerName, LABEL_WIDTH));
  if (session.phoneNumber) push(fieldRow("Phone", session.phoneNumber, LABEL_WIDTH));
  push(divider(cols));

  // ---- Items table --------------------------------------------------------
  push(itemTableHeader(cols), { bold: true });
  push(divider(cols));
  orders.forEach((o) => {
    o.items.forEach((it) => {
      itemRows(it.quantity, it.name, money(it.price * it.quantity), cols).forEach((row) => push(row));
      // Menu Item Customization (Modifiers): shown in the on-screen
      // preview exactly as it will print — same helper, same source data,
      // as buildEscPosReceipt in lib/printer/escpos.ts.
      if (it.modifiers && it.modifiers.length > 0) {
        modifierRows(it.modifiers, cols).forEach((row) => push(row));
      }
    });
  });
  push(divider(cols));

  // ---- Bill summary -------------------------------------------------------
  push(padRow("Subtotal", money(subtotal), cols));
  // GST Management Module: hidden entirely when the admin has GST switched
  // off (GST Settings -> GST Enabled), rather than showing a row of zeroes.
  if (gstEnabled) {
    push(padRow("Taxable Amt", money(taxableAmount), cols));
    push(padRow(`CGST (${getGstRateLabel(cgst, taxableAmount) || "0%"})`, money(cgst), cols));
    push(padRow(`SGST (${getGstRateLabel(sgst, taxableAmount) || "0%"})`, money(sgst), cols));
    if (igst) push(padRow(`IGST (${getGstRateLabel(igst, taxableAmount)})`, money(igst), cols));
    push(padRow("Total GST", money(receipt.gst), cols));
  }
  if (receipt.discount) push(padRow("Discount", `-${money(receipt.discount)}`, cols));
  if (receipt.roundOff) push(padRow("Round Off", money(receipt.roundOff), cols));

  // ---- Total ----------------------------------------------------------------
  push(doubleDivider(cols));
  push(padRow("TOTAL", money(grandTotal), cols), { bold: true });
  push(doubleDivider(cols));

  // ---- Payment details ------------------------------------------------------
  push(fieldRow("Payment", capitalize(session.paymentMethod || "-"), LABEL_WIDTH));
  push(fieldRow("Status", session.paymentStatus === "paid" ? "Paid" : "Pending", LABEL_WIDTH));
  push(divider(cols));

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 4 }}>
        <div style={{ fontWeight: 700, fontSize: 17, letterSpacing: 0.3 }}>{restaurant?.name || "Restaurant"}</div>
      </div>
      <pre
        style={{
          margin: 0,
          width: `${cols}ch`,
          fontFamily: "'Courier New', Courier, monospace",
          fontSize: 12,
          lineHeight: 1.4,
          whiteSpace: "pre",
          textAlign: "left",
        }}
      >
        {lines.map((l, i) => (
          <div
            key={i}
            style={{
              fontWeight: l.bold ? 700 : 400,
            }}
          >
            {l.text || "\u00A0"}
          </div>
        ))}
      </pre>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <div style={{ fontWeight: 700 }}>THANK YOU!</div>
        <div style={{ marginTop: 2 }}>Visit Again</div>
        <div style={{ fontSize: 10, opacity: 0.7, marginTop: 6 }}>Powered by Denova</div>
        
      </div>
    </div>
  );
}