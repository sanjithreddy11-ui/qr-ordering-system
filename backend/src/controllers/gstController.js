const asyncHandler = require("../utils/asyncHandler");
const ApiError = require("../utils/ApiError");
const gstService = require("../services/gstService");

// GET /api/admin/gst/settings/:restaurantId
const getGstSettings = asyncHandler(async (req, res) => {
  const settings = await gstService.getSettings(req.params.restaurantId);
  res.json({ settings });
});

// PUT /api/admin/gst/settings/:restaurantId
// Body: any subset of { businessName, gstin, businessAddress,
//   calculationMode, defaultGstPercentage, enabled, slabs, igstEnabled,
//   stateCode, cessEnabled, defaultCessPercentage }
const updateGstSettings = asyncHandler(async (req, res) => {
  const settings = await gstService.upsertSettings(req.params.restaurantId, req.body || {});
  res.json({ settings });
});

// GET /api/admin/gst/dashboard/:restaurantId?from=&to=
const getGstDashboard = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const dashboard = await gstService.getDashboard(req.params.restaurantId, { from, to });
  res.json({ dashboard });
});

// GET /api/admin/gst/reports/:restaurantId?from=&to=&groupBy=day|month
const getGstReport = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const groupBy = req.query.groupBy === "month" ? "month" : "day";
  if (!from || !to) {
    throw new ApiError(400, "from and to query params are required");
  }
  const report = await gstService.getReport(req.params.restaurantId, { from, to, groupBy });
  res.json({ report });
});

module.exports = { getGstSettings, updateGstSettings, getGstDashboard, getGstReport };
