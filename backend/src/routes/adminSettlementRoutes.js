const express = require("express");
const {
  listSettlements,
  getSettlement,
  createSettlement,
  collectSettlement,
  getSettlementHistory,
  getCreditCustomers,
  clearCreditBalance,
  getSettlementAnalytics,
  getDateWiseReport,
} = require("../controllers/settlementController");

const router = express.Router();

// Mounted at /api/admin/settlements in app.js — already sits behind the
// /api/admin requireAuth gate, same as adminTableRoutes/paymentAnalyticsRoutes.
//
// Specific/nested paths registered before the plain "/:id" route so
// Express doesn't swallow them as a settlementId param.
router.get("/history", getSettlementHistory);
router.get("/credits", getCreditCustomers);
router.patch("/credits/:phone/clear", clearCreditBalance);
router.get("/analytics", getSettlementAnalytics);
// Date-wise Collection & Settlement Reporting (Settlements -> Reports tab).
router.get("/reports", getDateWiseReport);

router.get("/:id", getSettlement);
router.patch("/:id", collectSettlement);

router.get("/", listSettlements);
router.post("/", createSettlement);

module.exports = router;
