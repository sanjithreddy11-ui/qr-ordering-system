const express = require("express");
const {
  getGstSettings,
  updateGstSettings,
  getGstDashboard,
  getGstReport,
} = require("../controllers/gstController");

const router = express.Router();

// Mounted at /api/admin/gst in app.js — already sits behind the
// /api/admin requireAuth gate, same as every other admin route.
router.get("/settings/:restaurantId", getGstSettings);
router.put("/settings/:restaurantId", updateGstSettings);
router.get("/dashboard/:restaurantId", getGstDashboard);
router.get("/reports/:restaurantId", getGstReport);

module.exports = router;
