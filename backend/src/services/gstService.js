const GstSettings = require("../models/GstSettings");
const Restaurant = require("../models/Restaurant");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");

const DEFAULT_SLABS = [5, 12, 18, 28];

function round2(n) {
  return Math.round(n * 100) / 100;
}

// Splits a total GST amount into CGST/SGST halves — rounded to the
// nearest paisa, with SGST absorbing any 1-paisa remainder so
// cgst + sgst always exactly equals the input, same convention already
// used by utils/billingCalculator.js's splitGst (kept as one function
// here so every GST surface — orders, settlements, receipts, reports —
// agrees on the same split).
function splitCgstSgst(gstTotal) {
  const cgst = round2(gstTotal / 2);
  const sgst = round2(gstTotal - cgst);
  return { cgst, sgst };
}

// Returns this restaurant's GST configuration, creating a sensible
// default document the first time it's read so every other GST surface
// (Menu Management, Billing, Dashboard, Reports) always has one to work
// with — no null-checks scattered across the codebase. Falls back to the
// Restaurant profile's name/address/gstNumber for the business fields
// until the admin explicitly fills in GST Settings, so a fresh
// installation doesn't show a blank invoice header.
async function getSettings(restaurantId) {
  let settings = await GstSettings.findOne({ restaurantId });
  if (!settings) {
    const restaurant = await Restaurant.findOne({ restaurantId }).lean();
    settings = await GstSettings.create({
      restaurantId,
      businessName: restaurant?.name || "",
      businessAddress: restaurant?.address || "",
      gstin: restaurant?.gstNumber || "",
      calculationMode: "exclusive",
      defaultGstPercentage: 5,
      enabled: true,
      slabs: DEFAULT_SLABS,
    });
  }
  return settings;
}

// PUT /api/admin/gst/settings/:restaurantId — validates and persists a
// partial update. Kept as its own function (rather than inline in the
// controller) so both the controller and any future internal caller share
// the exact same validation.
async function upsertSettings(restaurantId, updates) {
  const settings = await getSettings(restaurantId);

  const allowedFields = [
    "businessName",
    "gstin",
    "businessAddress",
    "calculationMode",
    "defaultGstPercentage",
    "enabled",
    "slabs",
    "igstEnabled",
    "stateCode",
    "cessEnabled",
    "defaultCessPercentage",
  ];
  for (const field of allowedFields) {
    if (field in updates) settings[field] = updates[field];
  }

  if (!GstSettings.CALCULATION_MODES.includes(settings.calculationMode)) {
    throw new ApiError(400, "GST Calculation Mode must be 'inclusive' or 'exclusive'");
  }
  if (
    !Array.isArray(settings.slabs) ||
    settings.slabs.some((s) => typeof s !== "number" || s < 0 || s > 100)
  ) {
    throw new ApiError(400, "GST slabs must be an array of percentages between 0 and 100");
  }
  // De-dupe and sort so the Slabs UI and menu-item dropdown always show a
  // clean, stable list regardless of what order they were submitted in.
  settings.slabs = [...new Set(settings.slabs)].sort((a, b) => a - b);

  if (!settings.slabs.includes(settings.defaultGstPercentage)) {
    throw new ApiError(400, "Default GST % must be one of the configured GST slabs");
  }

  await settings.save();
  return settings;
}

// Validates a menu item's requested GST slab against the restaurant's
// configured slabs. Returns null for "use the default rate" (the normal
// case), or the validated percentage. Shared by adminMenuController's
// create/update so a typo'd or stale slab can never be silently saved.
async function validateItemGstSlab(restaurantId, gstSlab) {
  if (gstSlab === null || gstSlab === undefined || gstSlab === "") return null;
  const settings = await getSettings(restaurantId);
  const value = Number(gstSlab);
  if (!settings.slabs.includes(value)) {
    throw new ApiError(
      400,
      `GST slab must be one of: ${settings.slabs.join("%, ")}% (or left blank to use the default ${settings.defaultGstPercentage}%)`
    );
  }
  return value;
}

