const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  validateAndBuildAdminOrder,
  finalizeOrder,
  deleteOrderCascade,
  updateOrderItemStatus,
} = require("../services/orderService");

// Kitchen staff can see/prepare orders but shouldn't be placing them —
// mirrors the Staff.role enum (admin | kitchen | waiter) in models/Staff.js.
// "Only Admins and authorized Staff can create manual orders" from the spec.
const ALLOWED_ROLES = ["admin", "waiter"];

// POST /api/admin/orders
// Body: { restaurantId, orderType, tableId?, items: [{ id, quantity, notes? }],
//         customerName?, customerPhone?, specialInstructions? }
//
// Admin Manual Ordering — staff placing an order directly from the
// Tables & QR -> Create Order flow (walk-in / counter customers who didn't
// scan a QR code). Reuses the exact same finalizeOrder pipeline as QR
// orders (services/orderService.js), so table-occupancy sync, the Kitchen
// Dashboard broadcast, customer tracking, and stock deduction all behave
// identically regardless of source — the Kitchen workflow never needs to
// know or care where an order came from.
const createAdminOrder = asyncHandler(async (req, res) => {
  if (!ALLOWED_ROLES.includes(req.staff.role)) {
    throw new ApiError(403, "Only admins and waiters can create manual orders");
  }

  // restaurantId is always the authenticated staff member's own restaurant —
  // never trusted from the client body, same pattern as every other
  // /api/admin/* controller keyed off req.staff.
  const orderData = await validateAndBuildAdminOrder(
    { ...req.body, restaurantId: req.staff.restaurantId },
    req.staff
  );
  const order = await finalizeOrder(orderData);
  res.status(201).json({ order });
});

// GET /api/admin/orders?status=pending,preparing&search=&from=&to=&limit=
// Same filtering shape as GET /api/orders (see orderController.js), scoped
// to orderSource: "ADMIN" so the dashboard can show just the manually
// created orders if it ever needs to (e.g. a "Manual Orders" audit list).
const listAdminOrders = asyncHandler(async (req, res) => {
  const { status, search, from, to, limit } = req.query;

  const filter = { restaurantId: req.staff.restaurantId, orderSource: "ADMIN" };
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

// DELETE /api/admin/orders/:orderId
//
// Permanent Order Deletion — NOT cancellation. The order document is
// physically removed from MongoDB (no soft-delete flag), as if it had
// never been created. See services/orderService.js:deleteOrderCascade for
// the full cleanup of every place the order is referenced elsewhere
// (TableSession bill totals, Settlements, Customer running totals) —
// Orders/Analytics/Revenue/Reports/Dashboard/Search all read the Order
// collection live, so they're automatically consistent the moment the
// document is gone.
//
// Restricted to admins only (unlike creating a manual order, which
// waiters can also do) — this is a destructive, unrecoverable action.
const deleteOrder = asyncHandler(async (req, res) => {
  if (req.staff.role !== "admin") {
    throw new ApiError(403, "Only admins can permanently delete orders");
  }

  const order = await Order.findOne({
    orderId: req.params.orderId,
    restaurantId: req.staff.restaurantId,
  });
  if (!order) throw new ApiError(404, "Order not found");

  await deleteOrderCascade(order);

  res.json({ success: true, orderId: order.orderId });
});

// PATCH /api/admin/orders/:orderId/items/:lineId/status
// Body: { status: "completed" | "cancelled" }
//
// Item-Level Order Management — replaces "delete the whole order" as the
// day-to-day action: staff complete or cancel exactly one ordered item.
// The order's own status/totals/GST are then derived automatically from
// its items (see services/orderService.js:updateOrderItemStatus) —
// completing or cancelling an item never touches any other item on the
// same order.
//
// Same roles allowed to place a manual order can also manage its items —
// mirrors ALLOWED_ROLES above (kitchen staff have their own whole-ticket
// flow on the Kitchen Dashboard instead).
const updateItemStatus = asyncHandler(async (req, res) => {
  if (!ALLOWED_ROLES.includes(req.staff.role)) {
    throw new ApiError(403, "Only admins and waiters can manage order items");
  }

  const { status } = req.body;
  const { orderId, lineId } = req.params;

  const order = await updateOrderItemStatus(orderId, req.staff.restaurantId, lineId, status);
  res.json({ order });
});

module.exports = { createAdminOrder, listAdminOrders, deleteOrder, updateItemStatus };