const mongoose = require("mongoose");

const FREQUENCIES = ["weekly", "monthly", "yearly"];

// Investment & Expenses Module: a template for a bill that repeats (Rent,
// Electricity, Internet, Software, etc). nextDueDate advances every time
// investmentService.generateDueOccurrences turns an occurrence into a real
// Expense row, so the Overview's "Upcoming Recurring Payments" list can
// just query nextDueDate ascending.
const recurringExpenseSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    category: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
    frequency: { type: String, enum: FREQUENCIES, default: "monthly" },
    vendorId: { type: mongoose.Schema.Types.ObjectId, ref: "Vendor", default: null },
    vendorName: { type: String, default: "" },
    nextDueDate: { type: Date, required: true },
    isActive: { type: Boolean, default: true },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

recurringExpenseSchema.index({ restaurantId: 1, nextDueDate: 1 });
recurringExpenseSchema.statics.FREQUENCIES = FREQUENCIES;

module.exports = mongoose.model("RecurringExpense", recurringExpenseSchema);
