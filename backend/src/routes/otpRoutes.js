const express = require("express");
const { sendOtpHandler, verifyOtpHandler } = require("../controllers/otpController");

const router = express.Router();

// Both unauthenticated — this IS the authentication step for checkout.
router.post("/send", sendOtpHandler);
router.post("/verify", verifyOtpHandler);

module.exports = router;
