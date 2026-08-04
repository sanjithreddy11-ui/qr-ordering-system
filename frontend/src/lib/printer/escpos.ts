// ESC/POS receipt formatting for the Rugtek RP-326 (80mm, Font A = 48
// columns; 58mm fallback = 32 columns). Builds a single raw-bytes string
// handed to QZ Tray's `raw` print type — no HTML, just the control codes
// every ESC/POS-compatible thermal printer understands.
//
// The actual column layout (label/value alignment, item-table wrapping,
// dividers) lives in receiptLayout.ts and is shared with the browser
// preview (ThermalReceipt.tsx) so the two can never visually disagree.

import type { ReceiptData } from "@/lib/admin-api";
import { getGstBreakdown, getGstRateLabel } from "@/lib/billing";
import {
  columnsFor,
  money,
  divider,
  doubleDivider,
  centerLine,
  wrapCenteredAddress,
  contactLine,
  sectionHeading,
  padRow,
  fieldRow,
  itemTableHeader,
  itemRows,
  capitalize,
  tableNumberOnly,
} from "./receiptLayout";

const ESC = "\x1B";
const GS = "\x1D";

const CMD = {
  INIT: `${ESC}@`,
  ALIGN_LEFT: `${ESC}a0`,
  ALIGN_CENTER: `${ESC}a1`,
  BOLD_ON: `${ESC}E1`,
  BOLD_OFF: `${ESC}E0`,
  DOUBLE_ON: `${GS}!\x11`, // double width + double height
  DOUBLE_OFF: `${GS}!\x00`,
  FEED: (lines: number) => `${ESC}d${String.fromCharCode(lines)}`,
  CUT: `${GS}V\x42\x00`, // partial cut, no extra feed
};

// Header label column ("Bill No", "Invoice No", "Customer", ...) — sized
// to the longest label so every colon lines up.
const HEADER_LABEL_WIDTH = 10;

