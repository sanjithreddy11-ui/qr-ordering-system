const mongoose = require("mongoose");

// Investment & Expenses Module: long-term business assets (equipment,
// furniture, POS devices, etc.). currentValue is a manually-editable
// field rather than an auto-depreciation calculation — restaurants can
// set their own depreciation policy; this just stores the latest figure.
const assetSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    branch: { type: String, default: "" },

    name: { type: String, required: true },
    category: { type: String, default: "Equipment" },
    purchaseDate: { type: Date, required: true, default: Date.now },
    purchaseCost: { type: Number, required: true, min: 0 },

    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName: { type: String, default: "" }, // "Supplier" in the spec

    warranty: { type: String, default: "" }, // free text, e.g. "2 years"
    expectedLifeYears: { type: Number, default: 0, min: 0 },
    currentValue: { type: Number, default: 0, min: 0 },

    invoiceUrl: { type: String, default: "" },
    notes: { type: String, default: "" },

    addedBy: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

assetSchema.index({ restaurantId: 1, purchaseDate: -1 });

module.exports = mongoose.model("Asset", assetSchema);
