const crypto = require("crypto");
const Table = require("../models/Table");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/admin/tables/:restaurantId
const listTables = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const tables = await Table.find({ restaurantId }).sort({ label: 1 });
  res.json({ tables });
});

// Generates a short, random, non-sequential token — same shape as the
// existing seeded tokens (10 lowercase hex characters), so new tables
// created from the admin dashboard are indistinguishable from seeded ones.
function generateTableToken() {
  return crypto.randomBytes(5).toString("hex");
}

// POST /api/admin/tables
// Body: { restaurantId, label }
const createTable = asyncHandler(async (req, res) => {
  const { restaurantId, label } = req.body;

  if (!restaurantId || !label) {
    throw new ApiError(400, "restaurantId and label are required");
  }

  const table = await Table.create({
    restaurantId,
    label,
    token: generateTableToken(),
    isActive: true,
  });

  res.status(201).json({ table });
});

// PATCH /api/admin/tables/:tableId
// Body: { label?, isActive? } — tableId here is the Table document's _id.
const updateTable = asyncHandler(async (req, res) => {
  const { label, isActive } = req.body;
  const updates = {};
  if (label !== undefined) updates.label = label;
  if (isActive !== undefined) updates.isActive = isActive;

  const table = await Table.findByIdAndUpdate(req.params.tableId, updates, { new: true });
  if (!table) throw new ApiError(404, "Table not found");

  res.json({ table });
});

// DELETE /api/admin/tables/:tableId
const deleteTable = asyncHandler(async (req, res) => {
  const table = await Table.findByIdAndDelete(req.params.tableId);
  if (!table) throw new ApiError(404, "Table not found");
  res.json({ deleted: true });
});

module.exports = { listTables, createTable, updateTable, deleteTable };
