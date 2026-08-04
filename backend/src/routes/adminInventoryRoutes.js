const express = require("express");
const {
  listIngredients,
  getInventorySummary,
  getStockAlerts,
  getStockMovements,
  createIngredient,
  updateIngredient,
  deleteIngredient,
} = require("../controllers/inventoryController");
const { createPurchase, listPurchaseHistory } = require("../controllers/purchaseController");

const router = express.Router();

// Static sub-paths must be registered before the dynamic "/:restaurantId"
// route below, or Express would try to match "summary"/"purchase" as a
// restaurantId.
router.post("/purchase", createPurchase);
router.get("/:restaurantId/summary", getInventorySummary);
router.get("/:restaurantId/alerts", getStockAlerts);
router.get("/:restaurantId/movements", getStockMovements);
router.get("/:restaurantId/purchases", listPurchaseHistory);

router.get("/:restaurantId", listIngredients);
router.post("/", createIngredient);
router.patch("/:restaurantId/:ingredientId", updateIngredient);
router.delete("/:restaurantId/:ingredientId", deleteIngredient);

module.exports = router;
