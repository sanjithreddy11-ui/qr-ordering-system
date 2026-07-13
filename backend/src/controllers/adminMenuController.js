const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/admin/menu/:restaurantId
// Unlike the public GET /api/menu/:restaurantId, this returns EVERY item
// (including unavailable ones) so the admin can toggle them back on.
const listMenuItemsAdmin = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const items = await MenuItem.find({ restaurantId }).sort({
    categorySortOrder: 1,
    sortOrder: 1,
  });
  res.json({ items });
});

// POST /api/admin/menu
// Body: { restaurantId, id, categoryId, categoryTitle, categorySortOrder,
//         name, description, price, diet, image, sortOrder }
const createMenuItem = asyncHandler(async (req, res) => {
  const {
    restaurantId,
    id,
    categoryId,
    categoryTitle,
    categorySortOrder,
    name,
    description,
    price,
    diet,
    image,
    sortOrder,
  } = req.body;

  if (!restaurantId || !id || !categoryId || !categoryTitle || !name || price == null || !diet) {
    throw new ApiError(
      400,
      "restaurantId, id, categoryId, categoryTitle, name, price, and diet are required"
    );
  }
  if (!["veg", "non-veg"].includes(diet)) {
    throw new ApiError(400, "diet must be 'veg' or 'non-veg'");
  }

  const existing = await MenuItem.findOne({ restaurantId, id });
  if (existing) {
    throw new ApiError(409, "A menu item with this id already exists for this restaurant");
  }

  const item = await MenuItem.create({
    restaurantId,
    id,
    categoryId,
    categoryTitle,
    categorySortOrder: categorySortOrder ?? 0,
    name,
    description: description || "",
    price,
    diet,
    image: image || "",
    sortOrder: sortOrder ?? 0,
    isAvailable: true,
  });

  res.status(201).json({ item });
});

// PATCH /api/admin/menu/:restaurantId/:itemId
// Body: any subset of the fields above, e.g. { isAvailable: false } to
// mark an item out of stock, or { price: 349 } to change its price.
const updateMenuItem = asyncHandler(async (req, res) => {
  const { restaurantId, itemId } = req.params;
  const allowedFields = [
    "categoryId",
    "categoryTitle",
    "categorySortOrder",
    "name",
    "description",
    "price",
    "diet",
    "image",
    "sortOrder",
    "isAvailable",
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  if (updates.diet && !["veg", "non-veg"].includes(updates.diet)) {
    throw new ApiError(400, "diet must be 'veg' or 'non-veg'");
  }

  const item = await MenuItem.findOneAndUpdate(
    { restaurantId, id: itemId },
    updates,
    { new: true }
  );

  if (!item) throw new ApiError(404, "Menu item not found");

  res.json({ item });
});

// DELETE /api/admin/menu/:restaurantId/:itemId
const deleteMenuItem = asyncHandler(async (req, res) => {
  const { restaurantId, itemId } = req.params;
  const item = await MenuItem.findOneAndDelete({ restaurantId, id: itemId });
  if (!item) throw new ApiError(404, "Menu item not found");
  res.json({ deleted: true });
});

module.exports = { listMenuItemsAdmin, createMenuItem, updateMenuItem, deleteMenuItem };
