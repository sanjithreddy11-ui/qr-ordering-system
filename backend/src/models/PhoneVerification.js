const mongoose = require("mongoose");

// Tracks the lifecycle of a single phone-verification attempt at checkout:
//   1. sendOtp: a doc is created/updated with a 2Factor sessionId and a
//      short expiry (OTP_TTL_MINUTES) — the OTP itself is never stored
//      here, only the session id 2Factor gave us for that send.
//   2. verifyOtp: on a successful 2Factor match, `verified` flips true, a
//      random `token` is issued, and expiry is extended
//      (VERIFIED_TTL_MINUTES) — that token is what the frontend then
//      sends back at checkout (see middleware/verifyPhoneToken.js) as
//      proof the phone was actually verified.
// One document per phone number — a new sendOtp overwrites any previous
// attempt for that number.
const OTP_TTL_MINUTES = 10;
const VERIFIED_TTL_MINUTES = 30;

const phoneVerificationSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, default: null },
    verified: { type: Boolean, default: false },
    token: { type: String, default: null, index: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

phoneVerificationSchema.statics.OTP_TTL_MINUTES = OTP_TTL_MINUTES;
phoneVerificationSchema.statics.VERIFIED_TTL_MINUTES = VERIFIED_TTL_MINUTES;

phoneVerificationSchema.methods.isExpired = function () {
  return Date.now() > this.expiresAt.getTime();
};

module.exports = mongoose.model("PhoneVerification", phoneVerificationSchema);
