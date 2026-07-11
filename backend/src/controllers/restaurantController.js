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
      theme: restaurant.theme,
    },
  });
});

module.exports = { getRestaurant };
