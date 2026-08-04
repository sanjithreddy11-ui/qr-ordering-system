const express = require("express");
const { requireAdminRole } = require("../middleware/auth");
const { invoiceUpload } = require("../middleware/upload");

const {
  listPurchases,
  getPurchase,
  createPurchase,
  updatePurchase,
  deletePurchase,
} = require("../controllers/investmentPurchaseController");

const {
  listExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  listCategories,
  createCategory,
  deleteCategory,
  listRecurringExpenses,
  createRecurringExpense,
  updateRecurringExpense,
  deleteRecurringExpense,
  recordRecurringPayment,
} = require("../controllers/expenseController");

const { listAssets, createAsset, updateAsset, deleteAsset } = require("../controllers/assetController");

const { listVendors, getVendorDetail, createVendor, updateVendor, deleteVendor } = require("../controllers/vendorController");

const { getOverview, getGstReport, getProfitAnalysis, generateReport } = require("../controllers/investmentReportController");

const { uploadInvoice } = require("../controllers/uploadController");

const router = express.Router();

// This entire module (Investment & Expenses) is Owner/Admin only —
// req.staff is already populated by the app-level requireAuth mounted on
// /api/admin above this router.
router.use(requireAdminRole);

// ---- Overview / Reports / GST / Profit Analysis ----
router.get("/overview/:restaurantId", getOverview);
router.get("/gst-report/:restaurantId", getGstReport);
router.get("/profit-analysis/:restaurantId", getProfitAnalysis);
router.get("/reports/:restaurantId", generateReport);

// ---- Invoice upload (PDF/PNG/JPEG) ----
router.post("/upload", invoiceUpload.single("invoice"), uploadInvoice);

// ---- Purchases ----
router.get("/purchases/:restaurantId/:purchaseId", getPurchase);
router.get("/purchases/:restaurantId", listPurchases);
router.post("/purchases", createPurchase);
router.patch("/purchases/:restaurantId/:purchaseId", updatePurchase);
router.delete("/purchases/:restaurantId/:purchaseId", deletePurchase);

// ---- Expenses ----
router.get("/expenses/:restaurantId", listExpenses);
router.post("/expenses", createExpense);
router.patch("/expenses/:restaurantId/:expenseId", updateExpense);
router.delete("/expenses/:restaurantId/:expenseId", deleteExpense);

// ---- Expense Categories ----
router.get("/categories/:restaurantId", listCategories);
router.post("/categories", createCategory);
router.delete("/categories/:restaurantId/:categoryId", deleteCategory);

// ---- Recurring Expenses ----
router.get("/recurring/:restaurantId", listRecurringExpenses);
router.post("/recurring", createRecurringExpense);
router.patch("/recurring/:restaurantId/:recurringId", updateRecurringExpense);
router.delete("/recurring/:restaurantId/:recurringId", deleteRecurringExpense);
router.post("/recurring/:restaurantId/:recurringId/record-payment", recordRecurringPayment);

// ---- Assets ----
router.get("/assets/:restaurantId", listAssets);
router.post("/assets", createAsset);
router.patch("/assets/:restaurantId/:assetId", updateAsset);
router.delete("/assets/:restaurantId/:assetId", deleteAsset);

// ---- Vendors ----
router.get("/vendors/:restaurantId/:vendorId", getVendorDetail);
router.get("/vendors/:restaurantId", listVendors);
router.post("/vendors", createVendor);
router.patch("/vendors/:restaurantId/:vendorId", updateVendor);
router.delete("/vendors/:restaurantId/:vendorId", deleteVendor);

module.exports = router;
