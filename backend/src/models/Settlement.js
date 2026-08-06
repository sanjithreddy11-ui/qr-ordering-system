const mongoose = require("mongoose");

// A Settlement is the *payment-collection* half of a table's bill, kept
// deliberately separate from TableSession (the *dining* record) and Order
// (the *food* record) per the Settlements Module spec: billing (Submit
// Bill) and payment collection (Collect Payment) are now two distinct
// steps instead of one combined "Close Session" action.
//
// Created once per session by services/settlementService.js:submitBillForTable
// (Tables billing popup -> "Submit Bill", or POST /api/admin/settlements
// directly) with paymentStatus "pending". Finalized by
// settlementController.collectSettlement (Settlements page -> "Collect
// Payment"), which is also the point the dining session actually closes
// and the table is freed — never before.
const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "credit"];
const PAYMENT_STATUSES = ["pending", "paid", "credit", "cancelled"];
// Payment Collection Tracking: how much of the bill has actually been
// collected, independent of `paymentStatus` above. `paymentStatus` tracks
// *workflow* state (has this settlement been submitted/collected/voided?)
// and is left exactly as-is so Settlement History, Credit Customers, and
// every existing report keep working unchanged. `collectionStatus` tracks
// the *money* — it can be PARTIALLY_PAID or even UNPAID on a settlement
// whose paymentStatus is already "paid", because completing a settlement
// no longer requires totalReceived to equal grandTotal.
const COLLECTION_STATUSES = ["UNPAID", "PARTIALLY_PAID", "PAID"];

const settlementSchema = new mongoose.Schema(
  {
    settlementId: { type: String, required: true, unique: true, index: true },
    // Same value as TableSession.billNumber for this session — kept here
    // too so the Settlements table/search never has to join back to
    // TableSession just to show/search the Bill Number.
    billNumber: { type: String, required: true, index: true },
    restaurantId: { type: String, required: true, index: true },

    // A dining session can span multiple Orders (multiple rounds); this
    // keeps every order that was rolled into this bill.
    orderIds: { type: [String], default: [] },
    sessionId: { type: String, required: true, index: true },
    tableId: { type: mongoose.Schema.Types.ObjectId, ref: "Table", required: true, index: true },
    // Denormalized so the Settlements table/search can render/search table
    // number without a lookup — mirrors the Order model's tableLabel.
    tableLabel: { type: String, default: "" },

    // Populated once payment is collected and a matching Customer record is
    // found by phone (see collectSettlement) — best-effort, not required.
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "Customer", default: null },
    customerName: { type: String, default: "" },
    phoneNumber: { type: String, default: "", index: true },

    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    // GST Management Module: same breakdown as Order.js, frozen onto the
    // settlement at Submit Bill time so the Settlements page, GST
    // Dashboard and GST Reports can all read GST figures straight off
    // Settlement without re-deriving them from the underlying orders
    // every time. `tax` above already equals cgstAmount+sgstAmount+igstAmount.
    taxableAmount: { type: Number, default: 0 },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    igstAmount: { type: Number, default: 0 },
    // Offers & Discounts Module: rupee amount deducted from this bill, and
    // the offer's name at the time it was applied — frozen from
    // TableSession.appliedOffer when the bill was submitted (see
    // services/settlementService.js). 0/null when no offer was used.
    // `tax`/`grandTotal` above already reflect this discount, so every
    // Settlements-page total and Settlement-based revenue report picks it
    // up automatically with no extra aggregation changes needed.
    discount: { type: Number, default: 0 },
    offerName: { type: String, default: null },
    // Discount Tracking: the offer catalog doc's id at the time it was
    // applied, frozen alongside offerName from TableSession.appliedOffer.
    // Lets Offer Performance analytics group by a stable id (an offer can be
    // renamed/deleted later without merging into a different bucket) while
    // offerName above remains what's actually shown on the printed bill.
    // Null whenever no offer was used, same as offerName.
    offerId: { type: mongoose.Schema.Types.ObjectId, ref: "Offer", default: null },
    grandTotal: { type: Number, required: true },

    // Payment Collection Tracking: recalculated every time Collect Payment
    // runs (see settlementController.js:collectSettlement). The admin can
    // always complete a settlement regardless of how much has been
    // collected — these three fields record the outcome instead of a
    // pass/fail gate. totalReceived only counts genuinely-collected methods
    // (cash/upi/card/bank_transfer) — a Credit line item is deliberately
    // excluded since that money hasn't actually been received yet (it's
    // tracked separately via outstandingAmount below). remainingAmount is
    // grandTotal - totalReceived, and can go negative on an overpayment.
    totalReceived: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    collectionStatus: { type: String, enum: COLLECTION_STATUSES, default: "UNPAID", index: true },

    // Split Payments: the source of truth for how this bill was actually
    // paid. Populated by Collect Payment (settlementController.collectSettlement)
    // with one entry per enabled payment method in the Payment Breakdown UI —
    // e.g. [{ method: "cash", amount: 200 }, { method: "upi", amount: 344 }].
    // The sum of `amount` across entries no longer has to equal `grandTotal`
    // — see totalReceived/remainingAmount/collectionStatus above for how the
    // shortfall/overage is recorded instead. Empty until collected.
    paymentMethods: {
      type: [
        {
          method: { type: String, enum: PAYMENT_METHODS, required: true },
          amount: { type: Number, required: true, min: 0 },
          _id: false,
        },
      ],
      default: [],
    },
    // Legacy single-method convenience field, kept for backward
    // compatibility with any older readers. Null until Collect Payment
    // completes; set to that one method when the settlement was paid via a
    // single method, and left null for genuine split payments (2+ methods)
    // since a single enum value can no longer represent the full picture —
    // always read `paymentMethods` for the authoritative breakdown.
    paymentMethod: { type: String, enum: [...PAYMENT_METHODS, null], default: null, index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "pending", index: true },
    // Staff member who physically collected/confirmed the payment.
    receivedBy: { type: String, default: null },
    remarks: { type: String, default: "" },

    // Set once Collect Payment completes (for every method, including
    // Credit — the settlement record itself is finalized even though the
    // money hasn't been received yet for Credit).
    settlementTime: { type: Date, default: null },

    // --- Credit (Pay Later) only ---
    dueDate: { type: Date, default: null },
    // Equal to grandTotal while a Credit settlement is unpaid; zeroed out
    // once the outstanding balance is cleared (see clearCreditBalance).
    outstandingAmount: { type: Number, default: 0 },

    submittedAt: { type: Date, default: Date.now },
    submittedBy: { type: String, default: null },
  },
  { timestamps: true }
);

settlementSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
settlementSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
settlementSchema.statics.COLLECTION_STATUSES = COLLECTION_STATUSES;

// Performance: same reasoning as Order's compound indexes — these match
// the actual filter+sort shapes used by getSettlementAnalytics (7 parallel
// aggregations, every one of them restaurantId + a date-range match) and
// listSettlements (restaurantId + status filters, sorted by submittedAt).
settlementSchema.index({ restaurantId: 1, submittedAt: -1 });
settlementSchema.index({ restaurantId: 1, settlementTime: -1 });
settlementSchema.index({ restaurantId: 1, paymentStatus: 1 });
settlementSchema.index({ restaurantId: 1, outstandingAmount: 1 });
// Discount Tracking: powers getSettlementAnalytics' Offer Performance
// aggregation (restaurantId + submittedAt range, grouped by offerId).
settlementSchema.index({ restaurantId: 1, offerId: 1, submittedAt: -1 });

module.exports = mongoose.model("Settlement", settlementSchema);
