const Customer = require("../models/Customer");
const Order = require("../models/Order");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/admin/customers/:restaurantId?limit=10
// Ranked by total amount spent (highest first) — powers the Top Customers
// widget. `limit` defaults to 10; pass a higher number for a full list.
const listTopCustomers = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 10));

  const customers = await Customer.find({ restaurantId })
    .sort({ totalSpent: -1 })
    .limit(limit);

  res.json({
    customers: customers.map((c) => ({
      id: c._id,
      name: c.name,
      phone: c.phone,
      totalOrders: c.totalOrders,
      totalSpent: c.totalSpent,
      averageOrderValue: c.averageOrderValue,
      lastVisit: c.lastVisit,
    })),
  });
});

// GET /api/admin/customers/:restaurantId/stats?from=&to=
// Total Customers (all-time), New Customers (first order fell within the
// window — approximated via createdAt, since a Customer doc is only
// created on a customer's first completed order), Repeat Customers
// (totalOrders > 1, all-time).
const getCustomerStats = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { from, to } = req.query;

  const toDate = to ? new Date(to) : new Date();
  const fromDate = from ? new Date(from) : new Date(toDate.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [totalCustomers, newCustomers, repeatCustomers] = await Promise.all([
    Customer.countDocuments({ restaurantId }),
    Customer.countDocuments({ restaurantId, createdAt: { $gte: fromDate, $lte: toDate } }),
    Customer.countDocuments({ restaurantId, totalOrders: { $gt: 1 } }),
  ]);

  res.json({ totalCustomers, newCustomers, repeatCustomers });
});

// GET /api/admin/customers/:restaurantId/:phone/orders
// Order history for one customer — powers the "view history" action on
// the Customers page.
const getCustomerOrderHistory = asyncHandler(async (req, res) => {
  const { restaurantId, phone } = req.params;

  const customer = await Customer.findOne({ restaurantId, phone });
  if (!customer) throw new ApiError(404, "Customer not found");

  const orders = await Order.find({ restaurantId, customerPhone: phone })
    .sort({ placedAt: -1 })
    .limit(100);

  res.json({ customer, orders });
});

module.exports = { listTopCustomers, getCustomerStats, getCustomerOrderHistory };
