const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveVerifiedPhone } = require("../services/otpService");

// Verifies the phone-verification token issued by POST /api/otp/verify
// (Authorization: Bearer <token>) against the phone number on the order
// body, and attaches the confirmed phone to req.verifiedPhone. Used only
// on POST /api/orders — every other route (kitchen display, session
// polling, admin) is unaffected.
const verifyPhoneToken = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    throw new ApiError(401, "Missing phone verification token. Please verify your phone number.");
  }

  const phone = String(req.body?.customerPhone || "").trim();
  if (!phone) {
    throw new ApiError(400, "Phone number is required");
  }

  const verifiedPhone = await resolveVerifiedPhone(phone, token);
  if (!verifiedPhone) {
    throw new ApiError(401, "Phone verification failed or expired. Please verify your phone number again.");
  }

  req.verifiedPhone = verifiedPhone;
  next();
});

module.exports = { verifyPhoneToken };
