const Table = require("../models/Table");
const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const Restaurant = require("../models/Restaurant");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateInvoiceNumber = require("../utils/generateInvoiceNumber");
const { emitTableAvailable, emitSessionEnded, emitSessionPaymentUpdated } = require("../sockets/socket");

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

  const subtotal = orders.reduce((sum, o) => sum + o.subtotal, 0);
  const gst = orders.reduce((sum, o) => sum + o.taxAmount, 0);
  const grandTotal = orders.reduce((sum, o) => sum + o.totalAmount, 0);

  return {
    restaurant: restaurant
      ? {
          name: restaurant.name,
          address: restaurant.address,
          phone: restaurant.phone,
          logo: restaurant.logo,
          gstNumber: restaurant.gstNumber || "",
        }
      : null,
    table: { label: table.label },
    session: {
      sessionId: session.sessionId,
      invoiceNumber: session.invoiceNumber,
      sessionStart: session.sessionStart,
      customerName: session.customerName,
      phoneNumber: session.phoneNumber,
      paymentMethod: session.paymentMethod,
      paymentStatus: session.paymentStatus,
      transactionId: session.transactionId,
      paidAt: session.paidAt,
    },
    cashierName: staff?.name || "",
    orders: orders.map((o) => ({
      orderId: o.orderId,
      placedAt: o.placedAt,
      items: o.items.map((i) => ({ name: i.item.name, price: i.item.price, quantity: i.quantity })),
      subtotal: o.subtotal,
      taxAmount: o.taxAmount,
      totalAmount: o.totalAmount,
    })),
    subtotal,
    gst,
    grandTotal,
    generatedAt: new Date(),
  };
}

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
// Cash-only. Marks the pre-payment bill as printed (unlocking Collect
// Payment) and returns the receipt payload to send to the browser print
// dialog / thermal printer.
const printBill = asyncHandler(async (req, res) => {
  const { table, session } = await getActiveSessionForTable(req.params.tableId);

  if (session.paymentMethod !== "cash") {
    throw new ApiError(400, "Print Bill is only available when the payment method is Cash");
  }
  if (session.paymentStatus === "paid") {
    throw new ApiError(400, "This session has already been paid");
  }

  if (!session.invoiceNumber) session.invoiceNumber = generateInvoiceNumber();
  session.billPrinted = true;
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

module.exports = { setPaymentMethod, printBill, getReceipt, collectPayment };