// Computes the exact GST breakdown for ONE order line — { price, quantity,
// gstSlab } — under the given GST settings. Shared by computeOrderGst
// (which just sums this across every line) and by
// services/orderService.js, which snapshots this per-line result onto each
// Order.items[] entry (lineSubtotal/lineTaxableAmount/lineTaxAmount/
// lineTotal/gstSlabUsed) at order-creation time. That snapshot is what
// makes it possible to recompute an order's totals later after a single
// item is cancelled, without ever needing to re-look-up the menu item's
// GST slab or re-read today's GST Settings (which may have since changed).
//
//   - Disabled:  no tax. lineTotal === lineSubtotal.
//   - Exclusive: tax is added on top of the item's price.
//                lineTaxable === lineSubtotal.
//   - Inclusive: the item's price already includes tax; lineTaxable is
//                backed out (price / (1 + rate/100)) and lineTotal stays
//                equal to lineSubtotal (nothing is added on top again).
function computeLineGst(price, quantity, gstSlab, settings) {
  const lineSubtotal = round2(price * quantity);
  const enabled = settings.enabled;
  const mode = enabled ? settings.calculationMode : "disabled";

  if (!enabled) {
    return { lineSubtotal, lineTaxableAmount: 0, lineTaxAmount: 0, lineTotal: lineSubtotal, rate: 0, mode };
  }

  const rate = gstSlab != null ? gstSlab : settings.defaultGstPercentage;

  if (mode === "inclusive") {
    const lineTaxableAmount = round2(lineSubtotal / (1 + rate / 100));
    const lineTaxAmount = round2(lineSubtotal - lineTaxableAmount);
    return { lineSubtotal, lineTaxableAmount, lineTaxAmount, lineTotal: lineSubtotal, rate, mode };
  }

  const lineTaxableAmount = lineSubtotal;
  const lineTaxAmount = round2((lineSubtotal * rate) / 100);
  return {
    lineSubtotal,
    lineTaxableAmount,
    lineTaxAmount,
    lineTotal: round2(lineSubtotal + lineTaxAmount),
    rate,
    mode,
  };
}

// The core tax engine: given the line items about to be billed (each
// { price, quantity, gstSlab }) and this restaurant's GST settings,
// computes every figure Billing/Receipts/Reports need — subtotal (menu
// price total, unaffected by GST mode), taxableAmount, cgst/sgst/igst,
// taxAmount and totalAmount (what the customer actually pays).
//
// Each item can carry its own GST slab (Menu Management), so this sums
// per-item (via computeLineGst) rather than applying one flat rate to the
// order total — a bill mixing a 5% item and an 18% item is computed
// correctly either way.
function computeOrderGst(lineItems, settings) {
  let subtotal = 0;
  let taxableAmount = 0;
  let taxAmount = 0;

  const enabled = settings.enabled;
  const mode = enabled ? settings.calculationMode : "disabled";

  for (const line of lineItems) {
    const computed = computeLineGst(line.price, line.quantity, line.gstSlab, settings);
    subtotal += computed.lineSubtotal;
    taxableAmount += computed.lineTaxableAmount;
    taxAmount += computed.lineTaxAmount;
  }

  subtotal = round2(subtotal);
  taxableAmount = round2(taxableAmount);
  taxAmount = round2(taxAmount);

  const { cgst, sgst } = enabled ? splitCgstSgst(taxAmount) : { cgst: 0, sgst: 0 };
  // IGST is future-ready only (see GstSettings.igstEnabled) — every order
  // today is intra-state, so igstAmount is always 0 and the full amount
  // goes through CGST+SGST instead.
  const igst = 0;

  const totalAmount = mode === "inclusive" ? subtotal : round2(subtotal + taxAmount);
  const effectiveGstRate = taxableAmount > 0 ? round2((taxAmount / taxableAmount) * 100) : 0;

  return {
    subtotal,
    taxableAmount,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: igst,
    taxAmount,
    totalAmount,
    gstMode: mode,
    effectiveGstRate,
  };
}

