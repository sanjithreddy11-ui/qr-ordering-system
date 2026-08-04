const mongoose = require("mongoose");

// Investment & Expenses Module: one row per purchase invoice line. Every
// purchase doubles as an Input GST record (see gstAmount/cgst/sgst/igst
// below) — rather than mirroring those fields into a separate "GST
// Entries" collection that could drift out of sync, GST Reports (see
// investmentReportController.getGstReport) are derived straight from
// Purchase, the same way Ingredient.status is derived rather than stored
// (see stockService.getStatus).
const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "cheque", "pending"];
const PAYMENT_STATUSES = ["paid", "pending", "partially_paid"];
const GST_TYPES = ["intra_state", "inter_state"]; // intra -> CGST+SGST, inter -> IGST
const STATUSES = ["draft", "confirmed", "cancelled"];

const purchaseSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    branch: { type: String, default: "" },

    purchaseDate: { type: Date, required: true, default: Date.now },
    invoiceNumber: { type: String, default: "" },
    invoiceDate: { type: Date, default: null },

    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName: { type: String, default: "" }, // snapshot, survives vendor rename/delete
    vendorGstNumber: { type: String, default: "" },

    category: { type: String, required: true },
    productName: { type: String, required: true },
    quantity: { type: Number, required: true, min: 0 },
    unit: { type: String, default: "pcs" },
    rate: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 }, // flat amount, not %

    gstPercentage: { type: Number, default: 0, min: 0, max: 100 },
    gstType: { type: String, enum: GST_TYPES, default: "intra_state" },
    cgst: { type: Number, default: 0 },
    sgst: { type: Number, default: 0 },
    igst: { type: Number, default: 0 },

    subtotal: { type: Number, required: true, min: 0 },
    gstAmount: { type: Number, required: true, min: 0 },
    grandTotal: { type: Number, required: true, min: 0 },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "paid" },
    status: { type: String, enum: STATUSES, default: "confirmed" },

    notes: { type: String, default: "" },
    invoiceUrl: { type: String, default: "" },

    // Stock Management Integration: set when this purchase's category/
    // product matched an existing Ingredient and its quantity was bumped
    // automatically (see investmentService.syncStockForPurchase). Left
    // null when there was no matching ingredient, so no duplicate manual
    // stock entry is ever needed.
    stockIngredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", default: null },

    addedBy: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

purchaseSchema.index({ restaurantId: 1, purchaseDate: -1 });
purchaseSchema.index({ restaurantId: 1, category: 1 });
purchaseSchema.index({ restaurantId: 1, vendorId: 1 });

purchaseSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
purchaseSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;
purchaseSchema.statics.GST_TYPES = GST_TYPES;
purchaseSchema.statics.STATUSES = STATUSES;

module.exports = mongoose.model("Purchase", purchaseSchema);
