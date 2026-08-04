const Asset = require("../models/Asset");
const Vendor = require("../models/Vendor");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { serializeAsset } = require("../services/investmentService");

// GET /api/admin/investment/assets/:restaurantId?search=&category=
const listAssets = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { search, category } = req.query;

  const query = { restaurantId, isDeleted: false };
  if (category) query.category = category;
  if (search) query.name = new RegExp(search, "i");

  const assets = await Asset.find(query).sort({ purchaseDate: -1 });
  res.json({ assets: assets.map(serializeAsset) });
});

// POST /api/admin/investment/assets
const createAsset = asyncHandler(async (req, res) => {
  const { restaurantId, name, purchaseCost } = req.body;
  if (!restaurantId || !name || purchaseCost == null) {
    throw new ApiError(400, "restaurantId, name, and purchaseCost are required");
  }

  let vendor = null;
  if (req.body.vendorId) {
    vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
  }

  const asset = await Asset.create({
    restaurantId,
    branch: req.body.branch || "",
    name,
    category: req.body.category || "Equipment",
    purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date(),
    purchaseCost: Number(purchaseCost),
    vendorId: vendor?._id || null,
    vendorName: vendor?.name || req.body.vendorName || "",
    warranty: req.body.warranty || "",
    expectedLifeYears: Number(req.body.expectedLifeYears) || 0,
    currentValue: req.body.currentValue != null ? Number(req.body.currentValue) : Number(purchaseCost),
    invoiceUrl: req.body.invoiceUrl || "",
    notes: req.body.notes || "",
    addedBy: req.staff?.email || req.staff?.staffId || "",
  });

  res.status(201).json({ asset: serializeAsset(asset) });
});

// PATCH /api/admin/investment/assets/:restaurantId/:assetId
const updateAsset = asyncHandler(async (req, res) => {
  const { restaurantId, assetId } = req.params;
  const asset = await Asset.findOne({ _id: assetId, restaurantId, isDeleted: false });
  if (!asset) throw new ApiError(404, "Asset not found");

  const fields = ["branch", "name", "category", "purchaseCost", "warranty", "expectedLifeYears", "currentValue", "invoiceUrl", "notes", "vendorName"];
  for (const field of fields) {
    if (req.body[field] !== undefined) asset[field] = req.body[field];
  }
  if (req.body.purchaseDate !== undefined) asset.purchaseDate = new Date(req.body.purchaseDate);
  if (req.body.vendorId !== undefined) {
    if (req.body.vendorId) {
      const vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
      if (!vendor) throw new ApiError(404, "Vendor not found");
      asset.vendorId = vendor._id;
      asset.vendorName = vendor.name;
    } else {
      asset.vendorId = null;
    }
  }

  await asset.save();
  res.json({ asset: serializeAsset(asset) });
});

// DELETE /api/admin/investment/assets/:restaurantId/:assetId
const deleteAsset = asyncHandler(async (req, res) => {
  const { restaurantId, assetId } = req.params;
  const asset = await Asset.findOne({ _id: assetId, restaurantId, isDeleted: false });
  if (!asset) throw new ApiError(404, "Asset not found");

  asset.isDeleted = true;
  await asset.save();

  res.json({ success: true });
});

module.exports = { listAssets, createAsset, updateAsset, deleteAsset };
