const Purchase = require("../models/Purchase");
const Expense = require("../models/Expense");
const Asset = require("../models/Asset");
const Vendor = require("../models/Vendor");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { revenueBetween, startOfDay, round2 } = require("../services/investmentService");

function parseRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  const from = query.from ? new Date(query.from) : new Date(new Date().setDate(to.getDate() - 30));
  return { from, to };
}

// GET /api/admin/investment/overview/:restaurantId
// Powers the summary cards + the four Overview charts.
const getOverview = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const todayStart = startOfDay(new Date());
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const twelveMonthsAgo = new Date(todayStart.getFullYear(), todayStart.getMonth() - 11, 1);

  const [
    totalInvestment,
    totalExpenses,
    thisMonthExpenses,
    inputGstAgg,
    vendorCount,
    assetAgg,
    pendingPurchases,
    pendingExpenses,
    monthlyExpenseTrend,
    categoryBreakdown,
    vendorSpending,
    monthlyGst,
  ] = await Promise.all([
    Asset.aggregate([
      { $match: { restaurantId, isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$purchaseCost" } } },
    ]),
    sumExpensesAndPurchases(restaurantId, {}),
    sumExpensesAndPurchases(restaurantId, { $gte: monthStart }),
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false } },
      { $group: { _id: null, total: { $sum: "$gstAmount" } } },
    ]),
    Vendor.countDocuments({ restaurantId, isDeleted: false }),
    Asset.aggregate([{ $match: { restaurantId, isDeleted: false } }, { $group: { _id: null, count: { $sum: 1 } } }]),
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, paymentStatus: { $ne: "paid" } } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    Expense.aggregate([
      { $match: { restaurantId, isDeleted: false, paymentStatus: { $ne: "paid" } } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]),
    monthlySeries(restaurantId, twelveMonthsAgo),
    categorySeries(restaurantId),
    vendorSeries(restaurantId),
    monthlyGstSeries(restaurantId, twelveMonthsAgo),
  ]);

  const totalInvestmentValue = totalInvestment[0]?.total ?? 0;
  const inputGstPaid = inputGstAgg[0]?.total ?? 0;
  const assetsCount = assetAgg[0]?.count ?? 0;
  const pendingPayments = round2((pendingPurchases[0]?.total ?? 0) + (pendingExpenses[0]?.total ?? 0));

  // Monthly Profit chart: revenue (from Orders) minus expenses per month.
  const monthlyProfit = await Promise.all(
    monthlyExpenseTrend.map(async (point) => {
      const [year, month] = point.month.split("-").map(Number);
      const from = new Date(year, month - 1, 1);
      const to = new Date(year, month, 1);
      const { revenue } = await revenueBetween(restaurantId, from, to);
      return { month: point.month, revenue, expenses: point.total, profit: round2(revenue - point.total) };
    })
  );

  res.json({
    cards: {
      totalInvestment: totalInvestmentValue,
      totalExpenses: totalExpenses,
      thisMonthExpenses: thisMonthExpenses,
      inputGstPaid,
      netBusinessCost: round2(totalExpenses + totalInvestmentValue),
      totalVendors: vendorCount,
      totalAssets: assetsCount,
      pendingPayments,
    },
    charts: {
      monthlyExpenseTrend,
      categoryBreakdown,
      vendorSpending,
      monthlyProfit,
      monthlyGst,
    },
  });
});

// Combined Purchases + Expenses total for a date filter (or no filter).
async function sumExpensesAndPurchases(restaurantId, dateFilter) {
  const purchaseMatch = { restaurantId, isDeleted: false };
  const expenseMatch = { restaurantId, isDeleted: false };
  if (dateFilter && Object.keys(dateFilter).length) {
    purchaseMatch.purchaseDate = dateFilter;
    expenseMatch.date = dateFilter;
  }
  const [purchaseAgg, expenseAgg] = await Promise.all([
    Purchase.aggregate([{ $match: purchaseMatch }, { $group: { _id: null, total: { $sum: "$grandTotal" } } }]),
    Expense.aggregate([{ $match: expenseMatch }, { $group: { _id: null, total: { $sum: "$amount" } } }]),
  ]);
  return round2((purchaseAgg[0]?.total ?? 0) + (expenseAgg[0]?.total ?? 0));
}

