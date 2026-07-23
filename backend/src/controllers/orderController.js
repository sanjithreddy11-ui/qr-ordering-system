const Order = require("../models/Order");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { emitOrderStatusUpdate } = require("../sockets/socket");
const { validateAndBuildOrder, finalizeOrder } = require("../services/orderService");

// POST /api/orders
// Body: { sessionId, restaurantId, tableToken, items: [{ id, quantity }],
//         orderType, specialInstructions, paymentMethod }
//
// This is the "pay at counter" flow (cash) — the order is created and
// broadcast immediately, same as before. For "upi"/"card", the frontend
// now goes through POST /api/payments/create-order + /api/payments/verify
// instead (see controllers/paymentController.js), which uses the exact
// same validation/pricing/creation logic below via services/orderService,
// just gated behind a verified Razorpay payment.
const createOrder = asyncHandler(async (req, res) => {
  const orderData = await validateAndBuildOrder(req.body);
  const order = await finalizeOrder(orderData);
  res.status(201).json({ order });
});

// GET /api/orders/session/:sessionId
// Powers the Active Orders / Past Orders tabs. A session only ever sees
// its own orders — never other customers', even at the same table.
const listOrdersBySession = asyncHandler(async (req, res) => {
  const { sessionId } = req.params;
  const orders = await Order.find({ sessionId }).sort({ placedAt: -1 }).limit(100);

  const active = orders.filter((o) => ["pending", "preparing", "ready"].includes(o.status));
  const past = orders.filter((o) => ["completed", "cancelled"].includes(o.status));

  res.json({ active, past });
});

// GET /api/orders/:orderId
// Used by the order-success page to fetch (and later poll/re-fetch) status.
const getOrderById = asyncHandler(async (req, res) => {
  const order = await Order.findOne({ orderId: req.params.orderId });
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

  const orders = await Order.find(filter).sort({ placedAt: -1 }).limit(cappedLimit);
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

  const previous = await Order.findOne({ orderId: req.params.orderId });
  if (!previous) throw new ApiError(404, "Order not found");

  const order = await Order.findOneAndUpdate(
    { orderId: req.params.orderId },
    { status, $push: { statusHistory: { status, changedAt: new Date() } } },
    { new: true }
  );

  emitOrderStatusUpdate(order);

  // Roll the order into Customer stats exactly once, the moment it first
  // becomes "completed" — guarded by `previous.status !== "completed"` so
  // re-saving an already-completed order (or any other status change)
  // never double-counts it.
  if (status === "completed" && previous.status !== "completed" && order.customerPhone) {
    const existing = await Customer.findOne({
      restaurantId: order.restaurantId,
      phone: order.customerPhone,
    });

    const totalOrders = (existing?.totalOrders ?? 0) + 1;
    const totalSpent = (existing?.totalSpent ?? 0) + order.totalAmount;

    await Customer.findOneAndUpdate(
      { restaurantId: order.restaurantId, phone: order.customerPhone },
      {
        restaurantId: order.restaurantId,
        phone: order.customerPhone,
        name: order.customerName || existing?.name || "Guest",
        totalOrders,
        totalSpent,
        averageOrderValue: Math.round(totalSpent / totalOrders),
        lastVisit: order.placedAt,
      },
      { upsert: true, new: true }
    );
  }

  res.json({ order });
});

module.exports = { createOrder, getOrderById, listOrders, listOrdersBySession, updateOrderStatus };
