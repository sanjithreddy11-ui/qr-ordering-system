// Single source of truth for splitting a session's already-computed GST
// total (services/orderService.js -> TAX_RATE = 0.05, applied per order)
// into the CGST/SGST halves shown on the Billing popup and the printed
// receipt. Intentionally does NOT recompute tax from the subtotal — it
// only splits the authoritative `gst` total that buildReceipt() already
// sums from each order's `taxAmount`, so the popup and the printed bill
// can never disagree with each other or with what each order charged.
//
// Rounded to the nearest paisa, with SGST absorbing any 1-paisa remainder
// so cgst + sgst always exactly equals the input gst total.
function splitGst(gstTotal) {
  const cgst = Math.round((gstTotal / 2) * 100) / 100;
  const sgst = Math.round((gstTotal - cgst) * 100) / 100;
  return { cgst, sgst };
}

// Same rate services/orderService.js uses per-order (TAX_RATE = 0.05).
// Duplicated here (rather than imported) so this utils module has no
// dependency on orderService.js — it's small enough to keep in sync by
// inspection, and orderService's own TAX_RATE is left untouched.
const TAX_RATE = 0.05;

// Offers & Discounts: given a bill's raw subtotal and an offer, returns the
// rupee discount to apply — capped so it can never exceed the subtotal
// (a bill can never go negative from a discount).
function computeOfferDiscount(offer, subtotal) {
  if (!offer || subtotal <= 0) return 0;
  const raw =
    offer.discountType === "percentage"
      ? Math.round((subtotal * offer.discountValue) / 100)
      : offer.discountValue;
  return Math.max(0, Math.min(raw, subtotal));
}

// Offers & Discounts: recomputes a bill's tax + grand total after a
// discount is taken off the subtotal. Tax is charged on the discounted
// (taxable) amount, matching standard billing practice — this only ever
// affects the session's bill/receipt/settlement figures, never the
// underlying Order documents (menu prices, KOT, per-order tax stay
// exactly as originally placed).
function applyDiscountToBill(subtotal, discountAmount = 0) {
  const discount = Math.max(0, Math.min(discountAmount, subtotal));
  const taxableAmount = subtotal - discount;
  const tax = Math.round(taxableAmount * TAX_RATE);
  const { cgst, sgst } = splitGst(tax);
  const grandTotal = taxableAmount + tax;
  return { discount, tax, cgst, sgst, grandTotal };
}

module.exports = { splitGst, computeOfferDiscount, applyDiscountToBill };
