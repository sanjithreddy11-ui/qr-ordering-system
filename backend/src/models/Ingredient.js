const mongoose = require("mongoose");

// Core inventory item. `quantity` is the current stock level, always in
// `unit`. Status (In Stock / Low Stock / Out of Stock) is never stored —
// it's derived from quantity vs minimumStock (see stockService.getStatus)
// so it can never drift out of sync with the numbers that produced it.
const ingredientSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, default: "General" },
    quantity: { type: Number, required: true, default: 0, min: 0 },
    unit: {
      type: String,
      enum: ["g", "kg", "ml", "l", "pcs", "dozen", "packet", "box"],
      required: true,
    },
    costPerUnit: { type: Number, required: true, default: 0, min: 0 },
    minimumStock: { type: Number, required: true, default: 0, min: 0 },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    notes: { type: String, default: "" },
    // Soft delete — deleted ingredients are hidden from every list/summary/
    // alert query but kept around so PurchaseHistory/StockMovement rows
    // that reference them still resolve.
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ingredientSchema.index({ restaurantId: 1, name: 1 });
// Performance: every Stock Management read (list, summary, alerts) filters
// {restaurantId, isDeleted: false} — this was previously uncovered.
ingredientSchema.index({ restaurantId: 1, isDeleted: 1 });

module.exports = mongoose.model("Ingredient", ingredientSchema);
