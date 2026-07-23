const jwt = require("jsonwebtoken");
const ApiError = require("../utils/ApiError");

const JWT_SECRET = process.env.JWT_SECRET;

// Verifies the Bearer token issued by POST /api/auth/login and attaches
// the decoded staff payload to req.staff. Used to gate every /api/admin/*
// route below.
function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return next(new ApiError(401, "Missing or invalid Authorization header"));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.staff = payload; // { staffId, restaurantId, role, email }
    next();
  } catch (err) {
    next(new ApiError(401, "Invalid or expired token"));
  }
}

module.exports = { requireAuth, JWT_SECRET };
