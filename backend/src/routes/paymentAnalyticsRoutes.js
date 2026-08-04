const express = require("express");
const {
  getPaymentOverview,
  getPaymentDailyBreakdown,
  listPaymentTransactions,
  getPendingCashPayments,
  collectCashPayment,
  getPaymentSuccessMetrics,
} = require("../controllers/paymentAnalyticsController");

const router = express.Router();

// Mounted at /api/admin/payments in app.js — every route here already sits
// behind the /api/admin requireAuth gate, same as dashboardRoutes.
router.get("/overview", getPaymentOverview);
router.get("/daily", getPaymentDailyBreakdown);
router.get("/transactions", listPaymentTransactions);
router.get("/pending-cash", getPendingCashPayments);
router.get("/success-metrics", getPaymentSuccessMetrics);
router.patch("/:orderId/collect", collectCashPayment);

module.exports = router;