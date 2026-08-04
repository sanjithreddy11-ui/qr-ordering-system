const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// Shared bucketing rule for this whole module: `upi` and `card` are both
// "paid through a gateway/terminal, not counted by hand" so they roll up
// into the "online" bucket everywhere a 2-way split is shown (overview
// cards, distribution chart, revenue-by-method bar chart). `cash` is its
// own bucket. Anywhere the raw per-method value matters (transaction
// history, pending cash list) the exact `paymentMethod` is still returned
// untouched, so nothing about the underlying data is lost — this is a
// display-time grouping, not a data model change.
const ONLINE_METHODS = ["upi", "card"];

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseRange(query) {
  const toDate = query.to ? new Date(query.to) : new Date();
  const fromDate = query.from ? new Date(query.from) : startOfDay(toDate);
  return { fromDate, toDate };
}

// GET /api/admin/payments/overview?restaurantId=&from=&to=
// Powers the top summary cards + the Online/Cash breakdown cards +
// distribution chart. Defaults to "today" when no range is given, since
// that's this page's primary use case (a live payments/cash-collection
// view for the current shift).
const getPaymentOverview = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const { fromDate, toDate } = parseRange(req.query);

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
        _id: "$paymentMethod",
        revenue: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
  ]);

  const byMethod = Object.fromEntries(rows.map((r) => [r._id, { revenue: r.revenue, count: r.count }]));
  const upi = byMethod.upi ?? { revenue: 0, count: 0 };
  const card = byMethod.card ?? { revenue: 0, count: 0 };
  const cash = byMethod.cash ?? { revenue: 0, count: 0 };

  const onlineRevenue = upi.revenue + card.revenue;
  const onlineCount = upi.count + card.count;
  const totalRevenue = onlineRevenue + cash.revenue;
  const totalTransactions = onlineCount + cash.count;

  const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0);
  const avg = (revenue, count) => (count > 0 ? Math.round(revenue / count) : 0);

  res.json({
    range: { from: fromDate, to: toDate },
    totalRevenue,
    totalTransactions,
    averageBill: avg(totalRevenue, totalTransactions),
    online: {
      revenue: onlineRevenue,
      transactions: onlineCount,
      percentage: pct(onlineRevenue, totalRevenue),
      averageBill: avg(onlineRevenue, onlineCount),
      upi: { revenue: upi.revenue, transactions: upi.count },
      card: { revenue: card.revenue, transactions: card.count },
    },
    cash: {
      revenue: cash.revenue,
      transactions: cash.count,
      percentage: pct(cash.revenue, totalRevenue),
      averageBill: avg(cash.revenue, cash.count),
    },
  });
});

// GET /api/admin/payments/daily?restaurantId=&from=&to=
// Online vs Cash revenue per calendar day — feeds the "Revenue by Payment
// Method" bar chart. Defaults to the last 7 days.
const getPaymentDailyBreakdown = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const toDate = req.query.to ? new Date(req.query.to) : new Date();
  const fromDate = req.query.from
    ? new Date(req.query.from)
    : new Date(toDate.getTime() - 7 * 24 * 60 * 60 * 1000);

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
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$placedAt" } },
          method: "$paymentMethod",
        },
        revenue: { $sum: "$totalAmount" },
        count: { $sum: 1 },
      },
    },
    { $sort: { "_id.date": 1 } },
  ]);

  const byDate = new Map();
  for (const row of rows) {
    const date = row._id.date;
    if (!byDate.has(date)) {
      byDate.set(date, { date, onlineRevenue: 0, cashRevenue: 0, onlineCount: 0, cashCount: 0 });
    }
    const entry = byDate.get(date);
    if (ONLINE_METHODS.includes(row._id.method)) {
      entry.onlineRevenue += row.revenue;
      entry.onlineCount += row.count;
    } else {
      entry.cashRevenue += row.revenue;
      entry.cashCount += row.count;
    }
  }

  res.json({ days: Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date)) });
});

