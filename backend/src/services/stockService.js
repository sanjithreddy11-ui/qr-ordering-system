const Ingredient = require("../models/Ingredient");
const RecipeIngredient = require("../models/RecipeIngredient");
const StockMovement = require("../models/StockMovement");
const MenuItem = require("../models/MenuItem");

// ---- Status ----
// Never stored on the Ingredient document itself — always derived so it
// can't drift out of sync with quantity/minimumStock.
function getStatus(ingredient) {
  if (ingredient.quantity <= 0) return "out-of-stock";
  if (ingredient.quantity <= ingredient.minimumStock) return "low-stock";
  return "in-stock";
}

function serializeIngredient(ingredient) {
  return {
    id: ingredient._id,
    restaurantId: ingredient.restaurantId,
    name: ingredient.name,
    category: ingredient.category,
    quantity: ingredient.quantity,
    unit: ingredient.unit,
    costPerUnit: ingredient.costPerUnit,
    minimumStock: ingredient.minimumStock,
    supplierId: ingredient.supplierId,
    notes: ingredient.notes,
    status: getStatus(ingredient),
    value: Math.round(ingredient.quantity * ingredient.costPerUnit * 100) / 100,
    updatedAt: ingredient.updatedAt,
    createdAt: ingredient.createdAt,
  };
}

// Records one row in the StockMovement audit log. Never throws into the
// caller's flow — a logging failure shouldn't block the actual stock
// change that already happened.
async function logMovement({ restaurantId, ingredient, type, quantityChange, note, performedBy }) {
  try {
    await StockMovement.create({
      restaurantId,
      ingredientId: ingredient._id,
      ingredientName: ingredient.name,
      type,
      quantityChange,
      resultingQuantity: ingredient.quantity,
      note: note || "",
      performedBy: performedBy || "",
    });
  } catch (err) {
    console.error("Stock movement log failed (stock change was still applied):", err);
  }
}

// Re-checks every menu item that uses this ingredient in its recipe and
// flips MenuItem.isAvailable off if any required ingredient is now short,
// or back on if every ingredient the recipe needs is sufficient again
// (e.g. after a restock). Only touches items that actually have a recipe
// mapped — items with no recipe are left exactly as staff set them.
async function recomputeAvailabilityForIngredient(restaurantId, ingredientId) {
  try {
    const recipes = await RecipeIngredient.find({
      restaurantId,
      "ingredients.ingredientId": ingredientId,
    });

    for (const recipe of recipes) {
      await recomputeAvailabilityForRecipe(restaurantId, recipe);
    }
  } catch (err) {
    console.error("Menu availability recompute failed:", err);
  }
}

async function recomputeAvailabilityForRecipe(restaurantId, recipe) {
  const ingredientIds = recipe.ingredients.map((line) => line.ingredientId);
  const ingredients = await Ingredient.find({ _id: { $in: ingredientIds }, isDeleted: false });
  const byId = new Map(ingredients.map((i) => [String(i._id), i]));

  const canPrepare = recipe.ingredients.every((line) => {
    const ingredient = byId.get(String(line.ingredientId));
    if (!ingredient) return false; // deleted/missing ingredient -> can't prepare
    return ingredient.quantity >= line.quantityPerUnit;
  });

  await MenuItem.findOneAndUpdate(
    { restaurantId, id: recipe.menuItemId },
    { isAvailable: canPrepare },
    { new: true }
  );
}

// Called once per successful order (see orderService.finalizeOrder). For
// every ordered item that has a recipe mapped, deducts
// (quantityPerUnit * orderedQuantity) from each ingredient it uses, logs
// a "deducted" movement, and re-syncs menu-item availability. Wrapped in
// its own try/catch per line so one bad recipe/ingredient never stops the
// rest of the order's deductions from applying.
async function deductStockForOrder(order) {
  const menuItemIds = order.items.map((line) => line.item.id);
  const recipes = await RecipeIngredient.find({
    restaurantId: order.restaurantId,
    menuItemId: { $in: menuItemIds },
  });
  if (recipes.length === 0) return;

  const recipeByMenuItemId = new Map(recipes.map((r) => [r.menuItemId, r]));
  const touchedIngredientIds = new Set();

  for (const orderLine of order.items) {
    const recipe = recipeByMenuItemId.get(orderLine.item.id);
    if (!recipe) continue;

    for (const recipeLine of recipe.ingredients) {
      try {
        const deduction = recipeLine.quantityPerUnit * orderLine.quantity;
        const ingredient = await Ingredient.findOneAndUpdate(
          { _id: recipeLine.ingredientId, isDeleted: false },
          // Clamp at 0 — never go negative even if two orders race.
          [{ $set: { quantity: { $max: [0, { $subtract: ["$quantity", deduction] }] } } }],
          { new: true }
        );
        if (!ingredient) continue;

        await logMovement({
          restaurantId: order.restaurantId,
          ingredient,
          type: "deducted",
          quantityChange: -deduction,
          note: `Order ${order.orderId} — ${orderLine.quantity} × ${orderLine.item.name}`,
        });

        touchedIngredientIds.add(String(ingredient._id));
      } catch (err) {
        console.error("Stock deduction failed for one ingredient (order was still placed):", err);
      }
    }
  }

  for (const ingredientId of touchedIngredientIds) {
    await recomputeAvailabilityForIngredient(order.restaurantId, ingredientId);
  }
}

module.exports = {
  getStatus,
  serializeIngredient,
  logMovement,
  recomputeAvailabilityForIngredient,
  deductStockForOrder,
};
