// Single reusable billing-calculation utility for the Billing popup, the
// on-screen receipt preview (ThermalReceipt.tsx) and the ESC/POS generator
// (lib/printer/escpos.ts). GST itself is never recomputed here — the
// backend (services/gstService.js) is the only place tax is calculated,
// from each menu item's GST slab and GST Settings (GST Management
// Module), and ReceiptData.gst / .cgst / .sgst / .igst / .taxableAmount
// are already that authoritative total. This utility only derives safe
// display values (e.g. a CGST/SGST split for older cached payloads, or a
// rate label), so every surface that shows the bill goes through the same
// function and can never disagree with another.
import type { ReceiptData } from "@/lib/admin-api";

export interface GstBreakdown {
  subtotal: number;
  taxableAmount: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  gstEnabled: boolean;
  grandTotal: number;
}

type GstBreakdownInput = Pick<ReceiptData, "subtotal" | "gst" | "grandTotal"> &
  Partial<Pick<ReceiptData, "cgst" | "sgst" | "igst" | "taxableAmount" | "gstEnabled">>;

/**
 * Returns the subtotal/taxable-amount/CGST/SGST/IGST/grand-total
 * breakdown for a receipt. Prefers the backend-computed fields (present
 * on any receipt built after the GST Management Module shipped); falls
 * back to an even CGST/SGST split of `gst` and `subtotal` as the taxable
 * base for older cached receipt payloads, so nothing breaks mid-rollout.
 */
export function getGstBreakdown(receipt: GstBreakdownInput): GstBreakdown {
  const cgst = receipt.cgst ?? Math.round((receipt.gst / 2) * 100) / 100;
  const sgst = receipt.sgst ?? Math.round((receipt.gst - cgst) * 100) / 100;
  const igst = receipt.igst ?? 0;
  const taxableAmount = receipt.taxableAmount ?? receipt.subtotal;
  // Treat GST as "enabled" whenever the flag is missing (older payloads,
  // always taxed) or any tax was actually collected.
  const gstEnabled = receipt.gstEnabled ?? receipt.gst > 0;
  return {
    subtotal: receipt.subtotal,
    taxableAmount,
    cgst,
    sgst,
    igst,
    gst: receipt.gst,
    gstEnabled,
    grandTotal: receipt.grandTotal,
  };
}

/**
 * A display-only "2.5%"-style label for CGST/SGST, derived from the
 * actual amounts on this receipt rather than a hardcoded constant — GST
 * Management Module bills can span multiple slabs (5/12/18/28%), so the
 * effective rate differs bill to bill. Falls back to an empty string when
 * there's no taxable base to divide by (GST disabled / zero-value bill).
 */
export function getGstRateLabel(amount: number, taxableAmount: number): string {
  if (!taxableAmount) return "";
  const rate = (amount / taxableAmount) * 100;
  const rounded = Math.round(rate * 10) / 10;
  return `${rounded}%`;
}
