const mongoose = require("mongoose");

// A TableSession represents one physical dining occupancy of a table —
// created automatically the moment a customer's FIRST order lands, and
// closed by the admin once the table is vacated. This is intentionally a
// separate model from `Session` (models/Session.js), which is a short-lived
// QR *browsing* session used only to attribute an order to a scan and
// expires on its own TTL. A single TableSession can span multiple browsing
// Sessions (e.g. the customer re-scans, or a second guest at the same table
// scans and orders) and multiple orders — only ONE active TableSession may
// exist per table at a time.
const tableSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },
    tableToken: { type: String, required: true },

    // Populated for reservation-originated sessions (Check In) and,
    // best-effort, from the first order's session for walk-ins.
    customerName: { type: String, default: "" },
    phoneNumber: { type: String, default: "" },

    // Link back to the QR reservation this session originated from, if any.
    reservationId: { type: String, default: null },

    orderIds: { type: [String], default: [] },

    sessionStart: { type: Date, default: Date.now },
    sessionEnd: { type: Date, default: null },

    currentBill: { type: Number, default: 0 },

    status: { type: String, enum: ["active", "closed"], default: "active", index: true },
  },
  { timestamps: true }
);

// Enforce only one ACTIVE session per table at the database level.
tableSessionSchema.index(
  { tableId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

module.exports = mongoose.model("TableSession", tableSessionSchema);
