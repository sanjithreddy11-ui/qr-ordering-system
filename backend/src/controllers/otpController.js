const asyncHandler = require("../utils/asyncHandler");
const { sendOtp, verifyOtp } = require("../services/otpService");

// POST /api/otp/send
// Body: { phone: "9876543210" }
const sendOtpHandler = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  await sendOtp(String(phone || "").trim());
  res.json({ success: true });
});

// POST /api/otp/verify
// Body: { phone: "9876543210", otp: "123456" }
// Returns a short-lived verification token the frontend must send back
// (as Authorization: Bearer <token>) when placing the order — see
// middleware/verifyPhoneToken.js.
const verifyOtpHandler = asyncHandler(async (req, res) => {
  const { phone, otp } = req.body;
  const token = await verifyOtp(String(phone || "").trim(), otp);
  res.json({ verified: true, token });
});

module.exports = { sendOtpHandler, verifyOtpHandler };
