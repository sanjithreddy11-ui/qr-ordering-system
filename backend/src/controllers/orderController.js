const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const Session = require("../models/Session");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateOrderId = require("../utils/generateOrderId");
const { emitNewOrder, emitOrderStatusUpdate } = require("../sockets/socket");

const TAX_RATE = 0.05;

// POST /api/orders
// Body: { sessionId, restaurantId, tableToken, items: [{ id, quantity }],
//         orderType, specialInstructions, paymentMethod }
//
// Prices are NOT trusted from the client — we look each item up in the
// menu collection and recompute totals server-side. This stops someone
// from tampering with prices via devtools before checkout.
const createOrder = asyncHandler(async (req, res) => {
  const {
    sessionId,
    restaurantId: clientRestaurantId,
    tableToken,
    items,
    orderType,
    specialInstructions,
    paymentMethod,
  } = req.body;

  if (!sessionId) {
    throw new ApiError(400, "sessionId is required");
  }
  if (!clientRestaurantId || !tableToken || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "restaurantId, tableToken and at least one item are required");
  }
  if (!["dine-in", "takeaway"].includes(orderType)) {
    throw new ApiError(400, "orderType must be 'dine-in' or 'takeaway'");
  }
  if (!["upi", "cash", "card"].includes(paymentMethod)) {
    throw new ApiError(400, "Invalid paymentMethod");
  }

  // --- Table token validation (required) ---
  // The Table collection is the single source of truth for table identity.
  // tableToken is looked up on its own (tokens are globally unique — see
  // the unique index on Table.token) rather than scoped to the client's
  // claimed restaurantId, specifically so a mismatched/spoofed restaurantId
  // can't be used to smuggle a fake table through.
  const table = await Table.findOne({ token: tableToken });
  if (!table) {
    throw new ApiError(404, "Invalid table. Please scan the QR code again.");
  }

  // restaurantId is derived from the matched Table document, never trusted
  // from the client, from here on down.
  const restaurantId = table.restaurantId;

  const session = await Session.findOne({ sessionId });
  if (!session) {
    throw new ApiError(400, "Session not found. Please reopen the menu from your QR code.");
  }
  if (session.isExpired()) {
    throw new ApiError(410, "Your session has expired. Please reopen the menu from your QR code.");
  }

  const menuItemIds = items.map((i) => i.id);
  const menuItems = await MenuItem.find({
    restaurantId,
    id: { $in: menuItemIds },
  });

  if (menuItems.length === 0) {
    throw new ApiError(400, "None of the submitted items were found on the menu");
  }

  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  const orderItems = [];
  let subtotal = 0;

  for (const requested of items) {
    const menuItem = menuItemById.get(requested.id);
    if (!menuItem) continue; // silently skip unknown/removed items
    const quantity = Math.max(1, Number(requested.quantity) || 1);

    orderItems.push({
      item: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price,
        diet: menuItem.diet,
        image: menuItem.image,
      },
      quantity,
    });

    subtotal += menuItem.price * quantity;
  }

  if (orderItems.length === 0) {
    throw new ApiError(400, "No valid items to order");
  }

  const taxAmount = Math.round(subtotal * TAX_RATE);
  const totalAmount = subtotal + taxAmount;

  const order = await Order.create({
    orderId: generateOrderId(),
    sessionId,
    restaurantId,
    tableToken: table.token,
    tableLabel: table.label,
    items: orderItems,
    subtotal,
    taxAmount,
    totalAmount,
    orderType,
    specialInstructions: specialInstructions || "",
    paymentMethod,
    status: "pending",
    placedAt: new Date(),
    estimatedMinutes: 20 + Math.floor(Math.random() * 11),
  });

  emitNewOrder(order);

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

// GET /api/orders?restaurantId=cafe-001&status=pending,preparing
// Used by the kitchen dashboard to load its initial order list.
const listOrders = asyncHandler(async (req, res) => {
  const { restaurantId, status } = req.query;

  if (!restaurantId) {
    throw new ApiError(400, "restaurantId query param is required");
  }

  const filter = { restaurantId };
  if (status) {
    filter.status = { $in: String(status).split(",") };
  }

  const orders = await Order.find(filter).sort({ placedAt: -1 }).limit(200);
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

  const order = await Order.findOneAndUpdate(
    { orderId: req.params.orderId },
    { status },
    { new: true }
  );

  if (!order) throw new ApiError(404, "Order not found");

  emitOrderStatusUpdate(order);

  res.json({ order });
});

module.exports = { createOrder, getOrderById, listOrders, listOrdersBySession, updateOrderStatus };
