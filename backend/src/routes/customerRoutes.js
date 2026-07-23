const express = require("express");
const {
  listTopCustomers,
  getCustomerStats,
  getCustomerOrderHistory,
} = require("../controllers/customerController");

const router = express.Router();

router.get("/:restaurantId/stats", getCustomerStats);
router.get("/:restaurantId/:phone/orders", getCustomerOrderHistory);
router.get("/:restaurantId", listTopCustomers);

module.exports = router;
