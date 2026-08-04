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

// Gates Owner/Admin-only sections (e.g. Investment & Expenses) beyond the
// plain "is logged in" check requireAuth already does. Must run after
// requireAuth so req.staff is populated. Staff.role is one of
// "admin" | "kitchen" | "waiter" — there is no separate "owner" role in
// this codebase today, so "admin" is treated as the owner/admin tier.
function requireAdminRole(req, res, next) {
  if (!req.staff || req.staff.role !== "admin") {
    return next(new ApiError(403, "This section is restricted to restaurant admins"));
  }
  next();
}

module.exports = { requireAuth, requireAdminRole, JWT_SECRET };
