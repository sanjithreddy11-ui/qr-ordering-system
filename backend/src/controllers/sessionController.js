const Session = require("../models/Session");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateSessionId = require("../utils/generateSessionId");

// POST /api/sessions
// Body: { restaurantId, tableToken }
// Called once when the customer lands on the cafe's page (from the QR scan).
// Always creates a fresh session — the frontend is responsible for reusing
// an existing non-expired sessionId from local storage instead of calling
// this again, but the backend is the source of truth for expiry either way.
const createSession = asyncHandler(async (req, res) => {
  const { restaurantId, tableToken } = req.body;

  if (!restaurantId || !tableToken) {
    throw new ApiError(400, "restaurantId and tableToken are required");
  }

  const expiresAt = new Date(Date.now() + Session.TTL_HOURS * 60 * 60 * 1000);

  const session = await Session.create({
    sessionId: generateSessionId(),
    restaurantId,
    tableToken,
    expiresAt,
  });

  res.status(201).json({
    sessionId: session.sessionId,
    restaurantId: session.restaurantId,
    tableToken: session.tableToken,
    expiresAt: session.expiresAt,
  });
});

// GET /api/sessions/:sessionId
// Frontend calls this on menu/tab load to confirm the locally-stored
// session is still valid server-side before trusting it.
const getSessionStatus = asyncHandler(async (req, res) => {
  const session = await Session.findOne({ sessionId: req.params.sessionId });

  if (!session) {
    return res.json({ valid: false, reason: "not_found" });
  }

  if (session.isExpired()) {
    return res.json({ valid: false, reason: "expired", expiresAt: session.expiresAt });
  }

  res.json({
    valid: true,
    restaurantId: session.restaurantId,
    tableToken: session.tableToken,
    expiresAt: session.expiresAt,
  });
});

module.exports = { createSession, getSessionStatus };
