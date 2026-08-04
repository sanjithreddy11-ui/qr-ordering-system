const Ingredient = require("../models/Ingredient");
const Order = require("../models/Order");
const { logMovement, recomputeAvailabilityForIngredient } = require("./stockService");

// ---- Expense Categories ----
// Ships as a constant so the module works with zero setup. Custom
// categories a restaurant adds live in the ExpenseCategory collection and
// are appended on top of this list (see expenseController.listCategories).
const DEFAULT_EXPENSE_CATEGORIES = [
  "Raw Materials",
  "Kitchen Equipment",
  "Furniture",
  "Electricity",
  "Water",
  "Gas",
  "Internet",
  "Rent",
  "Salary",
  "Maintenance",
  "Cleaning",
  "Packaging",
  "Marketing",
  "Software",
  "Repairs",
  "Miscellaneous",
];

// Stock Management Integration: purchase categories/product names that are
// treated as restockable inventory. A purchase whose category or product
// name matches an existing Ingredient (case-insensitive) automatically
// bumps that ingredient's stock instead of requiring a duplicate manual
// entry in Stock Management.
const STOCK_LINKED_CATEGORIES = new Set(
  ["Milk", "Coffee Beans", "Tea Powder", "Sugar", "Chocolate", "Packaging", "Disposable Cups", "Raw Materials"].map(
    (c) => c.toLowerCase()
  )
);

// ---- GST calculation ----
// Mirrors GstSettings' exclusive-by-default convention: rate/quantity give
// a pre-tax subtotal, discount is a flat deduction from that subtotal, and
// GST is applied on top. intra_state splits evenly into CGST+SGST; the
// spec's own example puts CGST/SGST/IGST directly on the purchase record,
// so this returns all three rather than picking one at write time.
function calculatePurchaseTotals({ quantity, rate, discount = 0, gstPercentage = 0, gstType = "intra_state" }) {
  const qty = Number(quantity) || 0;
  const r = Number(rate) || 0;
  const disc = Number(discount) || 0;
  const pct = Number(gstPercentage) || 0;

  const rawSubtotal = qty * r;
  const subtotal = Math.max(0, round2(rawSubtotal - disc));
  const gstAmount = round2((subtotal * pct) / 100);

  let cgst = 0,
    sgst = 0,
    igst = 0;
  if (pct > 0) {
    if (gstType === "inter_state") {
      igst = gstAmount;
    } else {
      cgst = round2(gstAmount / 2);
      sgst = round2(gstAmount - cgst);
    }
  }

  const grandTotal = round2(subtotal + gstAmount);

  return { subtotal, gstAmount, cgst, sgst, igst, grandTotal };
}

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

// Attempts to match a purchase to an existing Ingredient by product name
// (falling back to category) and, if found, increases its stock the same
// way a manual Stock Management restock would — reusing stockService so
// StockMovement logging and menu-availability recompute stay consistent
// with every other stock-changing code path in the app.
async function syncStockForPurchase(purchase) {
  const categoryMatches = STOCK_LINKED_CATEGORIES.has((purchase.category || "").toLowerCase());
  if (!categoryMatches) return null;

  const ingredient = await Ingredient.findOne({
    restaurantId: purchase.restaurantId,
    isDeleted: false,
    $or: [
      { name: new RegExp(`^${escapeRegExp(purchase.productName)}$`, "i") },
      { category: new RegExp(`^${escapeRegExp(purchase.category)}$`, "i") },
    ],
  });
  if (!ingredient) return null;

  ingredient.quantity += Number(purchase.quantity) || 0;
  await ingredient.save();

  await logMovement({
    restaurantId: purchase.restaurantId,
    ingredient,
    type: "purchased",
    quantityChange: Number(purchase.quantity) || 0,
    note: `Investment & Expenses purchase${purchase.vendorName ? ` from ${purchase.vendorName}` : ""}`,
    performedBy: purchase.addedBy || "",
  });

  await recomputeAvailabilityForIngredient(purchase.restaurantId, ingredient._id);

  return ingredient._id;
}

