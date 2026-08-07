const MenuItem = require("../models/MenuItem");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const gstService = require("../services/gstService");

// Menu Item Customization (Modifiers): shared shape-validation for the
// `modifierGroups` field on create/update, so a malformed group (missing
// id/name, an empty options list, a bad selectionType) is rejected here
// rather than silently saved and only discovered later at order time or
// on the customer menu. Returns `[]` for undefined/omitted input, which is
// exactly what a non-customizable item should store.
function validateModifierGroups(modifierGroups) {
  if (modifierGroups == null) return [];
  if (!Array.isArray(modifierGroups)) {
    throw new ApiError(400, "modifierGroups must be an array");
  }

  const seenGroupIds = new Set();

  return modifierGroups.map((group, gIdx) => {
    if (!group || typeof group !== "object") {
      throw new ApiError(400, `modifierGroups[${gIdx}] must be an object`);
    }
    const { id, name, required, selectionType, options } = group;
    if (!id || typeof id !== "string") {
      throw new ApiError(400, `modifierGroups[${gIdx}].id is required`);
    }
    if (seenGroupIds.has(id)) {
      throw new ApiError(400, `Duplicate modifier group id "${id}"`);
    }
    seenGroupIds.add(id);
    if (!name || typeof name !== "string") {
      throw new ApiError(400, `modifierGroups[${gIdx}].name is required`);
    }
    if (selectionType && !["single", "multiple"].includes(selectionType)) {
      throw new ApiError(400, `modifierGroups[${gIdx}].selectionType must be 'single' or 'multiple'`);
    }
    if (!Array.isArray(options) || options.length === 0) {
      throw new ApiError(400, `modifierGroups[${gIdx}].options must be a non-empty array`);
    }

    const seenOptionIds = new Set();
    const validatedOptions = options.map((opt, oIdx) => {
      if (!opt || typeof opt !== "object" || !opt.id || !opt.name) {
        throw new ApiError(400, `modifierGroups[${gIdx}].options[${oIdx}] must have id and name`);
      }
      if (seenOptionIds.has(opt.id)) {
        throw new ApiError(400, `Duplicate option id "${opt.id}" in group "${id}"`);
      }
      seenOptionIds.add(opt.id);
      return { id: opt.id, name: opt.name, priceDelta: Number(opt.priceDelta) || 0 };
    });

    return {
      id,
      name,
      required: Boolean(required),
      selectionType: selectionType || "single",
      options: validatedOptions,
    };
  });
}

// GET /api/admin/menu/:restaurantId?search=&categoryId=&diet=&availability=&page=&limit=
// Unlike the public GET /api/menu/:restaurantId, this returns EVERY item
// (including unavailable ones) so the admin can toggle them back on.
// All query params are optional; omitting them returns every item,
// unpaginated, exactly like before.
const listMenuItemsAdmin = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { search, categoryId, diet, availability, page, limit } = req.query;

  const filter = { restaurantId };

  if (search) {
    filter.name = { $regex: search.trim(), $options: "i" };
  }
  if (categoryId) {
    filter.categoryId = categoryId;
  }
  if (diet && ["veg", "non-veg"].includes(diet)) {
    filter.diet = diet;
  }
  if (availability === "available") {
    filter.isAvailable = true;
  } else if (availability === "out-of-stock") {
    filter.isAvailable = false;
  }

  const pageNum = Math.max(1, Number(page) || 1);
  // No `limit` param at all => unpaginated (pageSize stays null, query
  // below skips .skip()/.limit() entirely and returns everything). This is
  // what the admin "Create Order" picker (CreateOrderFlow.tsx) relies on —
  // it deliberately omits `limit` since it has no server pagination UI of
  // its own.
  //
  // NOTE: the previous version of this line was
  //   Math.min(1000, Math.max(1, Number(limit) || 0)) || null
  // which looks like it defaults to null when limit is omitted, but
  // Math.max(1, ...) always returns at least 1, so pageSize was ALWAYS a
  // truthy number >= 1 — never actually null. With no `limit` sent, that
  // silently evaluated to pageSize = 1, capping every unpaginated request
  // (like the Create Order picker) to a single item. Only compute a
  // pageSize at all when the caller explicitly passed `limit`.
  const pageSize = limit ? Math.min(1000, Math.max(1, Number(limit) || 0)) : null;

  const query = MenuItem.find(filter).sort({ categorySortOrder: 1, sortOrder: 1 }).lean();

  const total = await MenuItem.countDocuments(filter);

  if (pageSize) {
    query.skip((pageNum - 1) * pageSize).limit(pageSize);
  }

  const items = await query;

  res.json({
    items,
    pagination: pageSize
      ? { page: pageNum, limit: pageSize, total, totalPages: Math.ceil(total / pageSize) }
      : { page: 1, limit: total, total, totalPages: 1 },
  });
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
    prepTimeMinutes,
    gstSlab,
    hsnCode,
    modifierGroups,
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

  // GST Management Module: validated against this restaurant's configured
  // slabs (see GstSettings.slabs) — a blank/omitted value means "use the
  // restaurant's default GST %" rather than a hard failure.
  const validatedGstSlab = await gstService.validateItemGstSlab(restaurantId, gstSlab);

  // Menu Item Customization (Modifiers): validated the same way on both
  // create and update — see validateModifierGroups below.
  const validatedModifierGroups = validateModifierGroups(modifierGroups);

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
    prepTimeMinutes: prepTimeMinutes ?? 10,
    isAvailable: true,
    gstSlab: validatedGstSlab,
    hsnCode: hsnCode || "",
    modifierGroups: validatedModifierGroups,
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
    "prepTimeMinutes",
    "isAvailable",
    "gstSlab",
    "hsnCode",
    "modifierGroups",
  ];

  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  if (updates.diet && !["veg", "non-veg"].includes(updates.diet)) {
    throw new ApiError(400, "diet must be 'veg' or 'non-veg'");
  }

  // GST Management Module: re-validate on every update, same as create —
  // covers both "assign a slab" and "an admin changed GST Settings' slab
  // list out from under an item that used to reference a now-removed one".
  if ("gstSlab" in updates) {
    updates.gstSlab = await gstService.validateItemGstSlab(restaurantId, updates.gstSlab);
  }

  // Menu Item Customization (Modifiers) — see validateModifierGroups above.
  if ("modifierGroups" in updates) {
    updates.modifierGroups = validateModifierGroups(updates.modifierGroups);
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