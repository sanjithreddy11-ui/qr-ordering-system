const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/orders/analytics?restaurantId=maxibrew&from=2026-06-01&to=2026-07-01
// `from`/`to` are optional ISO date strings; defaults to the last 30 days.
// Cancelled orders are excluded from every figure below — they were never
// fulfilled, so counting their value as revenue would be misleading.
const getAnalytics = asyncHandler(async (req, res) => {
  const { restaurantId, from, to } = req.query;

  if (!restaurantId) {
    throw new ApiError(400, "restaurantId query param is required");
  }

  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const match = {
    restaurantId,
    status: { $ne: "cancelled" },
    placedAt: { $gte: fromDate, $lte: toDate },
  };

  // Summary: total revenue, order count, average order value
  const [summary] = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        totalRevenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
  ]);

  // Top items: unwind each order's line items, group by item id
  const topItems = await Order.aggregate([
    { $match: match },
    { $unwind: "$items" },
    {
      $group: {
        _id: "$items.item.id",
        name: { $first: "$items.item.name" },
        quantitySold: { $sum: "$items.quantity" },
        revenue: { $sum: { $multiply: ["$items.item.price", "$items.quantity"] } },
      },
    },
    { $sort: { quantitySold: -1 } },
    { $limit: 10 },
  ]);

  // Daily totals: group by calendar day (in UTC — fine for a single-timezone demo)
  const dailyTotals = await Order.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$placedAt" } },
        revenue: { $sum: "$totalAmount" },
        orderCount: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.json({
    range: { from: fromDate, to: toDate },
    totalRevenue: summary?.totalRevenue ?? 0,
    orderCount: summary?.orderCount ?? 0,
    averageOrderValue: summary ? Math.round(summary.totalRevenue / summary.orderCount) : 0,
    topItems: topItems.map((t) => ({
      id: t._id,
      name: t.name,
      quantitySold: t.quantitySold,
      revenue: t.revenue,
    })),
    dailyTotals: dailyTotals.map((d) => ({
      date: d._id,
      revenue: d.revenue,
      orderCount: d.orderCount,
    })),
  });
});

// GET /api/orders/analytics/peak-hours?restaurantId=maxibrew&from=&to=
// Order volume grouped by hour-of-day (0-23), defaulting to the last 30
// days. Powers the Peak Hours chart on the Analytics page.
const getPeakHours = asyncHandler(async (req, res) => {
  const { restaurantId, from, to } = req.query;

  if (!restaurantId) {
    throw new ApiError(400, "restaurantId query param is required");
  }

  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const rows = await Order.aggregate([
    {
      $match: {
        restaurantId,
        status: { $ne: "cancelled" },
        placedAt: { $gte: fromDate, $lte: toDate },
      },
    },
    {
      $group: {
        _id: { $hour: "$placedAt" },
        orderCount: { $sum: 1 },
        revenue: { $sum: "$totalAmount" },
      },
    },
  ]);

  const countByHour = Object.fromEntries(rows.map((r) => [r._id, { orderCount: r.orderCount, revenue: r.revenue }]));
  const hours = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    orderCount: countByHour[hour]?.orderCount ?? 0,
    revenue: countByHour[hour]?.revenue ?? 0,
  }));

  res.json({ hours });
});

module.exports = { getAnalytics, getPeakHours };
