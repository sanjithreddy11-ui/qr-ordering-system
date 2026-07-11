const express = require("express");
const { getMenu } = require("../controllers/menuController");

const router = express.Router();

router.get("/:restaurantId", getMenu);

module.exports = router;
