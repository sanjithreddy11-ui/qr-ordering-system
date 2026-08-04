const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { emitOrderStatusUpdate } = require("../sockets/socket");
const { validateAndBuildOrder, finalizeOrder, recalculateDownstreamForOrder } = require("../services/orderService");
const gstService = require("../services/gstService");

// POST /api/orders
// Body: { sessionId, restaurantId, tableToken, items: [{ id, quantity }],
//         orderType, specialInstructions, paymentMethod }
//
// req.verifiedPhone comes from middleware/verifyPhoneToken.js — the
// customer's phone number as confirmed by OTP verification (2Factor),
// never
// trusted from the request body alone (see validateAndBuildOrder).
//
// Cash-only "pay at counter" flow — the order is created and broadcast
// immediately.
const createOrder = asyncHandler(async (req, res) => {
  const orderData = await validateAndBuildOrder(req.body, req.verifiedPhone);
  const order = await finalizeOrder(orderData);
  res.status(201).json({ order });
});

// GET /api/orders/session/:sessionId
// Powers the Active Orders / Past Orders tabs. A session only ever sees
// its own orders — never other customers', even at the same table.
const listOrdersBySession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const orders = await Order.find({ sessionId }).sort({ placedAt: -1 }).limit(100).lean();

  const active = orders.filter((o) => ["pending", "preparing", "ready"].includes(o.status));
  const past = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  res.json({ active, past });
});

// GET /api/orders/:orderId
// Used by the order-success page to fetch (and later poll/re-fetch) status.
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId }).lean();
  if (!order) throw new ApiError(404, "Order not found");
  res.json({ order });
});

// GET /api/orders?restaurantId=cafe-001&status=pending,preparing&search=&from=&to=&limit=
// Used by the kitchen dashboard (restaurantId + status only) AND the admin
// Orders page (adds search across orderId/customerName/customerPhone/
// tableLabel, a placedAt date range, and a configurable limit). All the
// new params are optional so existing callers are unaffected.
const listOrders = asyncHandler(async (req, res) => {
  const { restaurantId, status, search, from, to, limit } = req.query;

  if (!restaurantId) {
    throw new ApiError(400, "restaurantId query param is required");
  }

  const filter = { restaurantId };
  if (status) {
    filter.status = { $in: String(status).split(",") };
  }
  if (search) {
    const regex = new RegExp(search.trim(), "i");
    filter.$or = [{ orderId: regex }, { customerName: regex }, { customerPhone: regex }, { tableLabel: regex }];
  }
  if (from || to) {
    filter.placedAt = {};
    if (from) filter.placedAt.$gte = new Date(from);
    if (to) filter.placedAt.$lte = new Date(to);
  }

  const cappedLimit = Math.min(500, Math.max(1, Number(limit) || 200));

  const orders = await Order.find(filter).sort({ placedAt: -1 }).limit(cappedLimit).lean();
  res.json({ orders });
});

// PATCH /api/orders/:orderId/status
// Body: { status: "preparing" | "ready" | "completed" | "cancelled" }
// Used by the kitchen dashboard buttons.
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status } = req.body;

  if (!Order.STATUSES.includes(status)) {
    throw new ApiError(400, `status must be one of: ${Order.STATUSES.join(", ")}`);
  }

  const order = await Order.findOne({ orderId: req.params.orderId });
  if (!order) throw new ApiError(404, "Order not found");

  // Item-Level Order Management: the Kitchen Dashboard still advances a
  // whole ticket at once, so this cascades onto every item that hasn't
  // already been individually finalized from the admin Orders page — an
  // item an admin already marked Complete or Cancel is left exactly as it
  // is, never bumped back to "preparing" by a later kitchen action on the
  // rest of the ticket. See services/orderService.js:updateOrderItemStatus
  // for the reverse direction (one item, from the Orders page).
  let itemsChanged = false;
  for (const line of order.items) {
    if (line.status === "completed" || line.status === "cancelled") continue;
    if (line.status !== status) {
      line.status = status;
      itemsChanged = true;
    }
  }

  // If this cascade finalized every item (a whole-order Complete or
  // Cancel), recompute subtotal/taxableAmount/cgst/sgst/igst/taxAmount/
  // totalAmount/effectiveGstRate the same way a single item action does —
  // so these figures stay accurate whichever screen an order was resolved
  // from, not just item actions from the Orders page.
  if (itemsChanged && (status === "completed" || status === "cancelled")) {
    const aggregates = gstService.recomputeOrderAggregatesFromItems(order);
    order.subtotal = aggregates.subtotal;
    order.taxableAmount = aggregates.taxableAmount;
    order.cgstAmount = aggregates.cgstAmount;
    order.sgstAmount = aggregates.sgstAmount;
    order.igstAmount = aggregates.igstAmount;
    order.taxAmount = aggregates.taxAmount;
    order.totalAmount = aggregates.totalAmount;
    order.effectiveGstRate = aggregates.effectiveGstRate;
  }

  order.status = status;
  order.statusHistory.push({ status, changedAt: new Date() });
  await order.save();

  emitOrderStatusUpdate(order);

  if (itemsChanged && (status === "completed" || status === "cancelled")) {
    await recalculateDownstreamForOrder(order);
  }

  // Note: Customer stats (totalOrders/totalSpent/lastVisit/etc.) are no
  // longer updated here. They're now created/updated once per checkout —
  // see services/orderService.js:upsertCustomerFromOrder, called from
  // finalizeOrder — so every successful order counts immediately instead
  // of waiting for the kitchen to mark it "completed".

  res.json({ order });
});

module.exports = { createOrder, getOrderById, listOrders, listOrdersBySession, updateOrderStatus };
