const mongoose = require("mongoose");

// Mirrors frontend `MenuItem` in lib/menu-data.ts:
// { id, name, description, price, diet, image }
const menuItemSchema = new mongoose.Schema(
  {
    // Human-readable slug id used by the frontend (e.g. "chicken-popcorn").
    // Kept separate from Mongo's _id so frontend code doesn't need to change.
    id: { type: String, required: true },
    restaurantId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true }, // e.g. "starters"
    categoryTitle: { type: String, required: true }, // e.g. "Starters"
    // Controls the order categories appear in on the menu (Starters before
    // Mains before Desserts, etc.) — separate from `sortOrder`, which only
    // orders items within a category.
    categorySortOrder: { type: Number, default: 0 },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true },
    diet: { type: String, enum: ["veg", "non-veg"], required: true },
    image: { type: String, default: "" },
    isAvailable: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    prepTimeMinutes: { type: Number, default: 10 },

    // GST Management Module: which GST slab (see GstSettings.slabs, e.g.
    // 5/12/18/28) this item is billed at. Null means "use the
    // restaurant's default GST %" (GstSettings.defaultGstPercentage) —
    // this is the common case, so items don't all need to be touched the
    // day GST Management is turned on. Validated against the current
    // slab list in adminMenuController so it can never drift to an
    // unsupported percentage.
    gstSlab: { type: Number, default: null },
    // HSN/SAC code — not used in any tax calculation yet, but every
    // GST-registered menu/invoice eventually needs one per item, so the
    // field exists now (future-ready, per the GST Management spec) rather
    // than requiring a schema migration later.
    hsnCode: { type: String, default: "" },
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurantId: 1, id: 1 }, { unique: true });

// Performance: getMenu (GET /api/menu/:restaurantId) is the single
// highest-traffic endpoint in this app — every customer scanning a QR
// code hits it. It filters {restaurantId, isAvailable} and sorts by
// {categorySortOrder, sortOrder}; before this index existed, that query
// had nothing but the {restaurantId, id} unique index above to work with,
// meaning it scanned every item for the restaurant and sorted in memory
// on every single page load. This index matches that query exactly.
menuItemSchema.index({ restaurantId: 1, isAvailable: 1, categorySortOrder: 1, sortOrder: 1 });
// Covers category-scoped admin queries (listMenuItemsAdmin's categoryId
// filter, categoryController's per-category item counts).
menuItemSchema.index({ restaurantId: 1, categoryId: 1 });

module.exports = mongoose.model("MenuItem", menuItemSchema);
