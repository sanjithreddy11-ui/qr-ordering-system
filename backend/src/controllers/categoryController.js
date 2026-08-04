const Category = require("../models/Category");
const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/admin/categories/:restaurantId
const listCategories = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const categories = await Category.find({ restaurantId }).sort({ sortOrder: 1 });

  // Item counts are useful in the UI (e.g. to warn before deleting a
  // category that still has items) and cheap to compute alongside.
  const counts = await MenuItem.aggregate([
    { $match: { restaurantId } },
    { $group: { _id: "$categoryId", count: { $sum: 1 } } },
  ]);
  const countByCategoryId = Object.fromEntries(counts.map((c) => [c._id, c.count]));

  res.json({
    categories: categories.map((c) => ({
      id: c._id,
      restaurantId: c.restaurantId,
      categoryId: c.categoryId,
      title: c.title,
      sortOrder: c.sortOrder,
      itemCount: countByCategoryId[c.categoryId] ?? 0,
    })),
  });
});

// POST /api/admin/categories
// Body: { restaurantId, categoryId, title, sortOrder }
const createCategory = asyncHandler(async (req, res) => {
  const { restaurantId, categoryId, title, sortOrder } = req.body;

  if (!restaurantId || !categoryId || !title) {
    throw new ApiError(400, "restaurantId, categoryId, and title are required");
  }

  const existing = await Category.findOne({ restaurantId, categoryId });
  if (existing) {
    throw new ApiError(409, "A category with this id already exists for this restaurant");
  }

  const category = await Category.create({
    restaurantId,
    categoryId,
    title,
    sortOrder: sortOrder ?? 0,
  });

  res.status(201).json({ category });
});

// PATCH /api/admin/categories/:restaurantId/:categoryId
// Body: any subset of { title, sortOrder }
// Renaming a category also updates the denormalized categoryTitle on every
// MenuItem that references it, since the public menu endpoint reads that
// field directly rather than joining against Category.
const updateCategory = asyncHandler(async (req, res) => {
  const { restaurantId, categoryId } = req.params;
  const { title, sortOrder } = req.body;

  const updates = {};
  if (title !== undefined) updates.title = title;
  if (sortOrder !== undefined) updates.sortOrder = sortOrder;

  const category = await Category.findOneAndUpdate(
    { restaurantId, categoryId },
    updates,
    { new: true }
  );
  if (!category) throw new ApiError(404, "Category not found");

  if (title !== undefined) {
    await MenuItem.updateMany(
      { restaurantId, categoryId },
      { categoryTitle: title }
    );
  }
  if (sortOrder !== undefined) {
    await MenuItem.updateMany(
      { restaurantId, categoryId },
      { categorySortOrder: sortOrder }
    );
  }

  res.json({ category });
});

// DELETE /api/admin/categories/:restaurantId/:categoryId
const deleteCategory = asyncHandler(async (req, res) => {
  const { restaurantId, categoryId } = req.params;

  const itemCount = await MenuItem.countDocuments({ restaurantId, categoryId });
  if (itemCount > 0) {
    throw new ApiError(
      409,
      `Cannot delete: ${itemCount} menu item(s) still use this category. Move or delete them first.`
    );
  }

  const category = await Category.findOneAndDelete({ restaurantId, categoryId });
  if (!category) throw new ApiError(404, "Category not found");

  res.json({ deleted: true });
});

module.exports = { listCategories, createCategory, updateCategory, deleteCategory };
