const express = require("express");
const { getVisitStatus } = require("../controllers/visitController");

const router = express.Router();

// Unauthenticated, like /api/otp and /api/sessions — this is the check
// that runs BEFORE authentication (to decide whether OTP is even needed).
router.get("/status", getVisitStatus);

module.exports = router;
