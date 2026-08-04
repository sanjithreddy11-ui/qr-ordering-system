const Ingredient = require("../models/Ingredient");
const PurchaseHistory = require("../models/PurchaseHistory");
const Supplier = require("../models/Supplier");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { serializeIngredient, logMovement, recomputeAvailabilityForIngredient } = require("../services/stockService");

function staffLabel(req) {
  return req.staff?.email || req.staff?.staffId || "";
}

// POST /api/admin/inventory/purchase
// Body: { restaurantId, ingredientId, quantity, cost, supplierId }
// Increases the ingredient's stock, records a PurchaseHistory row, logs a
// StockMovement, and re-checks any menu items this restock might have just
// made preparable again.
const createPurchase = asyncHandler(async (req, res) => {
  const { restaurantId, ingredientId, quantity, cost, supplierId } = req.body;

  if (!restaurantId || !ingredientId || quantity == null || cost == null) {
    throw new ApiError(400, "restaurantId, ingredientId, quantity, and cost are required");
  }
  if (Number(quantity) <= 0) {
    throw new ApiError(400, "quantity must be greater than 0");
  }

  const ingredient = await Ingredient.findOne({ _id: ingredientId, restaurantId, isDeleted: false });
  if (!ingredient) throw new ApiError(404, "Ingredient not found");

  let supplier = null;
  if (supplierId) {
    supplier = await Supplier.findOne({ _id: supplierId, restaurantId, isDeleted: false });
  }

  ingredient.quantity += Number(quantity);
  // A purchase can also be used to update the going rate for this
  // ingredient, so future inventory-value calculations stay accurate.
  if (cost != null) {
    ingredient.costPerUnit = Number(cost) / Number(quantity) || ingredient.costPerUnit;
  }
  await ingredient.save();

  const purchase = await PurchaseHistory.create({
    restaurantId,
    ingredientId: ingredient._id,
    ingredientName: ingredient.name,
    supplierId: supplier?._id || null,
    supplierName: supplier?.name || "",
    quantity: Number(quantity),
    unit: ingredient.unit,
    cost: Number(cost),
    purchaseDate: new Date(),
    addedBy: staffLabel(req),
  });

  await logMovement({
    restaurantId,
    ingredient,
    type: "purchased",
    quantityChange: Number(quantity),
    note: supplier ? `Purchased from ${supplier.name}` : "Purchased",
    performedBy: staffLabel(req),
  });

  await recomputeAvailabilityForIngredient(restaurantId, ingredient._id);

  res.status(201).json({ ingredient: serializeIngredient(ingredient), purchase });
});

// GET /api/admin/inventory/:restaurantId/purchases?limit=
const listPurchaseHistory = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const limit = Math.min(500, Math.max(1, Number(req.query.limit) || 200));
  const purchases = await PurchaseHistory.find({ restaurantId }).sort({ purchaseDate: -1 }).limit(limit);
  res.json({ purchases });
});

module.exports = { createPurchase, listPurchaseHistory };
