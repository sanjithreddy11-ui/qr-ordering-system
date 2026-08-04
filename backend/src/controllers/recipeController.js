const RecipeIngredient = require("../models/RecipeIngredient");
const Ingredient = require("../models/Ingredient");
const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { recomputeAvailabilityForIngredient } = require("../services/stockService");

// GET /api/admin/recipes/:restaurantId
// All recipe mappings for this restaurant, used by the Recipes tab.
const listRecipes = asyncHandler(async (req, res) => {
  const recipes = await RecipeIngredient.find({ restaurantId: req.params.restaurantId }).sort({ menuItemName: 1 });
  res.json({ recipes });
});

// GET /api/admin/recipes/:restaurantId/:menuItemId
const getRecipe = asyncHandler(async (req, res) => {
  const { restaurantId, menuItemId } = req.params;
  const recipe = await RecipeIngredient.findOne({ restaurantId, menuItemId });
  res.json({ recipe: recipe || null });
});

// PUT /api/admin/recipes/:restaurantId/:menuItemId
// Body: { ingredients: [{ ingredientId, quantityPerUnit }] }
// Upserts the full ingredient list for one menu item, then immediately
// re-checks whether that item can currently be prepared.
const upsertRecipe = asyncHandler(async (req, res) => {
  const { restaurantId, menuItemId } = req.params;
  const { ingredients } = req.body;

  if (!Array.isArray(ingredients)) {
    throw new ApiError(400, "ingredients must be an array");
  }

  const menuItem = await MenuItem.findOne({ restaurantId, id: menuItemId });
  if (!menuItem) throw new ApiError(404, "Menu item not found");

  const ingredientIds = ingredients.map((line) => line.ingredientId);
  const ingredientDocs = await Ingredient.find({ _id: { $in: ingredientIds }, restaurantId, isDeleted: false });
  const byId = new Map(ingredientDocs.map((i) => [String(i._id), i]));

  const lines = [];
  for (const line of ingredients) {
    const ingredient = byId.get(String(line.ingredientId));
    if (!ingredient) continue; // silently skip unknown/deleted ingredients
    const quantityPerUnit = Number(line.quantityPerUnit);
    if (!quantityPerUnit || quantityPerUnit <= 0) continue;

    lines.push({
      ingredientId: ingredient._id,
      ingredientName: ingredient.name,
      quantityPerUnit,
      unit: ingredient.unit,
    });
  }

  const recipe = await RecipeIngredient.findOneAndUpdate(
    { restaurantId, menuItemId },
    { restaurantId, menuItemId, menuItemName: menuItem.name, ingredients: lines },
    { new: true, upsert: true }
  );

  for (const line of lines) {
    await recomputeAvailabilityForIngredient(restaurantId, line.ingredientId);
  }

  res.json({ recipe });
});

// DELETE /api/admin/recipes/:restaurantId/:menuItemId
const deleteRecipe = asyncHandler(async (req, res) => {
  const { restaurantId, menuItemId } = req.params;
  await RecipeIngredient.findOneAndDelete({ restaurantId, menuItemId });
  res.json({ deleted: true });
});

module.exports = { listRecipes, getRecipe, upsertRecipe, deleteRecipe };
