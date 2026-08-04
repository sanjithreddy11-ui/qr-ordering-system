const crypto = require("crypto");
const PhoneVerification = require("../models/PhoneVerification");
const ApiError = require("../utils/ApiError");
const { sendOtpSms, verifyOtpSms } = require("../config/twoFactor");

const PHONE_REGEX = /^\d{10}$/;

// POST /api/otp/send — sends a fresh OTP via 2Factor and records the
// session id against this phone, overwriting any previous attempt.
async function sendOtp(phone) {
  if (!PHONE_REGEX.test(phone)) {
    throw new ApiError(400, "Please enter a valid 10-digit phone number");
  }

  const sessionId = await sendOtpSms(phone);

  const expiresAt = new Date(Date.now() + PhoneVerification.OTP_TTL_MINUTES * 60 * 1000);
  await PhoneVerification.findOneAndUpdate(
    { phone },
    { phone, sessionId, verified: false, token: null, expiresAt },
    { upsert: true, new: true }
  );
}

// POST /api/otp/verify — checks the customer-entered code against the
// pending 2Factor session for this phone. On success, issues a random
// verification token the frontend carries through to checkout (see
// middleware/verifyPhoneToken.js) — this is what actually authorizes
// order creation, not the OTP itself.
async function verifyOtp(phone, otp) {
  if (!PHONE_REGEX.test(phone)) {
    throw new ApiError(400, "Please enter a valid 10-digit phone number");
  }
  if (!otp || !/^\d{4,8}$/.test(String(otp).trim())) {
    throw new ApiError(400, "Please enter the OTP you received");
  }

  const record = await PhoneVerification.findOne({ phone });
  if (!record || !record.sessionId || record.isExpired()) {
    throw new ApiError(400, "Your OTP has expired. Please request a new one.");
  }

  const matched = await verifyOtpSms(record.sessionId, String(otp).trim());
  if (!matched) {
    throw new ApiError(400, "That code is incorrect or has expired. Please try again.");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + PhoneVerification.VERIFIED_TTL_MINUTES * 60 * 1000);

  record.verified = true;
  record.token = token;
  record.expiresAt = expiresAt;
  await record.save();

  return token;
}

// Used by middleware/verifyPhoneToken.js at checkout — confirms the token
// is real, unexpired, verified, and actually belongs to the phone number
// on the order. Returns the verified phone on success, null otherwise.
async function resolveVerifiedPhone(phone, token) {
  if (!phone || !token) return null;

  const record = await PhoneVerification.findOne({ phone, token, verified: true });
  if (!record || record.isExpired()) return null;

  return record.phone;
}

module.exports = { sendOtp, verifyOtp, resolveVerifiedPhone };
