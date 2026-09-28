const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const Table = require("../models/Table");
const Customer = require("../models/Customer");
const { getActiveVisitByDevice } = require("../services/visitSessionService");

// GET /api/visit/status?tableToken=...&deviceId=...
//
// Visit-Based Customer Authentication: called by the frontend BEFORE it
// ever shows the phone/OTP form, so that "same customer + same device +
// same active Maxibrew visit" genuinely means no OTP screen at all, not
// just an auto-filled one. Resolves restaurantId from the table (never
// trusted from the client) and looks up whether this device currently has
// an active visit for that restaurant.
//
// A closed (e.g. bill already submitted) or nonexistent visit always
// reports { active: false } — a previously-closed session is never reused,
// per the required behavior.
const getVisitStatus = asyncHandler(async (req, res) => {
  const { tableToken, deviceId } = req.query;

  if (!tableToken) {
    throw new ApiError(400, "tableToken is required");
  }
  if (!deviceId) {
    return res.json({ active: false });
  }

  const table = await Table.findOne({ token: tableToken });
  if (!table) {
    throw new ApiError(404, "Invalid table. Please scan the QR code again.");
  }

  const visit = await getActiveVisitByDevice(table.restaurantId, String(deviceId));
  if (!visit) {
    return res.json({ active: false });
  }

  const customer = await Customer.findById(visit.customerId).lean();

  res.json({
    active: true,
    visitToken: visit.token,
    phone: visit.phone,
    name: customer?.name || "",
  });
});

module.exports = { getVisitStatus };
