const mongoose = require("mongoose");

const supplierSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

supplierSchema.index({ restaurantId: 1, name: 1 });

module.exports = mongoose.model("Supplier", supplierSchema);
