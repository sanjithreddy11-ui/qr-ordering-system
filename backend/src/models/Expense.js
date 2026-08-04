const mongoose = require("mongoose");

const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "cheque", "pending"];
const PAYMENT_STATUSES = ["paid", "pending", "partially_paid"];

// Investment & Expenses Module: general business expenses (rent,
// utilities, salaries, marketing, etc.) that aren't a line-item purchase
// invoice. A recurring expense's due-date generation creates one Expense
// row per occurrence (see recurringExpenseService.generateDueOccurrences),
// linked back via recurringExpenseId.
const expenseSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    branch: { type: String, default: "" },

    date: { type: Date, required: true, default: Date.now },
    category: { type: String, required: true },
    description: { type: String, default: "" },
    amount: { type: Number, required: true, min: 0 },

    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName: { type: String, default: "" },

    paymentMethod: { type: String, enum: PAYMENT_METHODS, default: "cash" },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: "paid" },

    invoiceUrl: { type: String, default: "" },
    notes: { type: String, default: "" },

    recurringExpenseId: { type: mongoose.Schema.Types.ObjectId, ref: "RecurringExpense", default: null },

    addedBy: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseSchema.index({ restaurantId: 1, date: -1 });
expenseSchema.index({ restaurantId: 1, category: 1 });

expenseSchema.statics.PAYMENT_METHODS = PAYMENT_METHODS;
expenseSchema.statics.PAYMENT_STATUSES = PAYMENT_STATUSES;

module.exports = mongoose.model("Expense", expenseSchema);