function escapeRegExp(str) {
  return String(str || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Reused by the Overview cards and Profit Analysis tab — same shape as
// dashboardController.revenueBetween, kept local since that helper isn't
// exported from dashboardController.
async function revenueBetween(restaurantId, from, to) {
  const [row] = await Order.aggregate([
    {
      $match: {
        restaurantId,
        status: { $ne: "cancelled" },
        placedAt: { $gte: from, $lt: to },
      },
    },
    { $group: { _id: null, revenue: { $sum: "$totalAmount" }, orderCount: { $sum: 1 } } },
  ]);
  return { revenue: row?.revenue ?? 0, orderCount: row?.orderCount ?? 0 };
}

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function serializePurchase(p) {
  return {
    id: p._id,
    restaurantId: p.restaurantId,
    branch: p.branch,
    purchaseDate: p.purchaseDate,
    invoiceNumber: p.invoiceNumber,
    invoiceDate: p.invoiceDate,
    vendorId: p.vendorId,
    vendorName: p.vendorName,
    vendorGstNumber: p.vendorGstNumber,
    category: p.category,
    productName: p.productName,
    quantity: p.quantity,
    unit: p.unit,
    rate: p.rate,
    discount: p.discount,
    gstPercentage: p.gstPercentage,
    gstType: p.gstType,
    cgst: p.cgst,
    sgst: p.sgst,
    igst: p.igst,
    subtotal: p.subtotal,
    gstAmount: p.gstAmount,
    grandTotal: p.grandTotal,
    paymentMethod: p.paymentMethod,
    paymentStatus: p.paymentStatus,
    status: p.status,
    notes: p.notes,
    invoiceUrl: p.invoiceUrl,
    stockIngredientId: p.stockIngredientId,
    addedBy: p.addedBy,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function serializeExpense(e) {
  return {
    id: e._id,
    restaurantId: e.restaurantId,
    branch: e.branch,
    date: e.date,
    category: e.category,
    description: e.description,
    amount: e.amount,
    vendorId: e.vendorId,
    vendorName: e.vendorName,
    paymentMethod: e.paymentMethod,
    paymentStatus: e.paymentStatus,
    invoiceUrl: e.invoiceUrl,
    notes: e.notes,
    recurringExpenseId: e.recurringExpenseId,
    addedBy: e.addedBy,
    createdAt: e.createdAt,
    updatedAt: e.updatedAt,
  };
}

function serializeAsset(a) {
  return {
    id: a._id,
    restaurantId: a.restaurantId,
    branch: a.branch,
    name: a.name,
    category: a.category,
    purchaseDate: a.purchaseDate,
    purchaseCost: a.purchaseCost,
    vendorId: a.vendorId,
    vendorName: a.vendorName,
    warranty: a.warranty,
    expectedLifeYears: a.expectedLifeYears,
    currentValue: a.currentValue,
    invoiceUrl: a.invoiceUrl,
    notes: a.notes,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function serializeVendor(v, extra = {}) {
  return {
    id: v._id,
    restaurantId: v.restaurantId,
    name: v.name,
    gstNumber: v.gstNumber,
    phone: v.phone,
    email: v.email,
    address: v.address,
    categories: v.categories,
    notes: v.notes,
    createdAt: v.createdAt,
    updatedAt: v.updatedAt,
    ...extra,
  };
}

function serializeRecurringExpense(r) {
  return {
    id: r._id,
    restaurantId: r.restaurantId,
    name: r.name,
    category: r.category,
    amount: r.amount,
    frequency: r.frequency,
    vendorId: r.vendorId,
    vendorName: r.vendorName,
    nextDueDate: r.nextDueDate,
    isActive: r.isActive,
    notes: r.notes,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function advanceDate(date, frequency) {
  const d = new Date(date);
  if (frequency === "weekly") d.setDate(d.getDate() + 7);
  else if (frequency === "yearly") d.setFullYear(d.getFullYear() + 1);
  else d.setMonth(d.getMonth() + 1); // monthly default
  return d;
}

module.exports = {
  DEFAULT_EXPENSE_CATEGORIES,
  STOCK_LINKED_CATEGORIES,
  calculatePurchaseTotals,
  syncStockForPurchase,
  revenueBetween,
  startOfDay,
  round2,
  serializePurchase,
  serializeExpense,
  serializeAsset,
  serializeVendor,
  serializeRecurringExpense,
  advanceDate,
};
