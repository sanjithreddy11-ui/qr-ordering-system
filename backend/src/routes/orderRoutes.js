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

const router = express.Router();

router.post("/", createOrder);
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
