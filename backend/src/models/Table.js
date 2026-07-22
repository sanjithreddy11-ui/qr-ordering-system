const mongoose = require("mongoose");

// Every table always has exactly one of these statuses. Lifecycle:
//   available -> reserved (optional) -> occupied -> billing -> cleaning -> available
// "billing" is only ever set by an explicit admin action (the customer
// asked for the bill) — never derived automatically from payment state.
const TABLE_STATUSES = [
  "available",
  "reserved",
  "occupied",
  "billing",
  "cleaning",
  "out_of_service",
];

// Each QR code on a physical table encodes a unique `token`.
// This lets you print/regenerate QR codes without exposing sequential
// table numbers, and lets the backend resolve token -> real table.
const tableSchema = new mongoose.Schema(
  {
    token: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    label: { type: String, required: true }, // e.g. "Table 4"
    isActive: { type: Boolean, default: true },

    // --- Table Management additions ---
    capacity: { type: Number, default: 4 },
    status: { type: String, enum: TABLE_STATUSES, default: "available", index: true },
    // Denormalized pointers to the currently-active TableSession /
    // Reservation for this table, if any. Kept in sync by the
    // tableSession/reservation controllers rather than looked up via a
    // reverse query on every table-grid render.
    currentSessionId: { type: String, default: null },
    currentReservationId: { type: String, default: null },
    occupiedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

tableSchema.statics.STATUSES = TABLE_STATUSES;

module.exports = mongoose.model("Table", tableSchema);
