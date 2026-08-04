const Ingredient = require("../models/Ingredient");
const StockMovement = require("../models/StockMovement");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  serializeIngredient,
  logMovement,
  recomputeAvailabilityForIngredient,
} = require("../services/stockService");

const UNITS = ["g", "kg", "ml", "l", "pcs", "dozen", "packet", "box"];

function staffLabel(req) {
  return req.staff?.email || req.staff?.staffId || "";
}

// GET /api/admin/inventory/:restaurantId?search=&category=&status=&sort=
// status: "in-stock" | "low-stock" | "out-of-stock"
// sort: "newest" | "oldest" | "quantity" | "alphabetical"
const listIngredients = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { search, category, status, sort } = req.query;

  const filter = { restaurantId, isDeleted: false };
  if (search) {
    filter.name = { $regex: String(search).trim(), $options: "i" };
  }
  if (category) {
    filter.category = category;
  }

  let ingredients = await Ingredient.find(filter).lean();

  if (status) {
    ingredients = ingredients.filter((i) => serializeIngredient(i).status === status);
  }

  const sorted = [...ingredients].sort((a, b) => {
    switch (sort) {
      case "oldest":
        return new Date(a.createdAt) - new Date(b.createdAt);
      case "quantity":
        return b.quantity - a.quantity;
      case "alphabetical":
        return a.name.localeCompare(b.name);
      case "newest":
      default:
        return new Date(b.createdAt) - new Date(a.createdAt);
    }
  });

  res.json({ ingredients: sorted.map(serializeIngredient) });
});

// GET /api/admin/inventory/:restaurantId/summary
const getInventorySummary = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const ingredients = await Ingredient.find({ restaurantId, isDeleted: false }).lean();

  let lowStock = 0;
  let outOfStock = 0;
  let value = 0;

  for (const ingredient of ingredients) {
    const status = serializeIngredient(ingredient).status;
    if (status === "low-stock") lowStock += 1;
    if (status === "out-of-stock") outOfStock += 1;
    value += ingredient.quantity * ingredient.costPerUnit;
  }

  res.json({
    totalIngredients: ingredients.length,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    inventoryValue: Math.round(value * 100) / 100,
  });
});

// GET /api/admin/inventory/:restaurantId/alerts
// Powers the Low Stock Alerts side panel — low & out-of-stock items only.
const getStockAlerts = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const ingredients = await Ingredient.find({ restaurantId, isDeleted: false }).sort({ quantity: 1 }).lean();

  const alerts = ingredients
    .map(serializeIngredient)
    .filter((i) => i.status !== "in-stock");

  res.json({ alerts });
});

// GET /api/admin/inventory/:restaurantId/movements?limit=
const getStockMovements = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 100));
  const movements = await StockMovement.find({ restaurantId }).sort({ createdAt: -1 }).limit(limit).lean();
  res.json({ movements });
});

// POST /api/admin/inventory
// Body: { restaurantId, name, category, quantity, unit, costPerUnit, minimumStock, supplierId, notes }
const createIngredient = asyncHandler(async (req, res) => {
  const { restaurantId, name, category, quantity, unit, costPerUnit, minimumStock, supplierId, notes } = req.body;

  if (!restaurantId || !name || !unit || costPerUnit == null || minimumStock == null) {
    throw new ApiError(400, "restaurantId, name, unit, costPerUnit, and minimumStock are required");
  }
  if (!UNITS.includes(unit)) {
    throw new ApiError(400, `unit must be one of: ${UNITS.join(", ")}`);
  }

  const ingredient = await Ingredient.create({
    restaurantId,
    name: name.trim(),
    category: category?.trim() || "General",
    quantity: Number(quantity) || 0,
    unit,
    costPerUnit: Number(costPerUnit),
    minimumStock: Number(minimumStock),
    supplierId: supplierId || null,
    notes: notes?.trim() || "",
  });

  await logMovement({
    restaurantId,
    ingredient,
    type: "added",
    quantityChange: ingredient.quantity,
    note: "Ingredient added",
    performedBy: staffLabel(req),
  });

  res.status(201).json({ ingredient: serializeIngredient(ingredient) });
});

// PATCH /api/admin/inventory/:restaurantId/:ingredientId
const updateIngredient = asyncHandler(async (req, res) => {
  const { restaurantId, ingredientId } = req.params;
  const allowedFields = ["name", "category", "quantity", "unit", "costPerUnit", "minimumStock", "supplierId", "notes"];

  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }
  if (updates.unit && !UNITS.includes(updates.unit)) {
    throw new ApiError(400, `unit must be one of: ${UNITS.join(", ")}`);
  }

  const before = await Ingredient.findOne({ _id: ingredientId, restaurantId, isDeleted: false });
  if (!before) throw new ApiError(404, "Ingredient not found");
  const previousQuantity = before.quantity;

  const ingredient = await Ingredient.findOneAndUpdate(
    { _id: ingredientId, restaurantId, isDeleted: false },
    updates,
    { new: true }
  );

  if ("quantity" in updates) {
    await logMovement({
      restaurantId,
      ingredient,
      type: "updated",
      quantityChange: ingredient.quantity - previousQuantity,
      note: "Quantity edited manually",
      performedBy: staffLabel(req),
    });
    await recomputeAvailabilityForIngredient(restaurantId, ingredient._id);
  }

  res.json({ ingredient: serializeIngredient(ingredient) });
});

// DELETE /api/admin/inventory/:restaurantId/:ingredientId
// Soft delete — see Ingredient.isDeleted.
const deleteIngredient = asyncHandler(async (req, res) => {
  const { restaurantId, ingredientId } = req.params;
  const ingredient = await Ingredient.findOneAndUpdate(
    { _id: ingredientId, restaurantId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!ingredient) throw new ApiError(404, "Ingredient not found");

  await logMovement({
    restaurantId,
    ingredient,
    type: "deleted",
    quantityChange: 0,
    note: "Ingredient deleted",
    performedBy: staffLabel(req),
  });

  res.json({ deleted: true });
});

module.exports = {
  listIngredients,
  getInventorySummary,
  getStockAlerts,
  getStockMovements,
  createIngredient,
  updateIngredient,
  deleteIngredient,
};
