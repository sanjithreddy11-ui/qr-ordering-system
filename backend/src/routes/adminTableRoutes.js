const express = require("express");
const {
  listTables,
  createTable,
  updateTable,
  deleteTable,
} = require("../controllers/adminTableController");
const {
  getTableGrid,
  getTableDetails,
  markBilling,
  closeSession,
  markAvailable,
  markOutOfService,
  getTableAnalytics,
} = require("../controllers/tableStatusController");
const {
  setPaymentMethod,
  printBill,
  getReceipt,
  collectPayment,
} = require("../controllers/sessionPaymentController");

const router = express.Router();

// --- Table Management additions ---
// Specific/nested paths registered before the plain "/:restaurantId" and
// "/:tableId" routes below so Express doesn't swallow them as params.
router.get("/:restaurantId/grid", getTableGrid);
router.get("/:restaurantId/analytics", getTableAnalytics);
router.get("/:tableId/details", getTableDetails);
router.patch("/:tableId/billing", markBilling);
router.patch("/:tableId/close-session", closeSession);
router.patch("/:tableId/available", markAvailable);
router.patch("/:tableId/out-of-service", markOutOfService);

// --- Current Dining Session payment workflow ---
router.patch("/:tableId/session/payment-method", setPaymentMethod);
router.patch("/:tableId/session/print-bill", printBill);
router.get("/:tableId/session/receipt", getReceipt);
router.patch("/:tableId/session/collect-payment", collectPayment);

// --- Existing QR/table CRUD (unchanged) ---
router.get("/:restaurantId", listTables);
router.post("/", createTable);
router.patch("/:tableId", updateTable);
router.delete("/:tableId", deleteTable);

module.exports = router;
