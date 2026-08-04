const mongoose = require("mongoose");

// One row per restock/purchase action, kept even if the ingredient or
// supplier is later renamed/deleted — the name snapshots below are what
// the Purchase History tab displays, independent of current records.
const purchaseHistorySchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", required: true },
    ingredientName: { type: String, required: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: "Supplier", default: null },
    supplierName: { type: String, default: "" },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    cost: { type: Number, required: true, min: 0 },
    purchaseDate: { type: Date, default: Date.now },
    addedBy: { type: String, default: "" }, // staff name/email from req.staff
  },
  { timestamps: true }
);

purchaseHistorySchema.index({ restaurantId: 1, purchaseDate: -1 });

module.exports = mongoose.model("PurchaseHistory", purchaseHistorySchema);
