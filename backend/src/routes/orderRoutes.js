const express = require("express");
const {
  createOrder,
  getOrderById,
  listOrders,
  listOrdersBySession,
  updateOrderStatus,
} = require("../controllers/orderController");
const { getAnalytics, getPeakHours } = require("../controllers/analyticsController");
const { requireAuth } = require("../middleware/auth");
const { verifyPhoneToken } = require("../middleware/verifyPhoneToken");

const router = express.Router();

// Checkout must present a verified phone token from POST /api/otp/verify —
// see middleware/verifyPhoneToken.js. Every other route below stays
// unauthenticated (kitchen display, session/order tracking) or staff-only
// (analytics), exactly as before.
router.post("/", verifyPhoneToken, createOrder);
router.get("/", listOrders);
// IMPORTANT: both of these must come before "/:orderId" or Express will
// treat "session"/"analytics" as an orderId value and these routes will
// never be reached.
router.get("/session/:sessionId", listOrdersBySession);
// Revenue data is admin-only, unlike the rest of this router (kitchen
// display + customer order tracking, which stay unauthenticated).
router.get("/analytics", requireAuth, getAnalytics);
router.get("/analytics/peak-hours", requireAuth, getPeakHours);
router.get("/:orderId", getOrderById);
router.patch("/:orderId/status", updateOrderStatus);

module.exports = router;
