const express = require("express");
const { getRestaurant } = require("../controllers/restaurantController");

const router = express.Router();

router.get("/:restaurantId", getRestaurant);

module.exports = router;
