const MenuItem = require("../models/MenuItem");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/menu/:restaurantId
// Returns menu grouped by category, matching the shape your frontend
// `menu-data.ts` mock already uses: [{ id, title, items: [...] }]
const getMenu = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;

  const items = await MenuItem.find({ restaurantId, isAvailable: true }).sort({
    categoryId: 1,
    sortOrder: 1,
  });

  const categoryMap = new Map();

  for (const item of items) {
    if (!categoryMap.has(item.categoryId)) {
      categoryMap.set(item.categoryId, {
        id: item.categoryId,
        title: item.categoryTitle,
        items: [],
      });
    }
    categoryMap.get(item.categoryId).items.push({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      diet: item.diet,
      image: item.image,
    });
  }

  res.json({ menu: Array.from(categoryMap.values()) });
});

module.exports = { getMenu };
