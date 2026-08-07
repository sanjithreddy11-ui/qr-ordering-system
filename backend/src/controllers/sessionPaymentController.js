const Table = require("../models/Table");
const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const Offer = require("../models/Offer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");
const generateBillNumber = require("../utils/generateBillNumber");
const { splitGst, computeOfferDiscount } = require("../utils/billingCalculator");
const gstService = require("../services/gstService");
const { emitTableAvailable, emitSessionEnded, emitSessionPaymentUpdated } = require("../sockets/socket");
const { submitBillForTable } = require("../services/settlementService");

async function getActiveSessionForTable(tableId) {
  const table = await Table.findById(tableId);
  if (!table) throw new ApiError(404, "Table not found");

  const session = table.currentSessionId
    ? await TableSession.findOne({ sessionId: table.currentSessionId, status: "active" })
    : null;
  if (!session) throw new ApiError(400, "This table has no active dining session");

  return { table, session };
}

// Shared shape for both the on-screen "Running Bill" panel and the printed
// bill/receipt. Reuses the exact subtotal/taxAmount/totalAmount already
// computed per-order (services/orderService.js) rather than recomputing GST
// here, so the printed numbers can never drift from what each order charged.
async function buildReceipt(table, session, staff) {
  const orders = await Order.find({ orderId: { $in: session.orderIds } }).sort({ placedAt: 1 });
  const restaurant = await Restaurant.findOne({ restaurantId: session.restaurantId }).lean();
  const gstSettings = await gstService.getSettings(session.restaurantId);

  const subtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);

  // Offers & Discounts Module: when the admin has applied an offer to this
  // session (see applyOffer below), the discount is taken off the taxable
  // amount and tax/grand total are recomputed accordingly (GST Management
  // Module: gstService.recomputeWithDiscount handles Disabled/Inclusive/
  // Exclusive and any blend of per-item GST slabs). This only ever changes
  // what THIS bill/receipt shows — it never rewrites the underlying Order
  // documents, so KOTs, per-order tax, and menu prices are completely
  // unaffected. With no offer applied, this is byte-for-byte the same
  // sum-of-orders calculation as before.
  let discount = 0;
  let gst;
  let cgst;
  let sgst;
  let igst;
  let taxableAmount;
  let grandTotal;
  if (session.appliedOffer) {
    const applied = gstService.recomputeWithDiscount(orders, session.appliedOffer.discountAmount, gstSettings);
    discount = applied.discount;
    gst = applied.tax;
    cgst = applied.cgstAmount;
    sgst = applied.sgstAmount;
    igst = applied.igstAmount;
    taxableAmount = applied.taxableAmount;
    grandTotal = applied.grandTotal;
  } else {
    gst = orders.reduce((sum, o) => sum + o.taxAmount, 0);
    grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);
    taxableAmount = orders.reduce((sum, o) => sum + (o.taxableAmount ?? o.subtotal), 0);
    cgst = orders.reduce((sum, o) => sum + (o.cgstAmount || 0), 0);
    sgst = orders.reduce((sum, o) => sum + (o.sgstAmount || 0), 0);
    igst = orders.reduce((sum, o) => sum + (o.igstAmount || 0), 0);
    // Fallback for any order placed before the GST Management Module
    // existed (cgst/sgst never populated on it): split the legacy flat
    // taxAmount evenly, same as before.
    if (cgst === 0 && sgst === 0 && gst > 0) {
      ({ cgst, sgst } = splitGst(gst));
    }
  }

  // Informational only — shown on the billing screen so staff can see how
  // an order is progressing. This never gates printing/billing: the bill
  // can be printed at any time regardless of order status, since billing
  // has no dependency on the (removed) Kitchen Dashboard or a "Served"
  // status. Mirrors the Orders status set (pending -> preparing -> ready
  // -> completed | cancelled).
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  const orderStatus =
    activeOrders.length === 0 ? null : activeOrders.every((o) => o.status === "completed") ? "completed" : "in_progress";

  return {
    restaurant: restaurant
      ? {
          // GST Management Module: GST Settings' businessName/businessAddress
          // take precedence over the base Restaurant profile once the admin
          // has configured them (GST Settings -> Business Name/Address),
          // since the invoice header is meant to reflect the GST-registered
          // entity, which can differ from the restaurant's display name.
          name: gstSettings.businessName || restaurant.name,
          address: gstSettings.businessAddress || restaurant.address,
          phone: restaurant.phone,
          logo: restaurant.logo,
          gstNumber: gstSettings.gstin || restaurant.gstNumber || "",
        }
      : null,
    table: { label: table.label },
    session: {
      sessionId: session.sessionId,
      invoiceNumber: session.invoiceNumber,
      billNumber: session.billNumber,
      orderStatus,
      sessionStart: session.sessionStart,
      customerName: session.customerName,
      phoneNumber: session.phoneNumber,
      paymentMethod: session.paymentMethod,
      paymentStatus: session.paymentStatus,
      transactionId: session.transactionId,
      paidAt: session.paidAt,
      billPrinted: session.billPrinted,
      printedAt: session.printedAt,
      printedBy: session.printedBy,
      printCount: session.printCount || 0,
      appliedOffer: session.appliedOffer || null,
    },
    cashierName: staff?.name || "",
    orders: orders.map((o) => ({
      orderId: o.orderId,
      placedAt: o.placedAt,
      status: o.status,
      // Menu Item Customization (Modifiers): carried through onto the
      // printed/on-screen bill so a customized line (e.g. "Chicken Penne
      // Pasta — Red Sauce") never shows as indistinguishable from a plain
      // one — see lib/printer/escpos.ts and ThermalReceipt.tsx.
      items: o.items.map((i) => ({
        name: i.item.name,
        price: i.item.price,
        quantity: i.quantity,
        modifiers: i.modifiers || [],
      })),
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
    })),
    subtotal,
    gst,
    cgst,
    sgst,
    igst,
    taxableAmount,
    // Surfaced so the receipt/print layer can hide GST lines entirely
    // when the admin has switched GST off in GST Settings, instead of
    // just showing a row of zeroes.
    gstEnabled: gstSettings.enabled,
    discount,
    grandTotal,
    generatedAt: new Date(),
  };
}

