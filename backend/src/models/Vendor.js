const mongoose = require("mongoose");

// Investment & Expenses Module: vendors that purchases/expenses are billed
// against. Kept separate from Supplier (which backs Stock Management's
// ingredient restocking) because a Vendor here carries GST/statutory
// fields and an outstanding-balance ledger that ingredient suppliers don't
// need — mirrors this codebase's existing pattern of small, single-purpose
// collections (e.g. GstSettings living apart from Restaurant).
const vendorSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    gstNumber: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    address: { type: String, default: "" },
    // Free-form list of categories this vendor supplies (Raw Materials,
    // Kitchen Equipment, etc.) — shown on the vendor card and usable as a
    // filter/autocomplete when logging a new purchase or expense.
    categories: { type: [String], default: [] },
    notes: { type: String, default: "" },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

vendorSchema.index({ restaurantId: 1, name: 1 });

module.exports = mongoose.model("Vendor", vendorSchema);
