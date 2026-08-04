const Purchase = require("../models/Purchase");
const Vendor = require("../models/Vendor");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { calculatePurchaseTotals, syncStockForPurchase, serializePurchase } = require("../services/investmentService");

function staffLabel(req) {
  return req.staff?.email || req.staff?.staffId || "";
}

// GET /api/admin/investment/purchases/:restaurantId
// Query: search, category, vendorId, paymentMethod, status, gstPercentage,
//        from, to, invoiceNumber, page, limit, sort
const listPurchases = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const {
    search,
    category,
    vendorId,
    paymentMethod,
    status,
    paymentStatus,
    gstPercentage,
    from,
    to,
    invoiceNumber,
    page = 1,
    limit = 25,
    sort = "newest",
  } = req.query;

  const query = { restaurantId, isDeleted: false };
  if (category) query.category = category;
  if (vendorId) query.vendorId = vendorId;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (status) query.status = status;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (gstPercentage) query.gstPercentage = Number(gstPercentage);
  if (invoiceNumber) query.invoiceNumber = new RegExp(invoiceNumber, "i");
  if (from || to) {
    query.purchaseDate = {};
    if (from) query.purchaseDate.$gte = new Date(from);
    if (to) query.purchaseDate.$lte = new Date(to);
  }
  if (search) {
    query.$or = [
      { productName: new RegExp(search, "i") },
      { vendorName: new RegExp(search, "i") },
      { invoiceNumber: new RegExp(search, "i") },
      { category: new RegExp(search, "i") },
    ];
  }

  const sortMap = {
    newest: { purchaseDate: -1 },
    oldest: { purchaseDate: 1 },
    amount_high: { grandTotal: -1 },
    amount_low: { grandTotal: 1 },
  };

  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 25));

  const [purchases, total] = await Promise.all([
    Purchase.find(query)
      .sort(sortMap[sort] || sortMap.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Purchase.countDocuments(query),
  ]);

  res.json({
    purchases: purchases.map(serializePurchase),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
  });
});

// GET /api/admin/investment/purchases/:restaurantId/:purchaseId
const getPurchase = asyncHandler(async (req, res) => {
  const { restaurantId, purchaseId } = req.params;
  const purchase = await Purchase.findOne({ _id: purchaseId, restaurantId, isDeleted: false });
  if (!purchase) throw new ApiError(404, "Purchase not found");
  res.json({ purchase: serializePurchase(purchase) });
});

// POST /api/admin/investment/purchases
// Body: { restaurantId, branch, purchaseDate, invoiceNumber, invoiceDate,
//   vendorId, category, productName, quantity, unit, rate, discount,
//   gstPercentage, gstType, paymentMethod, paymentStatus, status, notes,
//   invoiceUrl }
// Server always recomputes subtotal/GST/grandTotal from quantity, rate,
// discount, and gstPercentage — client-sent totals (if any) are ignored so
// the numbers can never be tampered with or drift from a rounding bug on
// the frontend.
const createPurchase = asyncHandler(async (req, res) => {
  const { restaurantId, category, productName, quantity, rate } = req.body;
  if (!restaurantId || !category || !productName || quantity == null || rate == null) {
    throw new ApiError(400, "restaurantId, category, productName, quantity, and rate are required");
  }
  if (Number(quantity) <= 0) throw new ApiError(400, "quantity must be greater than 0");
  if (Number(rate) < 0) throw new ApiError(400, "rate cannot be negative");

  let vendor = null;
  if (req.body.vendorId) {
    vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
    if (!vendor) throw new ApiError(404, "Vendor not found");
  }

  const totals = calculatePurchaseTotals({
    quantity,
    rate,
    discount: req.body.discount,
    gstPercentage: req.body.gstPercentage,
    gstType: req.body.gstType,
  });

  const purchase = await Purchase.create({
    restaurantId,
    branch: req.body.branch || "",
    purchaseDate: req.body.purchaseDate ? new Date(req.body.purchaseDate) : new Date(),
    invoiceNumber: req.body.invoiceNumber || "",
    invoiceDate: req.body.invoiceDate ? new Date(req.body.invoiceDate) : null,
    vendorId: vendor?._id || null,
    vendorName: vendor?.name || req.body.vendorName || "",
    vendorGstNumber: vendor?.gstNumber || req.body.vendorGstNumber || "",
    category,
    productName,
    quantity: Number(quantity),
    unit: req.body.unit || "pcs",
    rate: Number(rate),
    discount: Number(req.body.discount) || 0,
    gstPercentage: Number(req.body.gstPercentage) || 0,
    gstType: req.body.gstType === "inter_state" ? "inter_state" : "intra_state",
    ...totals,
    paymentMethod: req.body.paymentMethod || "cash",
    paymentStatus: req.body.paymentStatus || "paid",
    status: req.body.status || "confirmed",
    notes: req.body.notes || "",
    invoiceUrl: req.body.invoiceUrl || "",
    addedBy: staffLabel(req),
  });

  // Stock Management Integration — best-effort, never blocks the purchase
  // itself from being saved.
  try {
    const ingredientId = await syncStockForPurchase(purchase);
    if (ingredientId) {
      purchase.stockIngredientId = ingredientId;
      await purchase.save();
    }
  } catch (err) {
    console.error("Stock sync failed for purchase (purchase was still saved):", err);
  }

  res.status(201).json({ purchase: serializePurchase(purchase) });
});