// { month: "2026-06", total } for the last N months, combining Purchases + Expenses.
async function monthlySeries(restaurantId, since) {
  const [purchases, expenses] = await Promise.all([
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$purchaseDate" } }, total: { $sum: "$grandTotal" } } },
    ]),
    Expense.aggregate([
      { $match: { restaurantId, isDeleted: false, date: { $gte: since } } },
      { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$date" } }, total: { $sum: "$amount" } } },
    ]),
  ]);
  const merged = {};
  for (const row of [...purchases, ...expenses]) {
    merged[row._id] = round2((merged[row._id] || 0) + row.total);
  }
  return Object.entries(merged)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([month, total]) => ({ month, total }));
}

async function monthlyGstSeries(restaurantId, since) {
  const rows = await Purchase.aggregate([
    { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: since } } },
    { $group: { _id: { $dateToString: { format: "%Y-%m", date: "$purchaseDate" } }, total: { $sum: "$gstAmount" } } },
    { $sort: { _id: 1 } },
  ]);
  return rows.map((r) => ({ month: r._id, total: round2(r.total) }));
}

// Expense Category Breakdown (Purchases + Expenses combined by category).
async function categorySeries(restaurantId) {
  const [purchases, expenses] = await Promise.all([
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false } },
      { $group: { _id: "$category", total: { $sum: "$grandTotal" } } },
    ]),
    Expense.aggregate([
      { $match: { restaurantId, isDeleted: false } },
      { $group: { _id: "$category", total: { $sum: "$amount" } } },
    ]),
  ]);
  const merged = {};
  for (const row of [...purchases, ...expenses]) {
    merged[row._id] = round2((merged[row._id] || 0) + row.total);
  }
  return Object.entries(merged)
    .map(([category, total]) => ({ category, total }))
    .sort((a, b) => b.total - a.total);
}

// Vendor Spending (Purchases + Expenses combined by vendor).
async function vendorSeries(restaurantId) {
  const [purchases, expenses] = await Promise.all([
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, vendorName: { $ne: "" } } },
      { $group: { _id: "$vendorName", total: { $sum: "$grandTotal" } } },
    ]),
    Expense.aggregate([
      { $match: { restaurantId, isDeleted: false, vendorName: { $ne: "" } } },
      { $group: { _id: "$vendorName", total: { $sum: "$amount" } } },
    ]),
  ]);
  const merged = {};
  for (const row of [...purchases, ...expenses]) {
    merged[row._id] = round2((merged[row._id] || 0) + row.total);
  }
  return Object.entries(merged)
    .map(([vendor, total]) => ({ vendor, total }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);
}

// GET /api/admin/investment/gst-report/:restaurantId?from=&to=&groupBy=day|month
// Input GST (on purchases) — the counterpart to the existing GST module's
// output-GST dashboard/report (gstService.getDashboard/getReport), which
// only covers GST collected on sales.
const getGstReport = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { from, to } = parseRange(req.query);
  const groupBy = req.query.groupBy === "month" ? "%Y-%m" : "%Y-%m-%d";

  const [rows, totals] = await Promise.all([
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: groupBy, date: "$purchaseDate" } },
          taxableAmount: { $sum: "$subtotal" },
          cgst: { $sum: "$cgst" },
          sgst: { $sum: "$sgst" },
          igst: { $sum: "$igst" },
          inputGst: { $sum: "$gstAmount" },
          purchaseCount: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: null,
          taxableAmount: { $sum: "$subtotal" },
          cgst: { $sum: "$cgst" },
          sgst: { $sum: "$sgst" },
          igst: { $sum: "$igst" },
          inputGst: { $sum: "$gstAmount" },
          purchaseCount: { $sum: 1 },
        },
      },
    ]),
  ]);

  res.json({
    report: {
      from,
      to,
      rows: rows.map((r) => ({ period: r._id, ...omitId(r) })),
      totals: totals[0] ? omitId(totals[0]) : { taxableAmount: 0, cgst: 0, sgst: 0, igst: 0, inputGst: 0, purchaseCount: 0 },
    },
  });
});

function omitId({ _id, ...rest }) {
  return rest;
}

// GET /api/admin/investment/profit-analysis/:restaurantId?from=&to=
const getProfitAnalysis = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { from, to } = parseRange(req.query);
  const toExclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);

  const [{ revenue }, expenseTotal] = await Promise.all([
    revenueBetween(restaurantId, from, toExclusive),
    sumExpensesAndPurchases(restaurantId, { $gte: from, $lte: to }),
  ]);

  const netProfit = round2(revenue - expenseTotal);
  const profitMargin = revenue ? round2((netProfit / revenue) * 100) : 0;
  const expenseRatio = revenue ? round2((expenseTotal / revenue) * 100) : 0;

  res.json({
    analysis: { from, to, revenue: round2(revenue), expenses: expenseTotal, netProfit, profitMargin, expenseRatio },
  });
});

