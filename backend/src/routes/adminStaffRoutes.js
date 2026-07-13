const express = require("express");
const {
  listStaff,
  createStaff,
  updateStaff,
  deleteStaff,
} = require("../controllers/staffController");

const router = express.Router();

router.get("/:restaurantId", listStaff);
router.post("/", createStaff);
router.patch("/:staffId", updateStaff);
router.delete("/:staffId", deleteStaff);

module.exports = router;
