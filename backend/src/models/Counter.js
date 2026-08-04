const mongoose = require("mongoose");

// A tiny generic counter collection — one document per named sequence.
// Used for the sequential "Bill No" (BILL-000124) shown on the printed
// receipt, which is intentionally a *different* number from the
// date-stamped, randomly-suffixed Invoice No (INV-YYYYMMDD-XXXXX) so the
// two fields are never accidentally the same value.
const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 },
});

module.exports = mongoose.model("Counter", counterSchema);
