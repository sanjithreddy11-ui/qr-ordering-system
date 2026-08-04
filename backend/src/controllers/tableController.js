const Table = require("../models/Table");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/tables/:token
// Public (no auth) — called by the customer app to resolve a human-readable
// table label (e.g. "Table 5") from the QR token in the URL, so
// customer-facing UI (like the waiter-call notification) never has to show
// the raw token to staff. Deliberately returns only the label/restaurantId,
// not the full admin Table document.
const getTableByToken = asyncHandler(async (req, res) => {
  const table = await Table.findOne({ token: req.params.token });
  if (!table) throw new ApiError(404, "Table not found");

  res.json({
    token: table.token,
    label: table.label,
    restaurantId: table.restaurantId,
  });
});

module.exports = { getTableByToken };