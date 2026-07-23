const express = require("express");
const { createPaymentOrder, verifyPayment } = require("../controllers/paymentController");

const router = express.Router();

// Both are unauthenticated, same as /api/orders — this is the
// customer-facing checkout flow, not an admin route.
router.post("/create-order", createPaymentOrder);
router.post("/verify", verifyPayment);

module.exports = router;