// Shared guard for both applyOffer and removeOffer — an offer can only be
// changed while the bill is still being put together, matching every other
// billing mutation in this file (setPaymentMethod, printBill).
function assertBillIsEditable(session) {
  if (session.paymentStatus === "paid") {
    throw new ApiError(400, "This session has already been paid");
  }
  if (session.billSubmitted) {
    throw new ApiError(400, "This bill has already been submitted and is awaiting payment in Settlements");
  }
}

// PATCH /api/admin/tables/:tableId/session/apply-offer
// Body: { offerId }
// Offers & Discounts Module: applies exactly one offer to this session's
// bill (manual only — never automatic). Re-applying replaces whatever
// offer was applied before, so a bill can never carry more than one at a
// time. The discount amount is computed and frozen onto the session right
// now, from the current active-order subtotal, so it stays correct even if
// more items are added/removed afterwards without needing to be reapplied
// (though the admin can always remove/reapply for the latest subtotal).
const applyOffer = asyncHandler(async (req, res) => {
  const { offerId } = req.body;
  if (!offerId) throw new ApiError(400, "offerId is required");

  const { table, session } = await getActiveSessionForTable(req.params.tableId);
  assertBillIsEditable(session);

  const offer = await Offer.findOne({ _id: offerId, restaurantId: session.restaurantId });
  if (!offer) throw new ApiError(404, "Offer not found");
  if (!offer.isActive) throw new ApiError(400, "This offer is not active");

  const orders = await Order.find({ orderId: { $in: session.orderIds } });
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  if (activeOrders.length === 0) {
    throw new ApiError(400, "There are no orders to bill for this session yet");
  }
  const subtotal = activeOrders.reduce((sum, o) => sum + o.subtotal, 0);

  if (offer.minOrderAmount && subtotal < offer.minOrderAmount) {
    throw new ApiError(400, `This offer needs a minimum order of ₹${offer.minOrderAmount} (current subtotal is ₹${subtotal})`);
  }

  session.appliedOffer = {
    offerId: offer._id,
    name: offer.name,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    discountAmount: computeOfferDiscount(offer, subtotal),
  };
  await session.save();

  const receipt = await buildReceipt(table, session, req.staff);
  emitSessionPaymentUpdated(session);
  res.json({ session, receipt });
});

// PATCH /api/admin/tables/:tableId/session/remove-offer
// Offers & Discounts Module: clears whatever offer is applied and restores
// the original (undiscounted) bill.
const removeOffer = asyncHandler(async (req, res) => {
  const { table, session } = await getActiveSessionForTable(req.params.tableId);
  assertBillIsEditable(session);

  session.appliedOffer = null;
  await session.save();

  const receipt = await buildReceipt(table, session, req.staff);
  emitSessionPaymentUpdated(session);
  res.json({ session, receipt });
});

// PATCH /api/admin/tables/:tableId/session/payment-method
// Body: { paymentMethod: "upi" | "cash" | "card" }
const setPaymentMethod = asyncHandler(async (req, res) => {
  const { paymentMethod } = req.body;
  if (!["upi", "cash", "card"].includes(paymentMethod)) {
    throw new ApiError(400, "paymentMethod must be one of upi, cash, card");
  }

  const { session } = await getActiveSessionForTable(req.params.tableId);
  if (session.paymentStatus === "paid") {
    throw new ApiError(400, "This session has already been paid");
  }

  // Switching methods resets the cash print gate and any entered
  // transaction id, so changing your mind mid-flow can't be used to skip
  // the "print bill before collecting cash" requirement.
  session.paymentMethod = paymentMethod;
  session.billPrinted = false;
  session.transactionId = null;
  await session.save();

  emitSessionPaymentUpdated(session);
  res.json({ session });
});

