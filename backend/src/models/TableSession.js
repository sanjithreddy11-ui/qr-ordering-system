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

    // --- Payment workflow (set from the Current Dining Session page) ---
    // Chosen by the cashier once the customer is ready to pay. Null until
    // then — collect-payment refuses to run without one.
    paymentMethod: { type: String, enum: ["upi", "cash", "card", null], default: null },
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending", index: true },
    // UPI: the UPI transaction/reference id, entered by the cashier once the
    // customer shows a successful payment. Card: optional (terminal ref).
    transactionId: { type: String, default: null },
    paidAt: { type: Date, default: null },
    // Cash-only gate: the cashier must print the customer's bill BEFORE
    // collecting cash (so the customer can verify the amount). Collect
    // Payment is refused for cash sessions until this is true. Reset to
    // false any time the payment method is changed, so switching methods
    // can't be used to skip this step.
    billPrinted: { type: Boolean, default: false },
    // Generated once (on first Print Bill, or at Collect Payment for
    // upi/card) and kept stable for any re-print of the same session's bill.
    invoiceNumber: { type: String, default: null },
    // Sequential "Bill No" (BILL-000124), intentionally distinct from the
    // date-stamped invoiceNumber above — see utils/generateBillNumber.js.
    billNumber: { type: String, default: null },

    // --- Print history (Billing popup: Print Bill / Reprint Bill) ---
    // printedAt/printedBy reflect the MOST RECENT print only; printCount
    // accumulates across every print + reprint so the popup can show
    // "Reprint Bill" after the first success and staff can see how many
    // times a bill has gone to the printer.
    printedAt: { type: Date, default: null },
    printedBy: { type: String, default: null },
    printCount: { type: Number, default: 0 },

    // --- Settlements Module ---
    // Set true the moment "Submit Bill" is tapped in the Tables billing
    // popup (see services/settlementService.js:submitBillForTable), which
    // locks the bill and creates a Settlement doc (models/Settlement.js).
    // Guards against submitting the same session's bill twice. Billing is
    // now handled entirely by the Settlements page from that point on —
    // this session only gets closed once the cashier completes the
    // settlement there (settlementController.collectSettlement).
    billSubmitted: { type: Boolean, default: false },

    // --- Offers & Discounts Module ---
    // Set only when the admin manually selects an offer in the Tables
    // billing popup (see controllers/sessionPaymentController.js:applyOffer)
    // — offers are never applied automatically. Frozen at apply time (name/
    // discountType/discountValue/discountAmount copied from the Offer
    // catalog doc) so the bill stays correct even if that Offer is later
    // edited or deleted, and so exactly one offer can ever be active on a
    // bill at a time. Cleared by removeOffer, or once the bill is
    // submitted/paid (the discount is instead frozen onto the Settlement).
    appliedOffer: {
      type: new mongoose.Schema(
        {
          offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer" },
          name: { type: String },
          discountType: { type: String, enum: ["flat", "percentage"] },
          discountValue: { type: Number },
          discountAmount: { type: Number },
        },
        { _id: false }
      ),
      default: null,
    },
  },
  { timestamps: true }
);

// Enforce only one ACTIVE session per table at the database level.
tableSessionSchema.index(
  { tableId: 1, status: 1 },
  { unique: true, partialFilterExpression: { status: "active" } }
);

// Performance: listTableSessions filters {restaurantId, status?} and sorts
// by sessionStart — neither field combination was covered by an index
// before, so every "Table Sessions" admin list load scanned + sorted in
// memory.
tableSessionSchema.index({ restaurantId: 1, status: 1, sessionStart: -1 });

module.exports = mongoose.model("TableSession", tableSessionSchema);
