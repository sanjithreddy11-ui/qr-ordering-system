const express = require("express");
const {
  listTables,
  createTable,
  updateTable,
  deleteTable,
} = require("../controllers/adminTableController");

const router = express.Router();

router.get("/:restaurantId", listTables);
router.post("/", createTable);
router.patch("/:tableId", updateTable);
router.delete("/:tableId", deleteTable);

module.exports = router;