// PATCH /api/admin/tables/:tableId/session/print-bill
// Used by both the Current Dining Session page (cash flow) and the
// Billing popup (Dashboard -> Tables -> Billing). Available for any
// payment method, at any order status — the bill/receipt values don't
// depend on how the customer ends up paying, and printing has no
// dependency on the Kitchen Dashboard or a "Served" order status (KDS has
// been removed from the project). The only preconditions are: the
// session is active, has at least one non-cancelled order, and hasn't
// already been paid. This route only generates the bill, prints the
// receipt, and marks the pre-payment bill as printed (unlocking Collect
// Payment for cash) plus print history so the popup can flip to "Reprint
// Bill". It never closes the session, frees the table, marks the invoice
// paid, or updates revenue — that only happens once the waiter completes
// Settlement via collectPayment() below. Unlimited reprints are allowed:
// this route is called again for every reprint and simply increments the
// count.
const printBill = asyncHandler(async (req, res) => {
  const { table, session } = await getActiveSessionForTable(req.params.tableId);

  if (session.paymentStatus === "paid") {
    throw new ApiError(400, "This session has already been paid");
  }

  const orders = await Order.find({ orderId: { $in: session.orderIds } });
  const hasActiveOrder = orders.some((o) => o.status !== "cancelled");
  if (!hasActiveOrder) {
    throw new ApiError(400, "There are no orders to bill for this session yet");
  }

  if (!session.invoiceNumber) session.invoiceNumber = generateInvoiceNumber();
  if (!session.billNumber) session.billNumber = await generateBillNumber(session.restaurantId);
  session.billPrinted = true;
  session.printedAt = new Date();
  session.printedBy = req.staff?.name || req.staff?.email || null;
  session.printCount = (session.printCount || 0) + 1;
  await session.save();

  const receipt = await buildReceipt(table, session, req.staff);
  emitSessionPaymentUpdated(session);
  res.json({ session, receipt });
});

// GET /api/admin/tables/:tableId/session/receipt
// Read-only — used to render/re-print the bill (cash, pre-payment) or the
// final receipt (upi/card, or cash post-payment).
const getReceipt = asyncHandler(async (req, res) => {
  const { table, session } = await getActiveSessionForTable(req.params.tableId);
  const receipt = await buildReceipt(table, session, req.staff);
  res.json({ receipt });
});

// PATCH /api/admin/tables/:tableId/session/collect-payment
// Body: { transactionId? } — required for UPI, optional (terminal ref) for
// Card, ignored for Cash. Finalizes payment, closes the dining session, and
// frees the table immediately (Available) — no separate cleaning step here,
// per the requested cash/UPI/card workflow.
const collectPayment = asyncHandler(async (req, res) => {
  const { table, session } = await getActiveSessionForTable(req.params.tableId);

  if (!session.paymentMethod) {
    throw new ApiError(400, "Choose a payment method before collecting payment");
  }
  if (session.paymentMethod === "cash" && !session.billPrinted) {
    throw new ApiError(400, "Print the bill before collecting cash payment");
  }
  if (session.paymentMethod === "upi" && !req.body?.transactionId) {
    throw new ApiError(400, "Transaction ID is required for UPI payments");
  }

  session.paymentStatus = "paid";
  session.paidAt = new Date();
  session.transactionId =
    session.paymentMethod === "cash" ? null : req.body?.transactionId?.trim() || session.transactionId || null;
  if (!session.invoiceNumber) session.invoiceNumber = generateInvoiceNumber();
  if (!session.billNumber) session.billNumber = await generateBillNumber(session.restaurantId);
  session.status = "closed";
  session.sessionEnd = new Date();
  await session.save();

  table.status = "available";
  table.currentSessionId = null;
  table.currentReservationId = null;
  table.occupiedAt = null;
  await table.save();

  emitSessionEnded(session);
  emitTableAvailable(table);

  const receipt = await buildReceipt(table, session, req.staff);
  res.json({ session, table, receipt });
});

// PATCH /api/admin/tables/:tableId/session/submit-bill
// Settlements Module: replaces "Close Session" in the Tables billing popup
// (Dashboard -> Tables -> Billing). Locks the bill, generates the Bill
// Number, and files it as a Pending Settlement — but deliberately does NOT
// close the dining session or free the table. That now only happens once
// the cashier completes the settlement from the Settlements page (see
// settlementController.js:collectSettlement). See
// services/settlementService.js for the shared implementation (also used
// by POST /api/admin/settlements).
const submitBill = asyncHandler(async (req, res) => {
  const { table, session, settlement } = await submitBillForTable(req.params.tableId, req.staff);
  res.json({ table, session, settlement });
});

module.exports = { setPaymentMethod, printBill, getReceipt, collectPayment, submitBill, applyOffer, removeOffer };
