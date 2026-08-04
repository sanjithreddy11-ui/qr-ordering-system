const Expense = require("../models/Expense");
const ExpenseCategory = require("../models/ExpenseCategory");
const RecurringExpense = require("../models/RecurringExpense");
const Vendor = require("../models/Vendor");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const {
  DEFAULT_EXPENSE_CATEGORIES,
  serializeExpense,
  serializeRecurringExpense,
  advanceDate,
} = require("../services/investmentService");

function staffLabel(req) {
  return req.staff?.email || req.staff?.staffId || "";
}

// ---------------- Expenses ----------------

// GET /api/admin/investment/expenses/:restaurantId
const listExpenses = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const {
    search,
    category,
    vendorId,
    paymentMethod,
    paymentStatus,
    from,
    to,
    page = 1,
    limit = 25,
    sort = "newest",
  } = req.query;

  const query = { restaurantId, isDeleted: false };
  if (category) query.category = category;
  if (vendorId) query.vendorId = vendorId;
  if (paymentMethod) query.paymentMethod = paymentMethod;
  if (paymentStatus) query.paymentStatus = paymentStatus;
  if (from || to) {
    query.date = {};
    if (from) query.date.$gte = new Date(from);
    if (to) query.date.$lte = new Date(to);
  }
  if (search) {
    query.$or = [{ description: new RegExp(search, "i") }, { vendorName: new RegExp(search, "i") }, { category: new RegExp(search, "i") }];
  }

  const sortMap = { newest: { date: -1 }, oldest: { date: 1 }, amount_high: { amount: -1 }, amount_low: { amount: 1 } };
  const pageNum = Math.max(1, Number(page) || 1);
  const limitNum = Math.min(200, Math.max(1, Number(limit) || 25));

  const [expenses, total] = await Promise.all([
    Expense.find(query)
      .sort(sortMap[sort] || sortMap.newest)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum),
    Expense.countDocuments(query),
  ]);

  res.json({
    expenses: expenses.map(serializeExpense),
    pagination: { page: pageNum, limit: limitNum, total, totalPages: Math.ceil(total / limitNum) || 1 },
  });
});

// POST /api/admin/investment/expenses
const createExpense = asyncHandler(async (req, res) => {
  const { restaurantId, category, amount } = req.body;
  if (!restaurantId || !category || amount == null) {
    throw new ApiError(400, "restaurantId, category, and amount are required");
  }
  if (Number(amount) < 0) throw new ApiError(400, "amount cannot be negative");

  let vendor = null;
  if (req.body.vendorId) {
    vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
    if (!vendor) throw new ApiError(404, "Vendor not found");
  }

  const expense = await Expense.create({
    restaurantId,
    branch: req.body.branch || "",
    date: req.body.date ? new Date(req.body.date) : new Date(),
    category,
    description: req.body.description || "",
    amount: Number(amount),
    vendorId: vendor?._id || null,
    vendorName: vendor?.name || req.body.vendorName || "",
    paymentMethod: req.body.paymentMethod || "cash",
    paymentStatus: req.body.paymentStatus || "paid",
    invoiceUrl: req.body.invoiceUrl || "",
    notes: req.body.notes || "",
    addedBy: staffLabel(req),
  });

  res.status(201).json({ expense: serializeExpense(expense) });
});

// PATCH /api/admin/investment/expenses/:restaurantId/:expenseId
const updateExpense = asyncHandler(async (req, res) => {
  const { restaurantId, expenseId } = req.params;
  const expense = await Expense.findOne({ _id: expenseId, restaurantId, isDeleted: false });
  if (!expense) throw new ApiError(404, "Expense not found");

  const fields = ["branch", "category", "description", "amount", "paymentMethod", "paymentStatus", "invoiceUrl", "notes", "vendorName"];
  for (const field of fields) {
    if (req.body[field] !== undefined) expense[field] = req.body[field];
  }
  if (req.body.date !== undefined) expense.date = new Date(req.body.date);
  if (req.body.vendorId !== undefined) {
    if (req.body.vendorId) {
      const vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
      if (!vendor) throw new ApiError(404, "Vendor not found");
      expense.vendorId = vendor._id;
      expense.vendorName = vendor.name;
    } else {
      expense.vendorId = null;
    }
  }

  await expense.save();
  res.json({ expense: serializeExpense(expense) });
});

// DELETE /api/admin/investment/expenses/:restaurantId/:expenseId
const deleteExpense = asyncHandler(async (req, res) => {
  const { restaurantId, expenseId } = req.params;
  const expense = await Expense.findOne({ _id: expenseId, restaurantId, isDeleted: false });
  if (!expense) throw new ApiError(404, "Expense not found");

  expense.isDeleted = true;
  await expense.save();

  res.json({ success: true });
});

// ---------------- Expense Categories ----------------

// GET /api/admin/investment/categories/:restaurantId
const listCategories = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const custom = await ExpenseCategory.find({ restaurantId, isDeleted: false }).sort({ name: 1 });
  res.json({
    categories: [...DEFAULT_EXPENSE_CATEGORIES, ...custom.map((c) => c.name)],
  });
});

