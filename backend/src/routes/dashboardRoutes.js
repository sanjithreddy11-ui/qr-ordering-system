const express = require("express");
const { getSummary, getRevenueBreakdown } = require("../controllers/dashboardController");

const router = express.Router();

router.get("/summary", getSummary);
router.get("/revenue", getRevenueBreakdown);

module.exports = router;
