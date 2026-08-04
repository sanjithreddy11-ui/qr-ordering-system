const express = require("express");
const {
  listMenuItemsAdmin,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
} = require("../controllers/adminMenuController");

const router = express.Router();

router.get("/:restaurantId", listMenuItemsAdmin);
router.post("/", createMenuItem);
router.patch("/:restaurantId/:itemId", updateMenuItem);
router.delete("/:restaurantId/:itemId", deleteMenuItem);

module.exports = router;
