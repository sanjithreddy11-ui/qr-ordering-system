const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Table = require("../models/Table");
const { sendOtp, verifyOtp } = require("../services/otpService");
const {
  findOrCreateCustomer,
  createVisitSession,
} = require("../services/visitSessionService");

// POST /api/otp/send
// Body: { phone: "9876543210" }
const sendOtpHandler = asyncHandler(async (req, res) => {
  const { phone } = req.body;
  await sendOtp(String(phone || "").trim());
  res.json({ success: true });
});

// POST /api/otp/verify
// Body: { phone: "9876543210", otp: "123456", deviceId, tableToken, name? }
//
// Visit-Based Customer Authentication: on a successful OTP match this now
// does the rest of the "First Visit" flow in one step — find/create the
// permanent Customer record, then open a brand-new ACTIVE VisitSession for
// this (customer, device) pair (see services/visitSessionService.js).
//
// Returns:
//   - token: the short-lived PhoneVerification token (kept for backward
//     compatibility / auditing of the raw OTP event itself).
//   - visitToken: the one that actually matters going forward — the
//     frontend sends this as Authorization: Bearer <visitToken> for every
//     order placed during this visit (see middleware/verifyPhoneToken.js),
//     and it keeps working across as many orders as the customer places
//     until the admin submits the table's bill (or another table-closing
//     event runs) — no repeated OTP in between.
const verifyOtpHandler = asyncHandler(async (req, res) => {
  const { phone: rawPhone, otp, deviceId, tableToken, name } = req.body;
  const phone = String(rawPhone || "").trim();

  if (!deviceId) {
    throw new ApiError(400, "Missing device identifier. Please reload the page and try again.");
  }
  if (!tableToken) {
    throw new ApiError(400, "Missing table information. Please scan the QR code again.");
  }

  const table = await Table.findOne({ token: tableToken });
  if (!table) {
    throw new ApiError(404, "Invalid table. Please scan the QR code again.");
  }

  const token = await verifyOtp(phone, otp);

  const customer = await findOrCreateCustomer(table.restaurantId, phone, name ? String(name).trim() : "");

  const visit = await createVisitSession({
    restaurantId: table.restaurantId,
    tableToken,
    customerId: customer._id,
    phone,
    deviceId: String(deviceId),
  });

  res.json({
    verified: true,
    token,
    visitToken: visit.token,
    customerId: customer._id,
    name: customer.name,
  });
});

module.exports = { sendOtpHandler, verifyOtpHandler };
