const mongoose = require("mongoose");

// Completely separate from the QR ordering flow — this powers admin-side
// phone bookings and walk-in reservations only.
const RESERVATION_STATUSES = [
  "pending",
  "confirmed",
  "checked_in",
  "completed",
  "cancelled",
  "no_show",
];

const reservationSchema = new mongoose.Schema(
  {
    reservationId: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },

    customerName: { type: String, required: true },
    phoneNumber: { type: String, required: true },
    guestCount: { type: Number, required: true, min: 1 },

    reservationDate: { type: String, required: true }, // "YYYY-MM-DD"
    reservationTime: { type: String, required: true }, // "HH:mm"
    expectedDuration: { type: Number, default: 60 }, // minutes
    specialNotes: { type: String, default: "" },

    status: { type: String, enum: RESERVATION_STATUSES, default: "confirmed", index: true },

    checkedInAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },

    createdBy: { type: String, default: "admin" },
  },
  { timestamps: true }
);

reservationSchema.statics.STATUSES = RESERVATION_STATUSES;

module.exports = mongoose.model("Reservation", reservationSchema);