// GET /api/admin/investment/reports/:restaurantId?type=&from=&to=&format=json|csv
// type: daily | weekly | monthly | gst | vendor | purchase | investment | pnl
const generateReport = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { type = "monthly", format = "json" } = req.query;
  const { from, to } = parseRange(req.query);

  let rows = [];
  let columns = [];

  if (type === "purchase") {
    const purchases = await Purchase.find({ restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } }).sort({
      purchaseDate: -1,
    });
    columns = ["Date", "Invoice #", "Vendor", "Category", "Product", "Qty", "Rate", "GST %", "GST Amount", "Grand Total", "Status"];
    rows = purchases.map((p) => [
      p.purchaseDate.toISOString().slice(0, 10),
      p.invoiceNumber,
      p.vendorName,
      p.category,
      p.productName,
      p.quantity,
      p.rate,
      p.gstPercentage,
      p.gstAmount,
      p.grandTotal,
      p.paymentStatus,
    ]);
  } else if (type === "vendor") {
    const rowsAgg = await Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } } },
      { $group: { _id: "$vendorName", total: { $sum: "$grandTotal" }, gst: { $sum: "$gstAmount" }, count: { $sum: 1 } } },
      { $sort: { total: -1 } },
    ]);
    columns = ["Vendor", "Purchases", "Total Spent", "GST Paid"];
    rows = rowsAgg.map((r) => [r._id || "(no vendor)", r.count, r.total, r.gst]);
  } else if (type === "gst") {
    const rowsAgg = await Purchase.aggregate([
      { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$purchaseDate" } },
          taxable: { $sum: "$subtotal" },
          cgst: { $sum: "$cgst" },
          sgst: { $sum: "$sgst" },
          igst: { $sum: "$igst" },
          total: { $sum: "$gstAmount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);
    columns = ["Date", "Taxable Amount", "CGST", "SGST", "IGST", "Total GST"];
    rows = rowsAgg.map((r) => [r._id, r.taxable, r.cgst, r.sgst, r.igst, r.total]);
  } else if (type === "investment") {
    const assets = await Asset.find({ restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } }).sort({
      purchaseDate: -1,
    });
    columns = ["Date", "Asset", "Category", "Cost", "Current Value", "Vendor"];
    rows = assets.map((a) => [a.purchaseDate.toISOString().slice(0, 10), a.name, a.category, a.purchaseCost, a.currentValue, a.vendorName]);
  } else if (type === "pnl") {
    const toExclusive = new Date(to.getTime() + 24 * 60 * 60 * 1000);
    const [{ revenue }, expenseTotal] = await Promise.all([
      revenueBetween(restaurantId, from, toExclusive),
      sumExpensesAndPurchases(restaurantId, { $gte: from, $lte: to }),
    ]);
    columns = ["Metric", "Value"];
    rows = [
      ["Revenue", revenue],
      ["Total Expenses (incl. purchases)", expenseTotal],
      ["Net Profit", round2(revenue - expenseTotal)],
      ["Profit Margin %", revenue ? round2(((revenue - expenseTotal) / revenue) * 100) : 0],
    ];
  } else {
    // daily | weekly | monthly expense report — combined Purchases + Expenses
    const groupFormat = type === "daily" ? "%Y-%m-%d" : type === "weekly" ? "%Y-%U" : "%Y-%m";
    const [purchases, expenses] = await Promise.all([
      Purchase.aggregate([
        { $match: { restaurantId, isDeleted: false, purchaseDate: { $gte: from, $lte: to } } },
        { $group: { _id: { $dateToString: { format: groupFormat, date: "$purchaseDate" } }, total: { $sum: "$grandTotal" } } },
      ]),
      Expense.aggregate([
        { $match: { restaurantId, isDeleted: false, date: { $gte: from, $lte: to } } },
        { $group: { _id: { $dateToString: { format: groupFormat, date: "$date" } }, total: { $sum: "$amount" } } },
      ]),
    ]);
    const merged = {};
    for (const row of [...purchases, ...expenses]) merged[row._id] = round2((merged[row._id] || 0) + row.total);
    columns = ["Period", "Total Expenses"];
    rows = Object.entries(merged)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([period, total]) => [period, total]);
  }

  if (format === "csv") {
    const csv = toCsv(columns, rows);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${type}-report.csv"`);
    return res.send(csv);
  }

  res.json({ report: { type, from, to, columns, rows } });
});

function toCsv(columns, rows) {
  const escape = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return lines.join("\n");
}

module.exports = { getOverview, getGstReport, getProfitAnalysis, generateReport };