// Item-Level Order Management: recomputes an order's aggregate
// subtotal/taxableAmount/cgst/sgst/igst/taxAmount/totalAmount/
// effectiveGstRate from whatever items are still NOT cancelled — using
// each line's own snapshotted lineSubtotal/lineTaxableAmount/lineTaxAmount
// (see computeLineGst above) rather than re-deriving GST from the menu or
// current GST Settings. This is what keeps totals/GST/settlement figures
// correct the moment a single item is completed or cancelled (see
// services/orderService.js:applyItemStatusChange).
//
// Falls back to treating a line as "Exclusive at the order's own
// effectiveGstRate" if it predates the lineSubtotal/lineTaxAmount fields
// (i.e. an order placed before this feature existed) — an approximation,
// but the best available without re-fetching historical GST settings.
function recomputeOrderAggregatesFromItems(order) {
  let subtotal = 0;
  let taxableAmount = 0;
  let taxAmount = 0;

  for (const line of order.items) {
    if (line.status === "cancelled") continue;

    const fallbackSubtotal = round2((line.item?.price || 0) * line.quantity);
    const lineSubtotal = line.lineSubtotal != null ? line.lineSubtotal : fallbackSubtotal;
    const lineTaxableAmount = line.lineTaxableAmount != null ? line.lineTaxableAmount : lineSubtotal;
    const lineTaxAmount =
      line.lineTaxAmount != null
        ? line.lineTaxAmount
        : round2((lineTaxableAmount * (order.effectiveGstRate || 0)) / 100);

    subtotal += lineSubtotal;
    taxableAmount += lineTaxableAmount;
    taxAmount += lineTaxAmount;
  }

  subtotal = round2(subtotal);
  taxableAmount = round2(taxableAmount);
  taxAmount = round2(taxAmount);

  const { cgst, sgst } = order.gstMode !== "disabled" ? splitCgstSgst(taxAmount) : { cgst: 0, sgst: 0 };
  const totalAmount = order.gstMode === "inclusive" ? subtotal : round2(subtotal + taxAmount);
  const effectiveGstRate = taxableAmount > 0 ? round2((taxAmount / taxableAmount) * 100) : 0;

  return {
    subtotal,
    taxableAmount,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: 0,
    taxAmount,
    totalAmount,
    effectiveGstRate,
  };
}

// Recomputes a bill's tax + grand total after a discount is taken off,
// generalizing utils/billingCalculator.js's applyDiscountToBill to work
// across GST Disabled / Inclusive / Exclusive and any blend of per-item
// slabs. Rather than needing each order's original line items again, it
// works off the already-computed aggregates (taxableAmount + taxAmount)
// from the orders being billed, deriving a blended effective rate — this
// is exact when every order used the same rate, and a fair approximation
// for a session mixing multiple GST slabs across rounds.
//
//   orders: array of { subtotal, taxableAmount, taxAmount }
//   discountAmount: rupee discount to apply (already capped by the caller
//     via computeOfferDiscount)
//   settings: this restaurant's GstSettings
function recomputeWithDiscount(orders, discountAmount, settings) {
  const subtotal = round2(orders.reduce((sum, o) => sum + o.subtotal, 0));
  const taxableAmount = round2(orders.reduce((sum, o) => sum + (o.taxableAmount ?? o.subtotal), 0));
  const originalTax = round2(orders.reduce((sum, o) => sum + o.taxAmount, 0));

  const discount = Math.max(0, Math.min(discountAmount, subtotal));

  if (!settings.enabled || originalTax === 0 || taxableAmount === 0) {
    const grandTotal = round2(Math.max(0, subtotal - discount));
    return {
      discount,
      taxableAmount: round2(Math.max(0, taxableAmount - discount)),
      cgstAmount: 0,
      sgstAmount: 0,
      igstAmount: 0,
      tax: 0,
      grandTotal,
    };
  }

  const effectiveRate = round2((originalTax / taxableAmount) * 100);

  if (settings.calculationMode === "inclusive") {
    const newSubtotal = round2(Math.max(0, subtotal - discount));
    const newTaxable = round2(newSubtotal / (1 + effectiveRate / 100));
    const tax = round2(newSubtotal - newTaxable);
    const { cgst, sgst } = splitCgstSgst(tax);
    return {
      discount,
      taxableAmount: newTaxable,
      cgstAmount: cgst,
      sgstAmount: sgst,
      igstAmount: 0,
      tax,
      grandTotal: newSubtotal,
    };
  }

  const newTaxable = round2(Math.max(0, taxableAmount - discount));
  const tax = round2((newTaxable * effectiveRate) / 100);
  const { cgst, sgst } = splitCgstSgst(tax);
  const grandTotal = round2(newTaxable + tax);
  return {
    discount,
    taxableAmount: newTaxable,
    cgstAmount: cgst,
    sgstAmount: sgst,
    igstAmount: 0,
    tax,
    grandTotal,
  };
}

// ---------------------------------------------------------------------
// GST Dashboard / Reports — both read straight off the Order collection
// (the same authoritative source Analytics/Revenue already use), scoped
// to non-cancelled orders, since this app's cash-only checkout creates
// the Order the moment it's placed rather than at a separate "paid" step.
// ---------------------------------------------------------------------

function buildDateMatch(restaurantId, from, to) {
  const match = { restaurantId, status: { $ne: "cancelled" } };
  if (from || to) {
    match.placedAt = {};
    if (from) match.placedAt.$gte = new Date(from);
    if (to) match.placedAt.$lte = new Date(to);
  }
  return match;
}

