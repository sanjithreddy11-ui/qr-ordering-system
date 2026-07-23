const mongoose = require("mongoose");

// A snapshot of the menu item at the time it was ordered, so historical
// orders don't change if you later edit prices/names in the menu.
const orderItemSchema = new mongoose.Schema(
  {
    item: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String, default: "" },
      price: { type: Number, required: true },
      diet: { type: String, enum: ["veg", "non-veg"], required: true },
      image: { type: String, default: "" },
    },
    quantity: { type: Number, required: true, min: 1 },
  },
  { _id: false }
);

const ORDER_STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"];

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableToken: { type: String, required: true },
    tableLabel: { type: String, default: null }, // resolved friendly name e.g. "Table 4"

    // Collected once at checkout. Optional so guest checkout keeps working;
    // used to power Customer analytics (see models/Customer.js) once an
    // order reaches "completed".
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "", index: true },

    items: { type: [orderItemSchema], required: true },

    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },

    orderType: { type: String, enum: ["dine-in", "takeaway"], required: true },
    specialInstructions: { type: String, default: "" },
    paymentMethod: { type: String, enum: ["upi", "cash", "card"], required: true },

    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    // Timeline shown on the admin Orders page — one entry per status the
    // order has passed through, in order.
    statusHistory: {
      type: [
        {
          status: { type: String, enum: ORDER_STATUSES, required: true },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: () => [{ status: "pending", changedAt: new Date() }],
    },

    placedAt: { type: Date, default: Date.now },
    estimatedMinutes: { type: Number, default: 20 },
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = ORDER_STATUSES;

module.exports = mongoose.model("Order", orderSchema);
