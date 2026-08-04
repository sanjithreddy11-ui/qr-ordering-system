const mongoose = require("mongoose");

// Offers & Discounts Module: a restaurant-scoped catalog of manually
// applicable billing offers (Flat / Percentage). Offers never touch
// MenuItem prices and are never applied automatically — an admin must
// explicitly pick one in the Tables & QR billing popup (see
// controllers/sessionPaymentController.js: applyOffer). Only the
// discount amount that was actually applied gets frozen onto the
// TableSession (session.appliedOffer) and, once billed, onto the
// Settlement — this catalog document can keep changing/be deleted
// afterwards without altering a bill that already used it.
const offerSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true, trim: true },
    discountType: { type: String, enum: ["flat", "percentage"], required: true },
    // Flat: rupee amount off (e.g. 100 -> ₹100 Off). Percentage: 0-100 (e.g. 10 -> 10% Off).
    discountValue: { type: Number, required: true, min: 0 },
    // Optional — 0 means no minimum. Checked against the session's active-order
    // subtotal at apply time.
    minOrderAmount: { type: Number, default: 0, min: 0 },
    isActive: { type: Boolean, default: true, index: true },
  },
  { timestamps: true }
);

offerSchema.index({ restaurantId: 1, createdAt: -1 });

module.exports = mongoose.model("Offer", offerSchema);
