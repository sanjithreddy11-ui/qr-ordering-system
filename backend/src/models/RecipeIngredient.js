const mongoose = require("mongoose");

// One document per menu item, listing how much of each ingredient a
// single unit of that item consumes. Embedded array (rather than one row
// per ingredient) since a recipe is always read/written as a whole.
const recipeLineSchema = new mongoose.Schema(
  {
    ingredientId: { type: mongoose.Schema.Types.ObjectId, ref: "Ingredient", required: true },
    ingredientName: { type: String, required: true }, // snapshot for display
    quantityPerUnit: { type: Number, required: true, min: 0 }, // e.g. 150 (grams) per 1 burger
    unit: { type: String, required: true },
  },
  { _id: false }
);

const recipeIngredientSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    menuItemId: { type: String, required: true }, // MenuItem.id (slug), not Mongo _id
    menuItemName: { type: String, required: true },
    ingredients: { type: [recipeLineSchema], default: [] },
  },
  { timestamps: true }
);

recipeIngredientSchema.index({ restaurantId: 1, menuItemId: 1 }, { unique: true });

module.exports = mongoose.model("RecipeIngredient", recipeIngredientSchema);
