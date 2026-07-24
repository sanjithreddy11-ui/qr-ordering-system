"use client";

import React, { useState } from "react";
import { X, Printer } from "lucide-react";
import { adminColors } from "@/components/admin/ui";
import type { ReceiptData } from "@/lib/admin-api";
import { formatCurrency, formatTime } from "./tableStatus";
import { TablePrimaryButton } from "./tableButtons";

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
}: {
  receipt: ReceiptData;
  heading: string;
  onClose: () => void;
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
            left: 0;
            width: ${width}mm;
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
          width: 380,
          maxWidth: "100%",
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

        {/* Printable receipt body — also shown on screen as a preview */}
        <div
          id="thermal-receipt-print"
          style={{
            width: `${width}mm`,
            maxWidth: "100%",
            margin: "0 auto",
            padding: "10px 8px",
            fontFamily: "'Courier New', Courier, monospace",
            fontSize: 12,
            color: "#111111",
            border: `1px dashed ${adminColors.border}`,
          }}
        >
          <ReceiptBody receipt={receipt} />
        </div>

        <div className="thermal-receipt-chrome" style={{ marginTop: 16 }}>
          <TablePrimaryButton onClick={() => window.print()}>
            <Printer size={15} /> Print
          </TablePrimaryButton>
        </div>
      </div>
    </div>
  );
}

function ReceiptBody({ receipt }: { receipt: ReceiptData }) {
  const { restaurant, table, session, cashierName, orders, subtotal, gst, grandTotal } = receipt;

  return (
    <div style={{ lineHeight: 1.5 }}>
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {restaurant?.logo && (
          // Thermal printers render this as-is; kept small and optional.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={restaurant.logo} alt="" style={{ height: 36, margin: "0 auto 4px", display: "block" }} />
        )}
        <div style={{ fontWeight: 700, fontSize: 14 }}>{restaurant?.name || "Restaurant"}</div>
        {restaurant?.address && <div>{restaurant.address}</div>}
        {restaurant?.phone && <div>Ph: {restaurant.phone}</div>}
        {restaurant?.gstNumber && <div>GSTIN: {restaurant.gstNumber}</div>}
      </div>

      <Divider />

      <Row label="Invoice #" value={session.invoiceNumber || "—"} />
      <Row label="Date" value={new Date(receipt.generatedAt).toLocaleString("en-IN")} />
      <Row label="Table" value={table.label} />
      <Row label="Session" value={session.sessionId} />
      <Row label="Cashier" value={cashierName || "—"} />
      {session.customerName && <Row label="Customer" value={session.customerName} />}
      {session.phoneNumber && <Row label="Phone" value={session.phoneNumber} />}

      <Divider />

      {orders.map((o, i) => (
        <div key={o.orderId} style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 700 }}>
            Order #{i + 1} · {formatTime(o.placedAt)}
          </div>
          {o.items.map((it, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between" }}>
              <span>
                {it.quantity} x {it.name}
              </span>
              <span>{formatCurrency(it.price * it.quantity)}</span>
            </div>
          ))}
        </div>
      ))}

      <Divider />

      <Row label="Subtotal" value={formatCurrency(subtotal)} />
      <Row label="GST" value={formatCurrency(gst)} />
      <Row label="Grand Total" value={formatCurrency(grandTotal)} bold />

      <Divider />

      <Row label="Payment Method" value={(session.paymentMethod || "—").toUpperCase()} />
      <Row label="Payment Status" value={session.paymentStatus === "paid" ? "PAID" : "PENDING"} />
      {session.transactionId && <Row label="Transaction ID" value={session.transactionId} />}
      {session.paidAt && <Row label="Paid At" value={new Date(session.paidAt).toLocaleString("en-IN")} />}

      <div style={{ textAlign: "center", marginTop: 10 }}>
        <div style={{ fontWeight: 700 }}>Thank You!</div>
        <div>Visit Again</div>
      </div>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px dashed #999", margin: "6px 0" }} />;
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontWeight: bold ? 700 : 400 }}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
