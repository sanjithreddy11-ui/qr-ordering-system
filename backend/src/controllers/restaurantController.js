const Restaurant = require("../models/Restaurant");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// GET /api/restaurants/:restaurantId
const getRestaurant = asyncHandler(async (req, res) => {
  const restaurant = await Restaurant.findOne({ restaurantId: req.params.restaurantId });
  if (!restaurant) throw new ApiError(404, "Restaurant not found");

  res.json({
    restaurant: {
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      logo: restaurant.logo,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      gstNumber: restaurant.gstNumber,
      theme: restaurant.theme,
    },
  });
});

// PATCH /api/restaurants/:restaurantId
// Body: any subset of { name, logo, description, address, phone, gstNumber, theme }
const updateRestaurant = asyncHandler(async (req, res) => {
  const allowedFields = ["name", "logo", "description", "address", "phone", "gstNumber", "theme"];
  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const restaurant = await Restaurant.findOneAndUpdate(
    { restaurantId: req.params.restaurantId },
    updates,
    { new: true }
  );

  if (!restaurant) throw new ApiError(404, "Restaurant not found");

  res.json({
    restaurant: {
      restaurantId: restaurant.restaurantId,
      name: restaurant.name,
      logo: restaurant.logo,
      description: restaurant.description,
      address: restaurant.address,
      phone: restaurant.phone,
      gstNumber: restaurant.gstNumber,
      theme: restaurant.theme,
    },
  });
});

module.exports = { getRestaurant, updateRestaurant };
