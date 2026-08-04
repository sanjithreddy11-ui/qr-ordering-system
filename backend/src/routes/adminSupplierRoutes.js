const express = require("express");
const {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} = require("../controllers/supplierController");

const router = express.Router();

router.get("/:restaurantId", listSuppliers);
router.post("/", createSupplier);
router.patch("/:restaurantId/:supplierId", updateSupplier);
router.delete("/:restaurantId/:supplierId", deleteSupplier);

module.exports = router;
