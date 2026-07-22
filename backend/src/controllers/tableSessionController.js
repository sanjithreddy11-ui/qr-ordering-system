const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/admin/table-sessions/:restaurantId?status=active
const listTableSessions = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { status } = req.query;

  const filter = { restaurantId };
  if (status) filter.status = status;

  const sessions = await TableSession.find(filter).sort({ sessionStart: -1 }).limit(200);
  res.json({ sessions });
});

// GET /api/admin/table-sessions/:sessionId/orders
// Bulk-fetches the full Order documents attached to a table session, for
// the "Current Orders" section of the table-details view. Reuses the
// existing Order model/collection — no new order-writing logic.
const getSessionOrders = asyncHandler(async (req, res) => {
  const session = await TableSession.findOne({ sessionId: req.params.sessionId });
  if (!session) throw new ApiError(404, "Table session not found");

  const orders = await Order.find({ orderId: { $in: session.orderIds } }).sort({ placedAt: -1 });
  res.json({ session, orders });
});

module.exports = { listTableSessions, getSessionOrders };