// POST /api/admin/investment/categories
const createCategory = asyncHandler(async (req, res) => {
  const { restaurantId, name } = req.body;
  if (!restaurantId || !name) throw new ApiError(400, "restaurantId and name are required");

  if (DEFAULT_EXPENSE_CATEGORIES.some((c) => c.toLowerCase() === name.toLowerCase())) {
    throw new ApiError(400, "This category already exists");
  }

  const existing = await ExpenseCategory.findOne({ restaurantId, name: new RegExp(`^${name}$`, "i"), isDeleted: false });
  if (existing) throw new ApiError(400, "This category already exists");

  const category = await ExpenseCategory.create({ restaurantId, name });
  res.status(201).json({ category: { id: category._id, name: category.name } });
});

// DELETE /api/admin/investment/categories/:restaurantId/:categoryId
const deleteCategory = asyncHandler(async (req, res) => {
  const { restaurantId, categoryId } = req.params;
  const category = await ExpenseCategory.findOne({ _id: categoryId, restaurantId, isDeleted: false });
  if (!category) throw new ApiError(404, "Category not found");

  category.isDeleted = true;
  await category.save();

  res.json({ success: true });
});

// ---------------- Recurring Expenses ----------------

// GET /api/admin/investment/recurring/:restaurantId
const listRecurringExpenses = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const recurring = await RecurringExpense.find({ restaurantId, isDeleted: false }).sort({ nextDueDate: 1 });
  res.json({ recurring: recurring.map(serializeRecurringExpense) });
});

// POST /api/admin/investment/recurring
const createRecurringExpense = asyncHandler(async (req, res) => {
  const { restaurantId, name, category, amount, frequency, nextDueDate } = req.body;
  if (!restaurantId || !name || !category || amount == null || !nextDueDate) {
    throw new ApiError(400, "restaurantId, name, category, amount, and nextDueDate are required");
  }

  let vendor = null;
  if (req.body.vendorId) {
    vendor = await Vendor.findOne({ _id: req.body.vendorId, restaurantId, isDeleted: false });
  }

  const recurring = await RecurringExpense.create({
    restaurantId,
    name,
    category,
    amount: Number(amount),
    frequency: RecurringExpense.FREQUENCIES.includes(frequency) ? frequency : "monthly",
    vendorId: vendor?._id || null,
    vendorName: vendor?.name || req.body.vendorName || "",
    nextDueDate: new Date(nextDueDate),
    notes: req.body.notes || "",
  });

  res.status(201).json({ recurring: serializeRecurringExpense(recurring) });
});

// PATCH /api/admin/investment/recurring/:restaurantId/:recurringId
const updateRecurringExpense = asyncHandler(async (req, res) => {
  const { restaurantId, recurringId } = req.params;
  const recurring = await RecurringExpense.findOne({ _id: recurringId, restaurantId, isDeleted: false });
  if (!recurring) throw new ApiError(404, "Recurring expense not found");

  const fields = ["name", "category", "amount", "frequency", "isActive", "notes", "vendorName"];
  for (const field of fields) {
    if (req.body[field] !== undefined) recurring[field] = req.body[field];
  }
  if (req.body.nextDueDate !== undefined) recurring.nextDueDate = new Date(req.body.nextDueDate);

  await recurring.save();
  res.json({ recurring: serializeRecurringExpense(recurring) });
});

// DELETE /api/admin/investment/recurring/:restaurantId/:recurringId
const deleteRecurringExpense = asyncHandler(async (req, res) => {
  const { restaurantId, recurringId } = req.params;
  const recurring = await RecurringExpense.findOne({ _id: recurringId, restaurantId, isDeleted: false });
  if (!recurring) throw new ApiError(404, "Recurring expense not found");

  recurring.isDeleted = true;
  await recurring.save();

  res.json({ success: true });
});

// POST /api/admin/investment/recurring/:restaurantId/:recurringId/record-payment
// Marks the current occurrence as paid: creates a real Expense row for it
// and advances nextDueDate to the following cycle. Kept as an explicit
// staff action (rather than a cron job) since this app has no background
// scheduler — the Overview's "Upcoming Recurring Payments" list surfaces
// what's due so staff know when to click it.
const recordRecurringPayment = asyncHandler(async (req, res) => {
  const { restaurantId, recurringId } = req.params;
  const recurring = await RecurringExpense.findOne({ _id: recurringId, restaurantId, isDeleted: false });
  if (!recurring) throw new ApiError(404, "Recurring expense not found");

  const expense = await Expense.create({
    restaurantId,
    date: new Date(),
    category: recurring.category,
    description: recurring.name,
    amount: recurring.amount,
    vendorId: recurring.vendorId,
    vendorName: recurring.vendorName,
    paymentMethod: req.body.paymentMethod || "cash",
    paymentStatus: "paid",
    notes: `Recurring payment: ${recurring.name}`,
    recurringExpenseId: recurring._id,
    addedBy: staffLabel(req),
  });

  recurring.nextDueDate = advanceDate(recurring.nextDueDate, recurring.frequency);
  await recurring.save();

  res.status(201).json({ expense: serializeExpense(expense), recurring: serializeRecurringExpense(recurring) });
});

module.exports = {
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
};
