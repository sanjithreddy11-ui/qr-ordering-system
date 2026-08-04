const mongoose = require("mongoose");

// A first-class category entity, separate from the `categoryId`/
// `categoryTitle` strings denormalized onto each MenuItem (kept as-is for
// backward compatibility with the public menu endpoint). This lets the
// admin manage categories — including empty ones — independently of
// whether any menu item currently references them.
const categorySchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    categoryId: { type: String, required: true }, // e.g. "starters"
    title: { type: String, required: true }, // e.g. "Starters"
    sortOrder: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.index({ restaurantId: 1, categoryId: 1 }, { unique: true });

module.exports = mongoose.model("Category", categorySchema);
