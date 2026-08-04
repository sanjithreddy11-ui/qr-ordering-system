const express = require("express");
const { getRestaurant, updateRestaurant } = require("../controllers/restaurantController");

const router = express.Router();

router.get("/:restaurantId", getRestaurant);
router.patch("/:restaurantId", updateRestaurant);

module.exports = router;
