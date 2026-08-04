const mongoose = require("mongoose");

// Investment & Expenses Module: the built-in category list ships as a
// constant (see services/investmentService.js DEFAULT_EXPENSE_CATEGORIES)
// so it works with zero setup. This collection only stores CUSTOM
// categories a restaurant adds on top of that default list.
const expenseCategorySchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

expenseCategorySchema.index({ restaurantId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("ExpenseCategory", expenseCategorySchema);
