const express = require("express");
const { listRecipes, getRecipe, upsertRecipe, deleteRecipe } = require("../controllers/recipeController");

const router = express.Router();

router.get("/:restaurantId", listRecipes);
router.get("/:restaurantId/:menuItemId", getRecipe);
router.put("/:restaurantId/:menuItemId", upsertRecipe);
router.delete("/:restaurantId/:menuItemId", deleteRecipe);

module.exports = router;