// PATCH /api/admin/investment/purchases/:restaurantId/:purchaseId
const updatePurchase = asyncHandler(async (req, res) => {
  const { restaurantId, purchaseId } = req.params;
  const purchase = await Purchase.findOne({ _id: purchaseId, restaurantId, isDeleted: false });
  if (!purchase) throw new ApiError(404, "Purchase not found");

  const directFields = [
    "branch",
    "invoiceNumber",
    "category",
    "productName",
    "unit",
    "paymentMethod",
    "paymentStatus",
    "status",
    "notes",
    "invoiceUrl",
    "vendorName",
    "vendorGstNumber",
  ];
  for (const field of directFields) {
    if (req.body[field] !== undefined) purchase[field] = req.body[field];
  }
  if (req.body.purchaseDate !== undefined) purchase.purchaseDate = new Date(req.body.purchaseDate);
  if (req.body.invoiceDate !== undefined) purchase.invoiceDate = req.body.invoiceDate ? new Date(req.body.invoiceDate) : null;

  if (req.body.vendorId !== undefined) {
    if (req.body.vendorId) {
      const vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
      if (!vendor) throw new ApiError(404, "Vendor not found");
      purchase.vendorId = vendor._id;
      purchase.vendorName = vendor.name;
      purchase.vendorGstNumber = vendor.gstNumber;
    } else {
      purchase.vendorId = null;
    }
  }

  // Recompute totals whenever any pricing input changes.
  const pricingChanged = ["quantity", "rate", "discount", "gstPercentage", "gstType"].some(
    (f) => req.body[f] !== undefined
  );
  if (pricingChanged) {
    const totals = calculatePurchaseTotals({
      quantity: req.body.quantity ?? purchase.quantity,
      rate: req.body.rate ?? purchase.rate,
      discount: req.body.discount ?? purchase.discount,
      gstPercentage: req.body.gstPercentage ?? purchase.gstPercentage,
      gstType: req.body.gstType ?? purchase.gstType,
    });
    purchase.quantity = Number(req.body.quantity ?? purchase.quantity);
    purchase.rate = Number(req.body.rate ?? purchase.rate);
    purchase.discount = Number(req.body.discount ?? purchase.discount);
    purchase.gstPercentage = Number(req.body.gstPercentage ?? purchase.gstPercentage);
    purchase.gstType = req.body.gstType ?? purchase.gstType;
    Object.assign(purchase, totals);
  }

  await purchase.save();
  res.json({ purchase: serializePurchase(purchase) });
});

// DELETE /api/admin/investment/purchases/:restaurantId/:purchaseId
const deletePurchase = asyncHandler(async (req, res) => {
  const { restaurantId, purchaseId } = req.params;
  const purchase = await Purchase.findOne({ _id: purchaseId, restaurantId, isDeleted: false });
  if (!purchase) throw new ApiError(404, "Purchase not found");

  purchase.isDeleted = true;
  await purchase.save();

  res.json({ success: true });
});

module.exports = { listPurchases, getPurchase, createPurchase, updatePurchase, deletePurchase };
