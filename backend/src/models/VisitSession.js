const mongoose = require("mongoose");

// A VisitSession represents ONE authenticated Maxibrew "visit" for a
// customer on a particular device — created the moment OTP verification
// succeeds, and closed the moment the admin successfully submits the bill
// for the table that visit is sitting at (see
// services/settlementService.js:submitBillForTable, and the defensive
// closes alongside it in sessionPaymentController/tableStatusController).
//
// This is intentionally a SEPARATE model from:
//   - PhoneVerification (models/PhoneVerification.js), which only proves
//     "this phone received and entered the correct OTP just now" — it says
//     nothing about whether the customer should be allowed to keep
//     ordering without OTP later.
//   - Session (models/Session.js), the anonymous QR *browsing* session
//     used to attribute an order to a table scan. It has nothing to do
//     with customer identity or OTP at all.
//   - TableSession (models/TableSession.js), the physical dining occupancy
//     of a table. A single TableSession can (and often does) have several
//     different customers/devices ordering under it, each with their own
//     VisitSession — and a TableSession's own lifecycle (closed only once
//     the cashier collects payment) is deliberately independent of when a
//     given customer's OTP-trust ends.
//
// THE RULE THIS MODEL ENFORCES:
//   SAME CUSTOMER + SAME DEVICE + SAME ACTIVE VisitSession  => NO OTP
//   SAME CUSTOMER + SAME DEVICE + NO ACTIVE VisitSession    => OTP REQUIRED
// The device is never permanently trusted — only for as long as its
// VisitSession stays "active" (see closeActiveVisitSessionsForTable in
// services/visitSessionService.js).
const visitSessionSchema = new mongoose.Schema(
  {
    visitSessionId: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },

    // Permanent customer identity this visit belongs to. Kept even after
    // the visit closes — the Customer document itself is never touched by
    // visit lifecycle events (see models/Customer.js).
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", required: true, index: true },
    // Denormalized for fast/cheap lookups (order auth checks) without an
    // extra Customer round-trip on every order placed during the visit.
    phone: { type: String, required: true, index: true },

    // The table this visit's OTP verification originated at. Used to find
    // "every visit currently open at this table" when the admin submits
    // the bill — NOT used to decide whether OTP can be skipped (a customer
    // keeps their visit if they re-open the menu from the same table's QR
    // again; only Submit Bill — or another table-closing event — ends it).
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },
    tableToken: { type: String, default: "" },

    // Secure random identifier for the customer's browser/device — see
    // utils/generateVisitSessionId.js sibling generator and
    // frontend hook useDeviceId. Never trust this (or anything else here)
    // as authorization on its own without also checking `status`/`token`
    // server-side — see resolveActiveVisitByToken in
    // services/visitSessionService.js.
    deviceId: { type: String, required: true, index: true },

    // Opaque bearer token minted when this visit is created and handed to
    // the frontend once — this, not deviceId/customerId/phone from the
    // request body, is what actually authorizes placing an order during
    // the visit (see middleware/verifyPhoneToken.js).
    token: { type: String, required: true, unique: true, index: true },

    status: { type: String, enum: ["active", "closed"], default: "active", index: true },

    startedAt: { type: Date, default: Date.now },
    endedAt: { type: Date, default: null },
    // Why the visit ended — populated only once status flips to "closed".
    endReason: {
      type: String,
      enum: [null, "BILL_SUBMITTED", "SETTLEMENT_COLLECTED", "SETTLEMENT_DELETED", "TABLE_CLOSED", "SUPERSEDED"],
      default: null,
    },
  },
  { timestamps: true }
);

// Core invariant: at most ONE active visit per device at a time. This is
// what makes "same device, new visit -> OTP required" actually enforceable
// server-side rather than just a frontend convention.
visitSessionSchema.index(
  { deviceId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Performance: closing every visit open at a table (Submit Bill) filters
// exactly this shape.
visitSessionSchema.index({ tableId: 1, status: 1 });

module.exports = mongoose.model("VisitSession", visitSessionSchema);
