const mongoose = require("mongoose");

// Menu Item Customization (Modifiers): a single option within a modifier
// group, e.g. "Mushroom Sauce" within the "Sauce" group. `priceDelta`
// exists for future-ready pricing (e.g. an upsell option costing extra)
// but defaults to 0 — every sauce option today is free, it just changes
// which sauce is prepared.
const modifierOptionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // e.g. "mushroom-sauce"
    name: { type: String, required: true }, // e.g. "Mushroom Sauce"
    priceDelta: { type: Number, default: 0 },
  },
  { _id: false }
);

// Menu Item Customization (Modifiers): a reusable group of options attached
// to a menu item, e.g. a required, single-choice "Sauce" group. Generic on
// purpose — nothing here is specific to sauces — so the same shape covers
// any future modifier (spice level, add-ons, size, etc.) without a schema
// change. Lives directly on the MenuItem (rather than a separate
// collection) since groups aren't shared/reused across items in this
// version; each item declares its own.
const modifierGroupSchema = new mongoose.Schema(
  {
    id: { type: String, required: true }, // e.g. "sauce" — stable key referenced by order items
    name: { type: String, required: true }, // e.g. "Sauce" — shown to the customer
    required: { type: Boolean, default: false },
    // "single": customer picks exactly one option (radio buttons).
    // "multiple": customer can pick any number of options (checkboxes).
    selectionType: { type: String, enum: ["single", "multiple"], default: "single" },
    options: { type: [modifierOptionSchema], default: [] },
  },
  { _id: false }
);

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

    // Menu Item Customization (Modifiers): defaults to an empty array, so
    // every existing menu item (created before this feature) is simply
    // "not customizable" — getMenu/adminMenu, order creation, KOT, and
    // billing all treat an item with no modifierGroups exactly as they did
    // before this feature existed. Only items that explicitly declare a
    // `required: true` group force a selection before checkout.
    modifierGroups: { type: [modifierGroupSchema], default: [] },
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
