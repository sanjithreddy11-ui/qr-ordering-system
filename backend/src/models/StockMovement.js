const mongoose = require("mongoose");

// Append-only audit log — one row per change to an ingredient's quantity
// (or lifecycle event), shown on the Stock Movement History panel.
const MOVEMENT_TYPES = [
  "added", // ingredient created
  "updated", // manual quantity/field edit
  "purchased", // restock via Purchase Stock
  "deducted", // automatic deduction from a paid/confirmed order
  "deleted", // ingredient soft-deleted
];

const stockMovementSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", required: true },
    ingredientName: { type: String, required: true },
    type: { type: String, enum: MOVEMENT_TYPES, required: true },
    quantityChange: { type: Number, required: true }, // signed: +5, -0.3, etc.
    resultingQuantity: { type: Number, required: true },
    note: { type: String, default: "" },
    performedBy: { type: String, default: "" },
  },
  { timestamps: true }
);

stockMovementSchema.index({ restaurantId: 1, createdAt: -1 });

stockMovementSchema.statics.TYPES = MOVEMENT_TYPES;

module.exports = mongoose.model("StockMovement", stockMovementSchema);
