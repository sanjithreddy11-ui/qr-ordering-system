const Table = require("../models/Table");
const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const Settlement = require("../models/Settlement");
const ApiError = require("../utils/ApiError");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");
const generateBillNumber = require("../utils/generateBillNumber");
const generateSettlementId = require("../utils/generateSettlementId");
const gstService = require("./gstService");
const {
  emitTableAwaitingPayment,
  emitSettlementCreated,
  emitSessionPaymentUpdated,
} = require("../sockets/socket");

// Shared by both the Tables billing popup's "Submit Bill" action
// (controllers/sessionPaymentController.js:submitBill) and
// POST /api/admin/settlements (controllers/settlementController.js:createSettlement).
//
// This is the "Billing" half of the new Settlements Module workflow: it
// locks the bill, generates the Bill Number if one doesn't already exist
// (e.g. from a prior Print Bill), and files a Settlement record as
// "Pending Settlement". It never closes the dining session or frees the
// table — that only happens once the cashier completes the settlement
// (see settlementController.js:collectSettlement), matching the required
// workflow: Submit Bill -> Settlements -> Cashier collects -> Settlement
// Completed -> Session Closed.
async function submitBillForTable(tableId, staff) {
  const table = await Table.findById(tableId);
  if (!table) throw new ApiError(404, "Table not found");

  const session = table.currentSessionId
    ? await TableSession.findOne({ sessionId: table.currentSessionId, status: "active" })
    : null;
  if (!session) throw new ApiError(400, "This table has no active dining session");

  if (session.paymentStatus === "paid") {
    throw new ApiError(400, "This session has already been paid");
  }
  if (session.billSubmitted) {
    throw new ApiError(400, "This bill has already been submitted and is awaiting payment in Settlements");
  }

  const orders = await Order.find({ orderId: { $in: session.orderIds } }).sort({ placedAt: 1 });
  const activeOrders = orders.filter((o) => o.status !== "cancelled");
  if (activeOrders.length === 0) {
    throw new ApiError(400, "There are no orders to bill for this session yet");
  }

  // Calculate final taxes if not already done — reuses the exact
  // subtotal/taxAmount/totalAmount already computed per order (same
  // source of truth as buildReceipt() in sessionPaymentController.js), so
  // this can never drift from what Print Bill shows.
  if (!session.invoiceNumber) session.invoiceNumber = generateInvoiceNumber();
  if (!session.billNumber) session.billNumber = await generateBillNumber(session.restaurantId);

  const subtotal = activeOrders.reduce((sum, o) => sum + o.subtotal, 0);

  // Offers & Discounts Module: if the admin applied an offer to this
  // session's bill, freeze that discount onto the Settlement now — tax and
  // grandTotal are recomputed on the discounted taxable amount, same
  // formula buildReceipt() uses, so the Settlements page and every
  // Settlement-based revenue report (settlementController.js) automatically
  // reflect it. With no offer applied this is identical to the original
  // sum-of-orders total. GST Management Module: taxableAmount/cgst/sgst/
  // igst are populated either way so GST Dashboard/Reports can read them
  // straight off Settlement.
  let discount = 0;
  let tax;
  let grandTotal;
  let taxableAmount;
  let cgstAmount;
  let sgstAmount;
  let igstAmount;
  if (session.appliedOffer) {
    const gstSettings = await gstService.getSettings(session.restaurantId);
    const applied = gstService.recomputeWithDiscount(activeOrders, session.appliedOffer.discountAmount, gstSettings);
    discount = applied.discount;
    tax = applied.tax;
    grandTotal = applied.grandTotal;
    taxableAmount = applied.taxableAmount;
    cgstAmount = applied.cgstAmount;
    sgstAmount = applied.sgstAmount;
    igstAmount = applied.igstAmount;
  } else {
    tax = activeOrders.reduce((sum, o) => sum + o.taxAmount, 0);
    grandTotal = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    taxableAmount = activeOrders.reduce((sum, o) => sum + (o.taxableAmount ?? o.subtotal), 0);
    cgstAmount = activeOrders.reduce((sum, o) => sum + (o.cgstAmount || 0), 0);
    sgstAmount = activeOrders.reduce((sum, o) => sum + (o.sgstAmount || 0), 0);
    igstAmount = activeOrders.reduce((sum, o) => sum + (o.igstAmount || 0), 0);
  }

  const settlement = await Settlement.create({
    settlementId: await generateSettlementId(session.restaurantId),
    billNumber: session.billNumber,
    restaurantId: session.restaurantId,
    orderIds: session.orderIds,
    sessionId: session.sessionId,
    tableId: table._id,
    tableLabel: table.label,
    customerName: session.customerName || "Walk-in",
    phoneNumber: session.phoneNumber || "",
    subtotal,
    tax,
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    discount,
    offerName: session.appliedOffer?.name || null,
    offerId: session.appliedOffer?.offerId || null,
    grandTotal,
    paymentStatus: "pending",
    // Payment Collection Tracking: nothing has been collected yet, so the
    // full bill is outstanding — kept in sync with grandTotal as orders
    // change (see services/orderService.js) until Collect Payment runs.
    totalReceived: 0,
    remainingAmount: grandTotal,
    collectionStatus: "UNPAID",
    submittedAt: new Date(),
    submittedBy: staff?.name || staff?.email || null,
  });

  session.billSubmitted = true;
  await session.save();

  // Billing -> Awaiting Payment. Never "available" here — the table isn't
  // free until the cashier actually collects the payment.
  table.status = "awaiting_payment";
  await table.save();

  emitTableAwaitingPayment(table);
  emitSettlementCreated(settlement);
  emitSessionPaymentUpdated(session);

  return { table, session, settlement };
}

module.exports = { submitBillForTable };
