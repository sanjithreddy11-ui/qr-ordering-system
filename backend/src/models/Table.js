const mongoose = require("mongoose");

// Each QR code on a physical table encodes a unique `token`.
// This lets you print/regenerate QR codes without exposing sequential
// table numbers, and lets the backend resolve token -> real table.
const tableSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    label: { type: String, required: true }, // e.g. "Table 4"
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Table", tableSchema);
