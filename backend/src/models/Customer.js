const mongoose = require("mongoose");

// One document per (restaurantId, phone). Populated/updated automatically
// whenever a customer's order is marked "completed" — see
// orderController.updateOrderStatus. Not written to on order creation,
// since we only want to count orders that were actually fulfilled.
const customerSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    lastVisit: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

customerSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });

module.exports = mongoose.model("Customer", customerSchema);
