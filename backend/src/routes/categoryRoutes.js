const express = require("express");
const {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
} = require("../controllers/categoryController");

const router = express.Router();

router.get("/:restaurantId", listCategories);
router.post("/", createCategory);
router.patch("/:restaurantId/:categoryId", updateCategory);
router.delete("/:restaurantId/:categoryId", deleteCategory);

module.exports = router;