// GET /api/admin/gst/dashboard/:restaurantId — the 7 headline figures
// from the GST Management spec: Total Sales, Taxable Sales, GST
// Collected, CGST/SGST/IGST Collected, and GST Payable (currently just
// GST Collected — see the comment below on why).
async function getDashboard(restaurantId, { from, to } = {}) {
  const match = buildDateMatch(restaurantId, from, to);

  const [agg] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalSales: { $sum: "$totalAmount" },
        taxableSales: { $sum: { $ifNull: ["$taxableAmount", "$subtotal"] } },
        cgstCollected: { $sum: "$cgstAmount" },
        sgstCollected: { $sum: "$sgstAmount" },
        igstCollected: { $sum: "$igstAmount" },
        gstCollected: { $sum: "$taxAmount" },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  const totalSales = round2(agg?.totalSales || 0);
  const taxableSales = round2(agg?.taxableSales || 0);
  const cgstCollected = round2(agg?.cgstCollected || 0);
  const sgstCollected = round2(agg?.sgstCollected || 0);
  const igstCollected = round2(agg?.igstCollected || 0);
  const gstCollected = round2(agg?.gstCollected || 0);

  return {
    range: { from: from || null, to: to || null },
    totalSales,
    taxableSales,
    gstCollected,
    cgstCollected,
    sgstCollected,
    // Future-ready — always present at 0 until inter-state billing
    // (GstSettings.igstEnabled) is turned on.
    igstCollected,
    // GST Payable: output tax collected on sales, minus input tax credit
    // (ITC) on purchases. This project has no purchase/vendor-invoice GST
    // capture yet (see Stock/Supplier modules), so ITC is always 0 today
    // and Payable === Collected — surfaced as its own field (rather than
    // just reusing gstCollected) so the frontend and any future ITC
    // integration have a single stable place to read it from.
    inputTaxCredit: 0,
    gstPayable: gstCollected,
    orderCount: agg?.orderCount || 0,
  };
}

// GET /api/admin/gst/reports/:restaurantId?groupBy=day|month — the GST
// Reports tab: Daily/Monthly/Custom range, broken into a per-period
// table plus the same summary totals as the dashboard.
async function getReport(restaurantId, { from, to, groupBy = "day" } = {}) {
  const match = buildDateMatch(restaurantId, from, to);
  const dateFormat = groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";

  const rows = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: dateFormat, date: "$placedAt" } },
        totalSales: { $sum: "$totalAmount" },
        taxableSales: { $sum: { $ifNull: ["$taxableAmount", "$subtotal"] } },
        cgstCollected: { $sum: "$cgstAmount" },
        sgstCollected: { $sum: "$sgstAmount" },
        igstCollected: { $sum: "$igstAmount" },
        gstCollected: { $sum: "$taxAmount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const summary = rows.reduce(
    (acc, r) => {
      acc.totalSales += r.totalSales;
      acc.taxableSales += r.taxableSales;
      acc.cgstCollected += r.cgstCollected;
      acc.sgstCollected += r.sgstCollected;
      acc.igstCollected += r.igstCollected;
      acc.gstCollected += r.gstCollected;
      acc.orderCount += r.orderCount;
      return acc;
    },
    { totalSales: 0, taxableSales: 0, cgstCollected: 0, sgstCollected: 0, igstCollected: 0, gstCollected: 0, orderCount: 0 }
  );

  return {
    range: { from: from || null, to: to || null },
    groupBy,
    rows: rows.map((r) => ({
      period: r._id,
      totalSales: round2(r.totalSales),
      taxableSales: round2(r.taxableSales),
      cgstCollected: round2(r.cgstCollected),
      sgstCollected: round2(r.sgstCollected),
      igstCollected: round2(r.igstCollected),
      gstCollected: round2(r.gstCollected),
      orderCount: r.orderCount,
    })),
    summary: {
      totalSales: round2(summary.totalSales),
      taxableSales: round2(summary.taxableSales),
      cgstCollected: round2(summary.cgstCollected),
      sgstCollected: round2(summary.sgstCollected),
      igstCollected: round2(summary.igstCollected),
      gstCollected: round2(summary.gstCollected),
      orderCount: summary.orderCount,
    },
  };
}

module.exports = {
  DEFAULT_SLABS,
  getSettings,
  upsertSettings,
  validateItemGstSlab,
  computeLineGst,
  computeOrderGst,
  recomputeOrderAggregatesFromItems,
  recomputeWithDiscount,
  splitCgstSgst,
  getDashboard,
  getReport,
};
