const express = require("express");
const {
  createOrder,
  getOrderById,
  listOrders,
  listOrdersBySession,
  updateOrderStatus,
} = require("../controllers/orderController");
const { getAnalytics } = require("../controllers/analyticsController");

const router = express.Router();

router.post("/", createOrder);
router.get("/", listOrders);
// IMPORTANT: both of these must come before "/:orderId" or Express will
// treat "session"/"analytics" as an orderId value and these routes will
// never be reached.
router.get("/session/:sessionId", listOrdersBySession);
router.get("/analytics", getAnalytics);
router.get("/:orderId", getOrderById);
router.patch("/:orderId/status", updateOrderStatus);

module.exports = router;