// GET /api/admin/payments/transactions?restaurantId=&search=&method=&status=&from=&to=&sort=&limit=
// Searchable/filterable/sortable transaction history table.
//   method: "online" | "cash" | "upi" | "card" (optional)
//   status: "paid" | "pending" (optional)
//   sort:   "latest" (default) | "highest" | "lowest"
const listPaymentTransactions = asyncHandler(async (req, res) => {
  const { restaurantId, search, method, status, from, to, sort, limit } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const filter = { restaurantId, status: { $ne: "cancelled" } };

  if (method === "online") {
    filter.paymentMethod = { $in: ONLINE_METHODS };
  } else if (method === "cash" || method === "upi" || method === "card") {
    filter.paymentMethod = method;
  }

  if (status === "paid" || status === "pending") {
    filter.paymentStatus = status;
  }

  if (search) {
    const regex = new RegExp(String(search).trim(), "i");
    filter.$or = [{ orderId: regex }, { customerName: regex }, { customerPhone: regex }, { tableLabel: regex }];
  }

  if (from || to) {
    filter.placedAt = {};
    if (from) filter.placedAt.$gte = new Date(from);
    if (to) filter.placedAt.$lte = new Date(to);
  }

  const sortSpec =
    sort === "highest" ? { totalAmount: -1 } : sort === "lowest" ? { totalAmount: 1 } : { placedAt: -1 };

  const cappedLimit = Math.min(500, Math.max(1, Number(limit) || 200));

  const orders = await Order.find(filter).sort(sortSpec).limit(cappedLimit);

  res.json({
    transactions: orders.map((o) => ({
      orderId: o.orderId,
      placedAt: o.placedAt,
      tableLabel: o.tableLabel || "—",
      customerName: o.customerName || "Guest",
      amount: o.totalAmount,
      paymentMethod: o.paymentMethod,
      paymentStatus: o.paymentStatus,
      orderStatus: o.status,
    })),
  });
});

// GET /api/admin/payments/pending-cash?restaurantId=
// Live "still needs to be collected" list — every non-cancelled cash order
// that hasn't been marked paid yet.
const getPendingCashPayments = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const orders = await Order.find({
    restaurantId,
    paymentMethod: "cash",
    paymentStatus: "pending",
    status: { $ne: "cancelled" },
  }).sort({ placedAt: 1 });

  res.json({
    pending: orders.map((o) => ({
      orderId: o.orderId,
      tableLabel: o.tableLabel || "—",
      customerName: o.customerName || "Guest",
      amount: o.totalAmount,
      placedAt: o.placedAt,
    })),
  });
});

// PATCH /api/admin/payments/:orderId/collect
// Cashier confirms a cash bill has been physically collected. This only
// ever touches this one Order's paymentStatus — it intentionally does NOT
// vacate the table or close the dining session, since that remains the
// job of the existing Table Management "Collect Payment" flow
// (sessionPaymentController.collectPayment), which settles the whole
// session's bill at once. This endpoint just keeps the Payments
// dashboard's pending-cash list accurate for individual order-level cash
// payments (e.g. takeaway, or an order paid off mid-session).
const collectCashPayment = asyncHandler(async (req, res) => {
  const { orderId } = req.params;

  const order = await Order.findOne({ orderId });
  if (!order) throw new ApiError(404, "Order not found");
  if (order.paymentMethod !== "cash") {
    throw new ApiError(400, "Only cash orders can be marked as collected here");
  }
  if (order.paymentStatus === "paid") {
    throw new ApiError(409, "This order has already been marked as paid");
  }

  order.paymentStatus = "paid";
  await order.save();

  res.json({ order });
});

// GET /api/admin/payments/success-metrics?restaurantId=&from=&to=
// "Successful" = every non-cancelled order in range (it reached the
// kitchen/was fulfilled). "Failed" is always 0 — checkout is cash-only, so
// there's no gateway attempt that can fail before an order is created.
// "Refunded" isn't modeled anywhere yet, so it's always 0 too — both are
// still returned so the UI/API shape doesn't need to change if either is
// tracked later.
const getPaymentSuccessMetrics = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const { fromDate, toDate } = parseRange(req.query);

  const successful = await Order.countDocuments({
    restaurantId,
    status: { $ne: "cancelled" },
    placedAt: { $gte: fromDate, $lte: toDate },
  });

  const failed = 0;
  const refunded = 0;
  const total = successful + failed;
  const pct = (part) => (total > 0 ? Math.round((part / total) * 1000) / 10 : 0);

  res.json({
    successful,
    failed,
    refunded,
    successfulPercentage: pct(successful),
    failedPercentage: pct(failed),
  });
});

module.exports = {
  getPaymentOverview,
  getPaymentDailyBreakdown,
  listPaymentTransactions,
  getPendingCashPayments,
  collectCashPayment,
  getPaymentSuccessMetrics,
};