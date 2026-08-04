const Vendor = require("../models/Vendor");
const Purchase = require("../models/Purchase");
const Expense = require("../models/Expense");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { serializeVendor } = require("../services/investmentService");

// GET /api/admin/investment/vendors/:restaurantId?search=
const listVendors = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { search } = req.query;

  const query = { restaurantId, isDeleted: false };
  if (search) query.name = new RegExp(search, "i");

  const vendors = await Vendor.find(query).sort({ name: 1 });

  // Outstanding balance / purchase history summary per vendor — computed
  // rather than stored so it can never drift from the underlying records.
  const vendorIds = vendors.map((v) => v._id);
  const [purchaseTotals, pendingTotals] = await Promise.all([
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, vendorId: { $in: vendorIds } } },
      { $group: { _id: "$vendorId", total: { $sum: "$grandTotal" }, count: { $sum: 1 } } },
    ]),
    Purchase.aggregate([
      {
        $match: {
          restaurantId,
          isDeleted: false,
          vendorId: { $in: vendorIds },
          paymentStatus: { $ne: "paid" },
        },
      },
      { $group: { _id: "$vendorId", outstanding: { $sum: "$grandTotal" } } },
    ]),
  ]);

  const totalsByVendor = Object.fromEntries(purchaseTotals.map((r) => [String(r._id), r]));
  const pendingByVendor = Object.fromEntries(pendingTotals.map((r) => [String(r._id), r.outstanding]));

  res.json({
    vendors: vendors.map((v) =>
      serializeVendor(v, {
        purchaseCount: totalsByVendor[String(v._id)]?.count ?? 0,
        totalPurchased: totalsByVendor[String(v._id)]?.total ?? 0,
        outstandingBalance: pendingByVendor[String(v._id)] ?? 0,
      })
    ),
  });
});

// GET /api/admin/investment/vendors/:restaurantId/:vendorId
const getVendorDetail = asyncHandler(async (req, res) => {
  const { restaurantId, vendorId } = req.params;
  const vendor = await Vendor.findOne({ _id: vendorId, restaurantId, isDeleted: false });
  if (!vendor) throw new ApiError(404, "Vendor not found");

  const [purchases, expenses] = await Promise.all([
    Purchase.find({ restaurantId, vendorId, isDeleted: false }).sort({ purchaseDate: -1 }).limit(100),
    Expense.find({ restaurantId, vendorId, isDeleted: false }).sort({ date: -1 }).limit(100),
  ]);

  const outstandingBalance = purchases
    .filter((p) => p.paymentStatus !== "paid")
    .reduce((sum, p) => sum + p.grandTotal, 0);

  res.json({
    vendor: serializeVendor(vendor, { outstandingBalance }),
    purchases,
    expenses,
  });
});

// POST /api/admin/investment/vendors
// Body: { restaurantId, name, gstNumber, phone, email, address, categories, notes }
const createVendor = asyncHandler(async (req, res) => {
  const { restaurantId, name } = req.body;
  if (!restaurantId || !name) throw new ApiError(400, "restaurantId and name are required");

  const vendor = await Vendor.create({
    restaurantId,
    name,
    gstNumber: req.body.gstNumber || "",
    phone: req.body.phone || "",
    email: req.body.email || "",
    address: req.body.address || "",
    categories: Array.isArray(req.body.categories) ? req.body.categories : [],
    notes: req.body.notes || "",
  });

  res.status(201).json({ vendor: serializeVendor(vendor) });
});

// PATCH /api/admin/investment/vendors/:restaurantId/:vendorId
const updateVendor = asyncHandler(async (req, res) => {
  const { restaurantId, vendorId } = req.params;
  const vendor = await Vendor.findOne({ _id: vendorId, restaurantId, isDeleted: false });
  if (!vendor) throw new ApiError(404, "Vendor not found");

  const fields = ["name", "gstNumber", "phone", "email", "address", "categories", "notes"];
  for (const field of fields) {
    if (req.body[field] !== undefined) vendor[field] = req.body[field];
  }
  await vendor.save();

  res.json({ vendor: serializeVendor(vendor) });
});

// DELETE /api/admin/investment/vendors/:restaurantId/:vendorId
const deleteVendor = asyncHandler(async (req, res) => {
  const { restaurantId, vendorId } = req.params;
  const vendor = await Vendor.findOne({ _id: vendorId, restaurantId, isDeleted: false });
  if (!vendor) throw new ApiError(404, "Vendor not found");

  vendor.isDeleted = true;
  await vendor.save();

  res.json({ success: true });
});

module.exports = { listVendors, getVendorDetail, createVendor, updateVendor, deleteVendor };
