const Order = require("../models/Order");
const Table = require("../models/Table");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function revenueBetween(restaurantId, from, to) {
  const [row] = await Order.aggregate([
    {
      $match: {
        restaurantId,
        status: { $ne: "cancelled" },
        placedAt: { $gte: from, $lt: to },
      },
    },
    { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
  ]);
  return { revenue: row?.revenue ?? 0, orderCount: row?.orderCount ?? 0 };
}

// GET /api/admin/dashboard/summary?restaurantId=lifafa
// Powers the 8 top-of-dashboard stat cards. Cheap, single-purpose
// aggregations rather than one giant pipeline, since each figure has a
// different match condition (today vs. all-time table state).
const getSummary = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const todayStart = startOfDay(new Date());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

  const [today, statusCounts, activeTables] = await Promise.all([
    revenueBetween(restaurantId, todayStart, tomorrowStart),
    Order.aggregate([
      { $match: { restaurantId, placedAt: { $gte: todayStart, $lt: tomorrowStart } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    Table.countDocuments({ restaurantId, isActive: true }),
  ]);

  const countByStatus = Object.fromEntries(statusCounts.map((s) => [s._id, s.count]));

  res.json({
    todayRevenue: today.revenue,
    todayOrders: today.orderCount,
    pendingOrders: countByStatus.pending ?? 0,
    preparingOrders: countByStatus.preparing ?? 0,
    readyOrders: countByStatus.ready ?? 0,
    completedOrders: countByStatus.completed ?? 0,
    cancelledOrders: countByStatus.cancelled ?? 0,
    activeTables,
    averageOrderValue: today.orderCount ? Math.round(today.revenue / today.orderCount) : 0,
  });
});

// GET /api/admin/dashboard/revenue?restaurantId=lifafa
// Today / Yesterday / Last 7 days / Last 30 days revenue, for the Revenue
// Analytics section (separate from the trend chart, which uses the
// existing GET /api/orders/analytics dailyTotals).
const getRevenueBreakdown = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const todayStart = startOfDay(new Date());
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);
  const weekStart = new Date(todayStart.getTime() - 7 * 24 * 60 * 60 * 1000);
  const monthStart = new Date(todayStart.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [today, yesterday, weekly, monthly] = await Promise.all([
    revenueBetween(restaurantId, todayStart, tomorrowStart),
    revenueBetween(restaurantId, yesterdayStart, todayStart),
    revenueBetween(restaurantId, weekStart, tomorrowStart),
    revenueBetween(restaurantId, monthStart, tomorrowStart),
  ]);

  res.json({
    today: today.revenue,
    yesterday: yesterday.revenue,
    weekly: weekly.revenue,
    monthly: monthly.revenue,
  });
});

module.exports = { getSummary, getRevenueBreakdown };
