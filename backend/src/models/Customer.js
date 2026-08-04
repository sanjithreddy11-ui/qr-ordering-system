const mongoose = require("mongoose");

// One document per (restaurantId, phone) — phone is the unique customer
// identifier. Created/updated the moment a customer checks out and places
// an order — see services/orderService.js:upsertCustomerFromOrder, called
// from finalizeOrder (both the cash flow and the verified-online-payment
// flow go through finalizeOrder, so every successful checkout counts).
const customerSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    phone: { type: String, required: true },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    averageOrderValue: { type: Number, default: 0 },
    firstVisit: { type: Date, default: Date.now },
    lastVisit: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

customerSchema.index({ restaurantId: 1, phone: 1 }, { unique: true });
// Performance: listTopCustomers filters {restaurantId} and sorts by
// totalSpent descending for the Top Customers widget.
customerSchema.index({ restaurantId: 1, totalSpent: -1 });

module.exports = mongoose.model("Customer", customerSchema);
