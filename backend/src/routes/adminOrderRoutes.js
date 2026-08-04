const express = require("express");
const {
  createAdminOrder,
  listAdminOrders,
  deleteOrder,
  updateItemStatus,
} = require("../controllers/adminOrderController");

const router = express.Router();

// Mounted at /api/admin/orders in app.js, already behind the blanket
// `app.use("/api/admin", requireAuth)` — every request here has a valid
// staff JWT (req.staff) before it reaches the controller.
router.post("/", createAdminOrder);
router.get("/", listAdminOrders);
// Item-Level Order Management: Complete/Cancel one ordered item without
// touching any other item on the same order — see
// adminOrderController.updateItemStatus.
router.patch("/:orderId/items/:lineId/status", updateItemStatus);
// Permanent Order Deletion (Admin Dashboard -> Orders -> Delete). Hard
// delete, not a status change — see adminOrderController.deleteOrder.
router.delete("/:orderId", deleteOrder);

module.exports = router;