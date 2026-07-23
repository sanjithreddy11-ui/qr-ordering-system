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
  },
  { timestamps: true }
);

menuItemSchema.index({ restaurantId: 1, id: 1 }, { unique: true });

module.exports = mongoose.model("MenuItem", menuItemSchema);
