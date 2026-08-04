const express = require("express");
const { listTableSessions, getSessionOrders } = require("../controllers/tableSessionController");

const router = express.Router();

router.get("/:sessionId/orders", getSessionOrders);
router.get("/:restaurantId", listTableSessions);

module.exports = router;
