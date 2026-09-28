const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { resolveActiveVisitByToken } = require("../services/visitSessionService");

// Visit-Based Customer Authentication: verifies the Authorization: Bearer
// <visitToken> issued by POST /api/otp/verify (see
// services/visitSessionService.js:createVisitSession) against the phone
// number on the order body, and attaches the confirmed phone + visit to
// req.verifiedPhone / req.visitSession. Used only on POST /api/orders —
// every other route (kitchen display, session polling, admin) is
// unaffected.
//
// This is the ONE place that decides whether "no OTP" is actually allowed
// for a given order — it never trusts customerPhone/deviceId/customerId
// from the request body alone. A visit that was closed (bill submitted,
// table force-closed, etc. — see services/visitSessionService.js:
// closeActiveVisitSessionsForTable) fails here exactly like an expired/
// missing token would, which is what forces OTP again on the next visit.
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

  const visit = await resolveActiveVisitByToken(token, phone);
  if (!visit) {
    throw new ApiError(401, "Phone verification failed or expired. Please verify your phone number again.");
  }

  req.verifiedPhone = visit.phone;
  req.visitSession = visit;
  next();
});

module.exports = { verifyPhoneToken };