/** Builds the full ESC/POS payload for a session bill/receipt, ready for qzClient.printRaw(). */
export async function buildEscPosReceipt(receipt: ReceiptData, width: 58 | 80 = 80): Promise<string> {
  const cols = columnsFor(width);
  const { restaurant, table, session, cashierName, orders } = receipt;
  const { subtotal, taxableAmount, cgst, sgst, igst, gstEnabled, grandTotal } = getGstBreakdown(receipt);

  // Every "centered" line below is centered exactly once, by padding it
  // with the correct number of leading spaces (centerLine/contactLine/
  // sectionHeading, all in receiptLayout.ts). Alignment therefore stays
  // ALIGN_LEFT for the entire receipt — layering the printer's own
  // hardware ESC/POS centering (ESC a 1) on top of already-padded text
  // would re-center a string that's already centered, shifting it off
  // the true middle. This is also what keeps the raw bytes sent to the
  // printer pixel-for-pixel consistent with the character grid rendered
  // in ThermalReceipt.tsx's browser preview.
  let out = CMD.INIT + CMD.ALIGN_LEFT;

  // ---- Header -------------------------------------------------------------
  out += CMD.BOLD_ON + CMD.DOUBLE_ON;
  out += centerLine(restaurant?.name || "Restaurant", Math.floor(cols / 2)) + "\n";
  out += CMD.DOUBLE_OFF + CMD.BOLD_OFF;
  if (restaurant?.address) {
    wrapCenteredAddress(restaurant.address, cols).forEach((line) => {
      out += line + "\n";
    });
  }
  if (restaurant?.phone) out += contactLine("Ph", restaurant.phone, cols) + "\n";
  if (restaurant?.email) out += contactLine("Email", restaurant.email, cols) + "\n";
  if (restaurant?.fssaiNumber) out += contactLine("FSSAI", restaurant.fssaiNumber, cols) + "\n";
  if (restaurant?.gstNumber) out += contactLine("GSTIN", restaurant.gstNumber, cols) + "\n";
  out += divider(cols) + "\n";

  // ---- Order details --------------------------------------------------------
  out += CMD.BOLD_ON + sectionHeading("DINE-IN", cols) + CMD.BOLD_OFF + "\n";
  out += fieldRow("Table", tableNumberOnly(table.label), HEADER_LABEL_WIDTH) + "\n";
  if (session.tokenNumber != null && session.tokenNumber !== "") {
    out += fieldRow("Token", String(session.tokenNumber), HEADER_LABEL_WIDTH) + "\n";
  }
  out += fieldRow("Order ID", session.invoiceNumber || "Pending", HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Date", new Date(receipt.generatedAt).toLocaleDateString("en-IN"), HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Time", new Date(receipt.generatedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), HEADER_LABEL_WIDTH) + "\n";
  if (cashierName) out += fieldRow("Cashier", cashierName, HEADER_LABEL_WIDTH) + "\n";
  if (session.customerName) out += fieldRow("Customer", session.customerName, HEADER_LABEL_WIDTH) + "\n";
  if (session.phoneNumber) out += fieldRow("Phone", session.phoneNumber, HEADER_LABEL_WIDTH) + "\n";
  out += divider(cols) + "\n";

  // ---- Items table ------------------------------------------------------------
  out += CMD.BOLD_ON + itemTableHeader(cols) + "\n" + CMD.BOLD_OFF;
  out += divider(cols) + "\n";
  orders.forEach((o) => {
    o.items.forEach((it) => {
      itemRows(it.quantity, it.name, money(it.price * it.quantity), cols).forEach((line) => {
        out += line + "\n";
      });
    });
  });
  out += divider(cols) + "\n";

  // ---- Bill summary ------------------------------------------------------------
  out += padRow("Subtotal", money(subtotal), cols) + "\n";
  // GST Management Module: hidden entirely when GST is switched off.
  if (gstEnabled) {
    out += padRow("Taxable Amt", money(taxableAmount), cols) + "\n";
    out += padRow(`CGST (${getGstRateLabel(cgst, taxableAmount) || "0%"})`, money(cgst), cols) + "\n";
    out += padRow(`SGST (${getGstRateLabel(sgst, taxableAmount) || "0%"})`, money(sgst), cols) + "\n";
    if (igst) out += padRow(`IGST (${getGstRateLabel(igst, taxableAmount)})`, money(igst), cols) + "\n";
    out += padRow("Total GST", money(receipt.gst), cols) + "\n";
  }
  if (receipt.discount) out += padRow("Discount", `-${money(receipt.discount)}`, cols) + "\n";
  if (receipt.roundOff) out += padRow("Round Off", money(receipt.roundOff), cols) + "\n";

  // ---- Total ---------------------------------------------------------------------
  out += doubleDivider(cols) + "\n";
  out += CMD.BOLD_ON + CMD.DOUBLE_ON;
  out += padRow("TOTAL", money(grandTotal), Math.floor(cols / 2)) + "\n";
  out += CMD.DOUBLE_OFF + CMD.BOLD_OFF;
  out += doubleDivider(cols) + "\n";

  // ---- Payment details --------------------------------------------------------------
  out += fieldRow("Payment", capitalize(session.paymentMethod || "-"), HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Status", session.paymentStatus === "paid" ? "Paid" : "Pending", HEADER_LABEL_WIDTH) + "\n";
  out += divider(cols) + "\n";

  // ---- Footer -----------------------------------------------------------------------
  // Note: the coffee-cup emoji from the design spec is intentionally left out of the
  // raw ESC/POS byte stream — this printer expects single-byte text (CP437/1252) and
  // a multi-byte UTF-8 emoji would print as garbage bytes. The on-screen preview in
  // ThermalReceipt.tsx keeps the emoji since that's rendered by the browser, not the
  // printer's own font table.
  out += CMD.BOLD_ON + centerLine("THANK YOU!", cols) + CMD.BOLD_OFF + "\n";
  out += centerLine("Visit Again", cols) + "\n";
  out += centerLine("Powered by Denova", cols) + "\n";
  out += centerLine("Smart Restaurant Platform", cols) + "\n";
  out += centerLine("This is a computer-generated bill.", cols) + "\n";

  out += CMD.FEED(3) + CMD.CUT;
  return out;
}

/** Minimal restaurant header info, reused for both session bills and single-order receipts. */
export interface ReceiptRestaurantInfo {
  name: string;
  address?: string;
  phone?: string;
  gstNumber?: string;
}

/** A single order as shown on the Orders page — no table session involved (e.g. takeaway). */
export interface SingleOrderForPrint {
  orderId: string;
  tableLabel?: string | null;
  orderType: "dine-in" | "takeaway";
  customerName?: string;
  customerPhone?: string;
  placedAt: string;
  // Item-Level Order Management: a cancelled item is excluded below since
  // subtotal/taxAmount/totalAmount are now recomputed to exclude it too —
  // printing it as a full-price line would no longer match the totals.
  items?: { item: { name: string; price: number }; quantity: number; status?: string }[];
  subtotal?: number;
  taxAmount?: number;
  totalAmount: number;
}

/** Builds an ESC/POS receipt for one standalone order (Orders page "Print Bill"). */
export function buildEscPosOrderReceipt(
  order: SingleOrderForPrint,
  restaurant: ReceiptRestaurantInfo | null,
  width: 58 | 80 = 80
): string {
  const cols = columnsFor(width);

  let out = CMD.INIT + CMD.ALIGN_CENTER;
  out += CMD.BOLD_ON + CMD.DOUBLE_ON;
  out += centerLine(restaurant?.name || "Restaurant", Math.floor(cols / 2)) + "\n";
  out += CMD.DOUBLE_OFF + CMD.BOLD_OFF;
  if (restaurant?.address) out += centerLine(restaurant.address, cols) + "\n";
  if (restaurant?.phone) out += centerLine(`Ph: ${restaurant.phone}`, cols) + "\n";
  if (restaurant?.gstNumber) out += centerLine(`GSTIN: ${restaurant.gstNumber}`, cols) + "\n";

  out += CMD.ALIGN_LEFT;
  out += divider(cols) + "\n";
  out += fieldRow("Order No", order.orderId, HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Date", new Date(order.placedAt).toLocaleDateString("en-IN"), HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Time", new Date(order.placedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }), HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Type", order.orderType === "dine-in" ? "Dine-in" : "Takeaway", HEADER_LABEL_WIDTH) + "\n";
  if (order.tableLabel) out += fieldRow("Table", tableNumberOnly(order.tableLabel), HEADER_LABEL_WIDTH) + "\n";
  if (order.customerName) out += fieldRow("Customer", order.customerName, HEADER_LABEL_WIDTH) + "\n";
  if (order.customerPhone) out += fieldRow("Phone", order.customerPhone, HEADER_LABEL_WIDTH) + "\n";
  out += divider(cols) + "\n";

  out += CMD.BOLD_ON + itemTableHeader(cols) + "\n" + CMD.BOLD_OFF;
  out += divider(cols) + "\n";
  (order.items ?? [])
    .filter((line) => line.status !== "cancelled")
    .forEach((line) => {
      itemRows(line.quantity, line.item.name, money(line.item.price * line.quantity), cols).forEach((row) => {
        out += row + "\n";
      });
    });
  out += divider(cols) + "\n";

  if (order.subtotal != null) out += padRow("Subtotal", money(order.subtotal), cols) + "\n";
  if (order.taxAmount != null) out += padRow("Tax", money(order.taxAmount), cols) + "\n";
  out += divider(cols) + "\n";
  out += CMD.BOLD_ON + CMD.DOUBLE_ON;
  out += padRow("TOTAL", money(order.totalAmount), Math.floor(cols / 2)) + "\n";
  out += CMD.DOUBLE_OFF + CMD.BOLD_OFF;
  out += divider(cols) + "\n";

  out += CMD.ALIGN_CENTER;
  out += "\n" + CMD.BOLD_ON + centerLine("Thank You!", cols) + CMD.BOLD_OFF + "\n";
  out += centerLine("Visit Again", cols) + "\n";

  out += CMD.FEED(3) + CMD.CUT;
  return out;
}

export function buildEscPosTestSlip(printerLabel: string, width: 58 | 80 = 80): string {
  const cols = columnsFor(width);
  let out = CMD.INIT + CMD.ALIGN_CENTER;
  out += CMD.BOLD_ON + CMD.DOUBLE_ON + centerLine("TEST PRINT", Math.floor(cols / 2)) + "\n" + CMD.DOUBLE_OFF + CMD.BOLD_OFF;
  out += divider(cols) + "\n";
  out += CMD.ALIGN_LEFT;
  out += fieldRow("Printer", printerLabel, HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Width", `${width}mm`, HEADER_LABEL_WIDTH) + "\n";
  out += fieldRow("Printed", new Date().toLocaleString("en-IN"), HEADER_LABEL_WIDTH) + "\n";
  out += divider(cols) + "\n";
  out += CMD.ALIGN_CENTER;
  out += "If you can read this clearly,\n";
  out += "your Denova printer setup is working.\n";
  out += CMD.FEED(3) + CMD.CUT;
  return out;
}