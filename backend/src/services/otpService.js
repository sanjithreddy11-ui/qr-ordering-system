const crypto = require("crypto");
const PhoneVerification = require("../models/PhoneVerification");
const ApiError = require("../utils/ApiError");

const PHONE_REGEX = /^\d{10}$/;

// DEVELOPMENT/DEMO AUTHENTICATION MODE (default).
//
// Real phone-ownership verification via 2Factor is DISABLED unless
// OTP_PROVIDER=2factor is explicitly set. In the default "disabled" mode:
//   - no request is ever made to 2Factor (config/twoFactor.js is not even
//     loaded), no OTP is generated, no SMS/call is sent, and
//     TWOFACTOR_API_KEY is not required;
//   - a well-formed 10-digit phone number is accepted as "verified" and
//     flows through the exact same success path as before (PhoneVerification
//     record -> Customer find/create -> new ACTIVE VisitSession).
// This does NOT prove the caller owns that phone number — anyone can enter
// any number. Set OTP_PROVIDER=2factor (plus TWOFACTOR_API_KEY) to restore
// real verification; the frontend then needs its OTP-entry step back too.
function isTwoFactorEnabled() {
  return String(process.env.OTP_PROVIDER || "").trim().toLowerCase() === "2factor";
}

// Loaded lazily so the 2Factor client is never even required in dev mode.
function twoFactor() {
  return require("../config/twoFactor");
}

// POST /api/otp/send — sends a fresh OTP via 2Factor and records the
// session id against this phone, overwriting any previous attempt.
async function sendOtp(phone) {
  if (!PHONE_REGEX.test(phone)) {
    throw new ApiError(400, "Please enter a valid 10-digit phone number");
  }

  // Dev/demo mode: nothing to send. Never contact 2Factor.
  if (!isTwoFactorEnabled()) return;

  const sessionId = await twoFactor().sendOtpSms(phone);

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

  // Dev/demo mode: accept a well-formed phone with no OTP and no external
  // call, then reuse the normal success path below (token + record).
  if (!isTwoFactorEnabled()) {
    const token = crypto.randomBytes(24).toString("hex");
    const expiresAt = new Date(Date.now() + PhoneVerification.VERIFIED_TTL_MINUTES * 60 * 1000);
    await PhoneVerification.findOneAndUpdate(
      { phone },
      { phone, sessionId: null, verified: true, token, expiresAt, method: "dev-bypass" },
      { upsert: true, new: true }
    );
    return token;
  }

  if (!otp || !/^\d{4,8}$/.test(String(otp).trim())) {
    throw new ApiError(400, "Please enter the OTP you received");
  }

  const record = await PhoneVerification.findOne({ phone });
  if (!record || !record.sessionId || record.isExpired()) {
    throw new ApiError(400, "Your OTP has expired. Please request a new one.");
  }

  const matched = await twoFactor().verifyOtpSms(record.sessionId, String(otp).trim());
  if (!matched) {
    throw new ApiError(400, "That code is incorrect or has expired. Please try again.");
  }

  const token = crypto.randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + PhoneVerification.VERIFIED_TTL_MINUTES * 60 * 1000);

  record.verified = true;
  record.method = "2factor";
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
