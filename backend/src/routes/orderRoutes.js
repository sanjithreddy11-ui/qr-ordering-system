const express = require("express");
const {
  createOrder,
  getOrderById,
  listOrders,
  listOrdersBySession,
  updateOrderStatus,
} = require("../controllers/orderController");

const router = express.Router();

router.post("/", createOrder);
router.get("/", listOrders);
// IMPORTANT: this must come before "/:orderId" or Express will treat
// "session" as an orderId value and this route will never be reached.
router.get("/session/:sessionId", listOrdersBySession);
router.get("/:orderId", getOrderById);
router.patch("/:orderId/status", updateOrderStatus);

module.exports = router;
