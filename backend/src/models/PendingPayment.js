const mongoose = require("mongoose");

// Bridges the gap between "Razorpay order created" and "payment verified".
// Holds the fully-validated order payload (see services/orderService) so
// the real Order document is only ever created after the payment
// signature is verified server-side — the frontend is never trusted to
// report its own payment as successful.
//
// Auto-expires an hour after creation if the customer never completes (or
// abandons) the Razorpay checkout popup, so this collection never
// accumulates stale/unpaid entries.
const pendingPaymentSchema = new mongoose.Schema(
  {
    razorpayOrderId: { type: String, required: true, unique: true, index: true },
    orderData: { type: mongoose.Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["created", "paid", "failed"], default: "created" },
  },
  { timestamps: true }
);

pendingPaymentSchema.index({ createdAt: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model("PendingPayment", pendingPaymentSchema);
