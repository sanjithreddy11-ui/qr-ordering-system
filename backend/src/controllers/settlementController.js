const Settlement = require("../models/Settlement");
const Table = require("../models/Table");
const TableSession = require("../models/TableSession");
const Order = require("../models/Order");
const Customer = require("../models/Customer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { submitBillForTable } = require("../services/settlementService");
const getBusinessDate = require("../utils/getBusinessDate");
const {
  emitSettlementUpdated,
  emitSessionEnded,
  emitTableAvailable,
} = require("../sockets/socket");

const PAYMENT_METHODS = Settlement.PAYMENT_METHODS; // ["cash","upi","card","bank_transfer","credit"]
const PAYMENT_STATUSES = Settlement.PAYMENT_STATUSES; // ["pending","paid","credit","cancelled"]
const COLLECTION_STATUSES = Settlement.COLLECTION_STATUSES; // ["UNPAID","PARTIALLY_PAID","PAID"]

const DAY_MS = 24 * 60 * 60 * 1000;
// Fixed IST offset — India does not observe DST, so this is safe/stable
// year-round (same reasoning as utils/getBusinessDate.js).
const IST_SUFFIX = "+05:30";

function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// Date-wise Collection & Settlement Reporting: the UTC instants
// corresponding to 00:00:00.000 and 23:59:59.999 of `businessDateStr`
// ("YYYY-MM-DD") in Asia/Kolkata. Used instead of startOfDay()/Date
// arithmetic anywhere a report needs to line up with what the restaurant
// actually calls "10 August" — startOfDay() alone uses the server's own
// timezone, which is wrong the moment the server itself isn't running in
// IST (e.g. UTC in production), silently shifting the day boundary by up
// to 5.5 hours.
function istDayBounds(businessDateStr) {
  return {
    start: new Date(`${businessDateStr}T00:00:00.000${IST_SUFFIX}`),
    end: new Date(`${businessDateStr}T23:59:59.999${IST_SUFFIX}`),
  };
}

// Shared date-range resolver for History and Analytics/Reports —
// mirrors the same "today" default + named ranges pattern already used by
// paymentAnalyticsController.js, plus an explicit custom range. Every named
// range is anchored to the restaurant's Asia/Kolkata business date (see
// istDayBounds above) rather than the server's local clock.
function resolveRange(query) {
  const now = new Date();
  const todayStr = getBusinessDate(now);
  const { start: todayStart } = istDayBounds(todayStr);

  switch (query.range) {
    case "yesterday": {
      const y0 = new Date(todayStart.getTime() - DAY_MS);
      const y1 = new Date(todayStart.getTime() - 1);
      return { from: y0, to: y1 };
    }
    case "7d":
      // Today plus the 6 days before it = 7 days inclusive.
      return { from: new Date(todayStart.getTime() - 6 * DAY_MS), to: now };
    case "30d":
    case "lastMonth":
      return { from: new Date(todayStart.getTime() - 29 * DAY_MS), to: now };
    // Date-wise Collection & Settlement Reporting: calendar month-to-date
    // in IST, e.g. selected on 11 Aug -> 1 Aug 00:00 IST through now.
    case "thisMonth": {
      const monthStartStr = `${todayStr.slice(0, 7)}-01`;
      const { start: monthStart } = istDayBounds(monthStartStr);
      return { from: monthStart, to: now };
    }
    case "custom": {
      const fromStr = query.from || todayStr;
      const toStr = query.to || todayStr;
      const { start } = istDayBounds(fromStr);
      const { end } = istDayBounds(toStr);
      return { from: start, to: end };
    }
    case "today":
    default:
      return { from: todayStart, to: new Date(todayStart.getTime() + DAY_MS - 1) };
  }
}

// GET /api/admin/settlements?restaurantId=&search=&status=&method=
// Powers the main Settlement Table (Pending Settlements view by default —
// pass status=pending from the frontend for that tab).
const listSettlements = asyncHandler(async (req, res) => {
  const { restaurantId, search, status, method, collectionStatus } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const filter = { restaurantId };
  if (status && PAYMENT_STATUSES.includes(status)) filter.paymentStatus = status;
  // Payment Collection Tracking: separate from the workflow `status` filter
  // above — lets the Settlements page filter "show me every PARTIALLY_PAID
  // bill" regardless of whether it's still pending or already collected.
  if (collectionStatus && COLLECTION_STATUSES.includes(collectionStatus)) {
    filter.collectionStatus = collectionStatus;
  }
  // Split Payments: a settlement can carry several methods at once, so
  // "filter by method" means "this method appears somewhere in the
  // breakdown" rather than an exact single-value match.
  if (method && PAYMENT_METHODS.includes(method)) filter.paymentMethods = { $elemMatch: { method } };

  if (search) {
    const regex = new RegExp(String(search).trim(), "i");
    filter.$or = [
      { billNumber: regex },
      { customerName: regex },
      { phoneNumber: regex },
      { tableLabel: regex },
    ];
  }

  const settlements = await Settlement.find(filter).sort({ submittedAt: -1 }).limit(500).lean();
  res.json({ settlements });
});

// GET /api/admin/settlements/:id  (id = settlementId, e.g. "STL-000123")
// Full detail for the Collect Payment modal: bill number, customer,
// table, ordered items, subtotal/tax/grand total.
const getSettlement = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findOne({ settlementId: req.params.id });
  if (!settlement) throw new ApiError(404, "Settlement not found");

  const orders = await Order.find({ orderId: { $in: settlement.orderIds } }).sort({ placedAt: 1 });

  // Same "sum matching line items together" aggregation used by the
  // Tables billing popup (TableDetailsDrawer) so the two never disagree.
  //
  // Menu Item Customization (Modifiers): the merge key includes each
  // line's modifiers (sorted so selection order never matters), so e.g.
  // "Chicken Penne Pasta — Red Sauce" and "Chicken Penne Pasta — Mixed
  // Sauce" are kept as two separate rows instead of being summed together
  // into one misleading "2 x Chicken Penne Pasta" — see the KOT
  // requirement this mirrors in lib/printer/kot.ts.
  const modifierKey = (modifiers) =>
    (modifiers || [])
      .map((m) => `${m.groupId}:${m.optionId}`)
      .sort()
      .join("|");

  const byKey = new Map();
  for (const order of orders) {
    for (const it of order.items) {
      const key = `${it.item.name}__${it.item.price}__${modifierKey(it.modifiers)}`;
      const existing = byKey.get(key);
      if (existing) existing.quantity += it.quantity;
      else
        byKey.set(key, {
          name: it.item.name,
          price: it.item.price,
          quantity: it.quantity,
          modifiers: it.modifiers || [],
        });
    }
  }

  res.json({ settlement, items: Array.from(byKey.values()) });
});

// POST /api/admin/settlements
// Body: { tableId }
// Direct API equivalent of the Tables billing popup's "Submit Bill" — see
// services/settlementService.js for the shared implementation.
const createSettlement = asyncHandler(async (req, res) => {
  const { tableId } = req.body;
  if (!tableId) throw new ApiError(400, "tableId is required");

  const { table, session, settlement } = await submitBillForTable(tableId, req.staff);
  res.status(201).json({ table, session, settlement });
});

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

// Payment Collection Tracking: classifies how much of the bill has
// actually been received. UNPAID takes priority over PARTIALLY_PAID when
// totalReceived is exactly 0, matching the business rule (PAID when
// received >= grandTotal, UNPAID when received == 0, PARTIALLY_PAID
// otherwise).
function resolveCollectionStatus(totalReceived, grandTotal) {
  if (totalReceived <= 0) return "UNPAID";
  if (totalReceived >= grandTotal) return "PAID";
  return "PARTIALLY_PAID";
}

// PATCH /api/admin/settlements/:id
// Body: { paymentMethods: [{ method, amount }], receivedBy?, remarks?, dueDate? }
// The "Complete Settlement" action from the Collect Payment modal. This is
// the moment the dining session actually closes and the table is freed —
// for every payment breakdown, including one that contains Credit (that
// portion is simply recorded as outstanding instead of collected).
const collectSettlement = asyncHandler(async (req, res) => {
  const settlement = await Settlement.findOne({ settlementId: req.params.id });
  if (!settlement) throw new ApiError(404, "Settlement not found");
  if (settlement.paymentStatus !== "pending") {
    throw new ApiError(400, "This settlement has already been collected");
  }

  const { paymentMethods, receivedBy, remarks, dueDate } = req.body;

  // ---- Payment Breakdown validation ----
  // Business rule: the admin can ALWAYS complete a settlement, even with
  // nothing collected — so an empty/omitted breakdown is valid (a ₹0
  // received settlement) rather than an error. We still validate the
  // *shape* of whatever was submitted (a bad method name, a duplicate
  // method, a negative amount are data-integrity problems, not a
  // payment-mismatch), but never reject based on how the total compares to
  // grandTotal.
  const rawEntries = paymentMethods === undefined || paymentMethods === null ? [] : paymentMethods;
  if (!Array.isArray(rawEntries)) {
    throw new ApiError(400, "paymentMethods must be an array");
  }

  const seen = new Set();
  const normalized = [];
  for (const entry of rawEntries) {
    const method = entry?.method;
    const amount = Number(entry?.amount);
    if (!PAYMENT_METHODS.includes(method)) {
      throw new ApiError(400, `paymentMethod must be one of ${PAYMENT_METHODS.join(", ")}`);
    }
    if (seen.has(method)) {
      throw new ApiError(400, `Payment method "${method}" was selected more than once`);
    }
    seen.add(method);
    if (!Number.isFinite(amount) || amount < 0) {
      throw new ApiError(400, "Payment amounts cannot be negative");
    }
    // A method left at ₹0 simply wasn't used — drop it rather than error,
    // so the cashier can leave a method checked without being forced to
    // enter a positive amount for it (e.g. a genuine ₹0 collection).
    if (amount > 0) normalized.push({ method, amount: round2(amount) });
  }

  // Every amount shown to the cashier (Grand Total, item prices, the
  // breakdown itself) is rounded to whole rupees on screen. grandTotal can
  // carry paise-level fractions from tax math (e.g. 544.45); round the same
  // way the UI does so the stored totals match what was shown on screen.
  const grandTotal = Math.round(settlement.grandTotal);

  // Payment Collection Tracking: totalReceived only counts money that was
  // actually collected right now — Credit is excluded since it's a promise
  // to pay later, not cash/UPI/card/bank transfer in hand (it's tracked
  // separately via outstandingAmount below). No comparison against
  // grandTotal ever throws here — full, partial, zero, and over payment are
  // all accepted; collectionStatus/remainingAmount simply record which one
  // this was.
  const receivedEntries = normalized.filter((e) => e.method !== "credit");
  const totalReceived = round2(receivedEntries.reduce((sum, e) => sum + e.amount, 0));
  const remainingAmount = round2(grandTotal - totalReceived);
  const collectionStatus = resolveCollectionStatus(totalReceived, grandTotal);

  const creditAmount = round2(
    normalized.filter((e) => e.method === "credit").reduce((sum, e) => sum + e.amount, 0)
  );
  const now = new Date();
  settlement.paymentMethods = normalized;
  // Legacy convenience field — only meaningful for a true single-method
  // settlement; left null for an actual split so nothing misreads it as
  // "the" payment method.
  settlement.paymentMethod = normalized.length === 1 ? normalized[0].method : null;
  settlement.receivedBy = receivedBy?.trim() || req.staff?.name || req.staff?.email || null;
  settlement.remarks = remarks?.trim() || "";
  settlement.settlementTime = now;
  settlement.totalReceived = totalReceived;
  settlement.remainingAmount = remainingAmount;
  settlement.collectionStatus = collectionStatus;

  if (creditAmount > 0) {
    // Bill has a Credit (Pay Later) component — fully or partially split —
    // so the settlement stays "credit" until that portion is cleared, same
    // as the Credit Customers tab / clearCreditBalance already expect.
    settlement.paymentStatus = "credit";
    settlement.outstandingAmount = creditAmount;
    settlement.dueDate = dueDate ? new Date(dueDate) : null;
  } else {
    settlement.paymentStatus = "paid";
    settlement.outstandingAmount = 0;
    settlement.dueDate = null;
  }

  // Best-effort link to an existing Customer record (by phone) — never
  // creates one here, since Customer creation/stat-tracking already
  // happens at checkout (services/orderService.js:upsertCustomerFromOrder).
  if (settlement.phoneNumber) {
    const customer = await Customer.findOne({
      restaurantId: settlement.restaurantId,
      phone: settlement.phoneNumber,
    });
    if (customer) settlement.customerId = customer._id;
  }

  await settlement.save();

  // Close the dining session and free the table — deferred all the way
  // from Submit Bill until right now, per the Settlements Module workflow.
  const session = await TableSession.findOne({ sessionId: settlement.sessionId });
  if (session && session.status === "active") {
    session.status = "closed";
    session.sessionEnd = now;
    await session.save();
    emitSessionEnded(session);
  }

  const table = await Table.findById(settlement.tableId);
  if (table) {
    table.status = "available";
    table.currentSessionId = null;
    table.currentReservationId = null;
    table.occupiedAt = null;
    await table.save();
    emitTableAvailable(table);
  }

  emitSettlementUpdated(settlement);
  res.json({ settlement, table, session });
});

// GET /api/admin/settlements/history?restaurantId=&range=&from=&to=
// Settlement History tab — every completed settlement (Paid or Credit),
// filterable by Today / Yesterday / Last 7 Days / Last Month / Custom.
const getSettlementHistory = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const { from, to } = resolveRange(req.query);

  const settlements = await Settlement.find({
    restaurantId,
    paymentStatus: { $in: ["paid", "credit"] },
    settlementTime: { $gte: from, $lte: to },
  })
    .sort({ settlementTime: -1 })
    .limit(500);

  res.json({ settlements, range: { from, to } });
});

// GET /api/admin/settlements/credits?restaurantId=
// Credit Customers tab — one row per customer with a currently-outstanding
// balance, aggregated across every Credit settlement they have.
const getCreditCustomers = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  // Split Payments: a Credit portion can now live inside a mixed
  // paymentMethods breakdown (e.g. Cash + Credit), so "has an outstanding
  // credit balance" is keyed off outstandingAmount rather than the legacy
  // single-value paymentMethod field.
  const rows = await Settlement.aggregate([
    { $match: { restaurantId, outstandingAmount: { $gt: 0 }, phoneNumber: { $ne: "" } } },
    {
      $group: {
        _id: "$phoneNumber",
        customerName: { $last: "$customerName" },
        outstandingBalance: { $sum: "$outstandingAmount" },
        lastVisit: { $max: "$settlementTime" },
        dueDate: { $min: "$dueDate" },
      },
    },
    { $match: { outstandingBalance: { $gt: 0 } } },
    { $sort: { lastVisit: -1 } },
  ]);

  const now = new Date();
  res.json({
    customers: rows.map((r) => ({
      phoneNumber: r._id,
      customerName: r.customerName,
      outstandingBalance: r.outstandingBalance,
      lastVisit: r.lastVisit,
      dueDate: r.dueDate,
      status: r.dueDate && new Date(r.dueDate) < now ? "overdue" : "pending",
    })),
  });
});

// PATCH /api/admin/settlements/credits/:phone/clear
// Body: { restaurantId, receivedBy?, remarks? }
// "When the customer visits again ... allow the cashier to receive payment
// and clear the outstanding balance." Clears every outstanding Credit
// settlement for this phone number in one action.
const clearCreditBalance = asyncHandler(async (req, res) => {
  const { restaurantId, receivedBy, remarks } = req.body;
  const phone = req.params.phone;
  if (!restaurantId) throw new ApiError(400, "restaurantId is required");

  // Split Payments: Credit may be only part of a mixed breakdown, so the
  // legacy single-value paymentMethod field can be null here — match on
  // outstandingAmount instead, same as getCreditCustomers above.
  const settlements = await Settlement.find({
    restaurantId,
    phoneNumber: phone,
    outstandingAmount: { $gt: 0 },
  });

  if (settlements.length === 0) {
    throw new ApiError(404, "No outstanding credit balance found for this customer");
  }

  const now = new Date();
  for (const s of settlements) {
    // Payment Collection Tracking: the outstanding Credit amount is now
    // actually in hand, so fold it into totalReceived before zeroing it out
    // — otherwise a bill that was PARTIALLY_PAID/UNPAID would stay that way
    // forever even after the customer paid off their credit balance.
    const grandTotal = Math.round(s.grandTotal);
    s.totalReceived = round2((s.totalReceived || 0) + s.outstandingAmount);
    s.remainingAmount = round2(grandTotal - s.totalReceived);
    s.collectionStatus = resolveCollectionStatus(s.totalReceived, grandTotal);
    s.outstandingAmount = 0;
    s.paymentStatus = "paid";
    s.receivedBy = receivedBy?.trim() || s.receivedBy;
    s.remarks = remarks?.trim() ? `${s.remarks ? `${s.remarks} | ` : ""}${remarks.trim()}`.slice(0, 500) : s.remarks;
    s.settlementTime = now;
    await s.save();
    emitSettlementUpdated(s);
  }

  res.json({ cleared: settlements.length });
});

// GET /api/admin/settlements/analytics?restaurantId=&range=&from=&to=
// Powers both the Settlements dashboard overview cards (today-scoped
// fields) and the Reports section (range-scoped `reports` block).
const getSettlementAnalytics = asyncHandler(async (req, res) => {
  const { restaurantId } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const { from, to } = resolveRange(req.query);

  // Discount Tracking Module: same restaurantId + submittedAt-range match as
  // billedAgg above (a settlement is "billed"/complete the moment Submit
  // Bill locks it in — see services/settlementService.js), with cancelled
  // settlements excluded per spec ("only completed bills, ignore
  // cancelled"). Computed in the database via aggregation (not fetched into
  // memory) so this stays fast as the settlements collection grows.
  const discountMatch = {
    restaurantId,
    submittedAt: { $gte: from, $lte: to },
    paymentStatus: { $ne: "cancelled" },
  };

  const [
    billedAgg,
    collectedAgg,
    pendingAgg,
    creditAgg,
    revenueAgg,
    splitAgg,
    collectionStatusAgg,
    discountSummaryAgg,
    offerPerformanceAgg,
  ] = await Promise.all([
    Settlement.aggregate([
      { $match: { restaurantId, submittedAt: { $gte: from, $lte: to } } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    // Split Payments: unwind each settlement's payment breakdown so a
    // single ₹544 bill paid as Cash ₹200 + UPI ₹344 correctly contributes
    // ₹200 to Cash and ₹344 to Online, instead of being grouped under one
    // method as a whole. Credit entries are excluded here — that money
    // hasn't actually been received yet (see creditAgg below).
    Settlement.aggregate([
      {
        $match: {
          restaurantId,
          paymentStatus: { $in: ["paid", "credit"] },
          settlementTime: { $gte: from, $lte: to },
        },
      },
      { $unwind: "$paymentMethods" },
      { $match: { "paymentMethods.method": { $ne: "credit" } } },
      { $group: { _id: "$paymentMethods.method", total: { $sum: "$paymentMethods.amount" } } },
    ]),
    Settlement.aggregate([
      { $match: { restaurantId, paymentStatus: "pending" } },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    // Outstanding balance is tracked directly on the settlement
    // (outstandingAmount), so this works the same whether Credit was the
    // only method or just one part of a split.
    Settlement.aggregate([
      { $match: { restaurantId, outstandingAmount: { $gt: 0 } } },
      { $group: { _id: "$phoneNumber", total: { $sum: "$outstandingAmount" } } },
    ]),
    Settlement.aggregate([
      {
        $match: {
          restaurantId,
          paymentStatus: { $in: ["paid", "credit"] },
          settlementTime: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    // Settlements paid across 2+ methods — powers the Reports "Split
    // Payments" figure.
    Settlement.aggregate([
      {
        $match: {
          restaurantId,
          paymentStatus: { $in: ["paid", "credit"] },
          settlementTime: { $gte: from, $lte: to },
          $expr: { $gte: [{ $size: "$paymentMethods" }, 2] },
        },
      },
      { $group: { _id: null, total: { $sum: "$grandTotal" } } },
    ]),
    // Payment Collection Tracking: how many completed settlements in this
    // range are PAID / PARTIALLY_PAID / UNPAID, and how much money is still
    // outstanding on the partially/un-paid ones — powers the Reports
    // "Partial Payments" figure (previously always 0) plus the new
    // Collection Status breakdown.
    Settlement.aggregate([
      {
        $match: {
          restaurantId,
          paymentStatus: { $in: ["paid", "credit"] },
          settlementTime: { $gte: from, $lte: to },
        },
      },
      { $group: { _id: "$collectionStatus", count: { $sum: 1 }, remaining: { $sum: "$remainingAmount" } } },
    ]),
    // Discount Tracking Module: Gross Sales / Discounts / Taxable Amount /
    // GST / Net Revenue in a single grouped pass over discountMatch.
    Settlement.aggregate([
      { $match: discountMatch },
      {
        $group: {
          _id: null,
          grossSales: { $sum: "$subtotal" },
          totalDiscount: { $sum: "$discount" },
          taxableAmount: { $sum: "$taxableAmount" },
          gstCollected: { $sum: { $add: [{ $ifNull: ["$cgstAmount", 0] }, { $ifNull: ["$sgstAmount", 0] }] } },
          netRevenue: { $sum: "$grandTotal" },
        },
      },
    ]),
    // Discount Tracking Module: Offer Performance table — how many times
    // each offer was used and the total discount it gave, in this range.
    // Grouped by offerId when available (added alongside offerName — see
    // models/Settlement.js) and falls back to offerName for any settlement
    // billed before that field existed, so historical discount data isn't
    // dropped from the table.
    Settlement.aggregate([
      { $match: { ...discountMatch, discount: { $gt: 0 } } },
      {
        $group: {
          _id: { $ifNull: ["$offerId", "$offerName"] },
          offerId: { $first: "$offerId" },
          offerName: { $first: "$offerName" },
          timesUsed: { $sum: 1 },
          totalDiscount: { $sum: "$discount" },
        },
      },
      { $sort: { totalDiscount: -1 } },
    ]),
  ]);

  const byMethod = Object.fromEntries(collectedAgg.map((r) => [r._id, r.total]));
  const cashCollected = byMethod.cash || 0;
  // Additive breakdown for the Dashboard's payment-method cards. Sourced
  // from the same byMethod aggregation as cashCollected/onlineCollected
  // above, so it can never drift out of sync with them. Existing fields
  // (cashCollected, onlinePayments, reports.*) are untouched by this.
  const upiCollected = byMethod.upi || 0;
  const cardCollected = byMethod.card || 0;
  // Everything collected that isn't cash counts as "online" (upi, card,
  // bank_transfer, and any online method added later) — collectedAgg only
  // ever contains actually-received amounts (credit entries excluded
  // above), so this never double-counts an outstanding credit portion.
  const totalCollected = Object.values(byMethod).reduce((sum, amount) => sum + amount, 0);
  const onlineCollected = totalCollected - cashCollected;
  const totalCreditOutstanding = creditAgg.reduce((sum, r) => sum + r.total, 0);
  const pendingCollection = pendingAgg[0]?.total || 0;

  // Payment Collection Tracking: fold the per-status aggregation into a
  // simple { PAID, PARTIALLY_PAID, UNPAID } map for both the count and the
  // still-outstanding amount.
  const collectionCounts = { PAID: 0, PARTIALLY_PAID: 0, UNPAID: 0 };
  const collectionRemaining = { PAID: 0, PARTIALLY_PAID: 0, UNPAID: 0 };
  for (const row of collectionStatusAgg) {
    if (row._id && collectionCounts[row._id] !== undefined) {
      collectionCounts[row._id] = row.count;
      collectionRemaining[row._id] = row.remaining || 0;
    }
  }
  // "Partial Payments" in the Reports card = money still owed on
  // settlements that were completed without being fully paid.
  const partialPaymentsOutstanding = round2(
    collectionRemaining.PARTIALLY_PAID + collectionRemaining.UNPAID
  );

  // Discount Tracking Module
  const discountSummary = discountSummaryAgg[0] || {
    grossSales: 0,
    totalDiscount: 0,
    taxableAmount: 0,
    gstCollected: 0,
    netRevenue: 0,
  };
  const offersUsed = offerPerformanceAgg.map((r) => ({
    offerId: r.offerId ? String(r.offerId) : null,
    offerName: r.offerName || "Unknown Offer",
    timesUsed: r.timesUsed,
    totalDiscount: round2(r.totalDiscount),
  }));

  res.json({
    range: { from, to },
    // Overview cards (Section 3)
    todaysSales: billedAgg[0]?.total || 0,
    pendingCollection,
    cashCollected,
    onlinePayments: onlineCollected,
    // Additive: payment-method breakdown for the Dashboard's new cards.
    // Does not replace or alter cashCollected / onlinePayments above.
    upiCollected,
    cardCollected,
    creditCustomers: creditAgg.length,
    // Payment Collection Tracking: how many completed settlements in this
    // range fall into each collection bucket, and how much is still owed
    // on the PARTIALLY_PAID / UNPAID ones.
    collectionSummary: {
      paid: collectionCounts.PAID,
      partiallyPaid: collectionCounts.PARTIALLY_PAID,
      unpaid: collectionCounts.UNPAID,
      outstandingFromPartialOrUnpaid: partialPaymentsOutstanding,
    },
    // Discount Tracking Module: "Today's Discounts" KPI card + Discount
    // Summary + Offer Performance sections on the Dashboard. Same range as
    // every other field on this response (today by default), only completed
    // (non-cancelled) settlements. Matches the analytics API contract:
    // { grossSales, totalDiscount, taxableAmount, gstCollected, netRevenue,
    //   offersUsed: [{ offerId, offerName, timesUsed, totalDiscount }] }
    grossSales: round2(discountSummary.grossSales || 0),
    totalDiscount: round2(discountSummary.totalDiscount || 0),
    taxableAmount: round2(discountSummary.taxableAmount || 0),
    gstCollected: round2(discountSummary.gstCollected || 0),
    netRevenue: round2(discountSummary.netRevenue || 0),
    offersUsed,
    reports: {
      totalCashCollection: cashCollected,
      totalOnlineCollection: onlineCollected,
      totalCreditOutstanding,
      pendingCollections: pendingCollection,
      todaysRevenue: revenueAgg[0]?.total || 0,
      // Split Payments Module: total value of settlements paid across 2+
      // payment methods in this range.
      splitPayments: splitAgg[0]?.total || 0,
      // Refunds aren't modeled yet — always 0 until that flow is built.
      refunds: 0,
      // Payment Collection Tracking: money still outstanding on settlements
      // that were completed as PARTIALLY_PAID or UNPAID in this range.
      partialPayments: partialPaymentsOutstanding,
    },
  });
});

// GET /api/admin/settlements/reports
//   ?restaurantId=&range=today|yesterday|7d|30d|thisMonth|custom&from=&to=
//   &method=cash|upi|card|bank_transfer|credit&status=&collectionStatus=
//
// Date-wise Collection & Settlement Reporting (Settlements -> Reports):
// powers the date/range picker, summary cards, payment-method breakdown,
// daily trend/table and transaction list all from one call, so every
// figure on the page is guaranteed to come from the same underlying query
// instead of drifting apart across separate requests.
//
// Every bill is bucketed by the date money actually moved
// (settlementTime), falling back to submittedAt only for bills that
// haven't been collected at all yet (still "pending", or an unpaid Credit
// balance never has a second settlementTime) — so a bill submitted 10 Aug
// 11:50 PM and settled 11 Aug 12:10 AM correctly lands under 11 Aug, per
// the module spec, while a same-day-but-uncollected bill still shows up
// under the day it happened instead of silently disappearing from the
// report. Day buckets use Asia/Kolkata (see resolveRange/istDayBounds
// above) so this is correct regardless of the server's own timezone.
const getDateWiseReport = asyncHandler(async (req, res) => {
  const { restaurantId, method, status, collectionStatus } = req.query;
  if (!restaurantId) throw new ApiError(400, "restaurantId query param is required");

  const { from, to } = resolveRange(req.query);
  if (from > to) throw new ApiError(400, "From date must be before or equal to To date");

  const effectiveDate = { $ifNull: ["$settlementTime", "$submittedAt"] };

  const match = {
    restaurantId,
    // Cancelled bills are never counted as collected revenue, matching
    // getSettlementAnalytics — a restaurant's collection report should not
    // include money that was never actually taken.
    paymentStatus: { $ne: "cancelled" },
    $expr: { $and: [{ $gte: [effectiveDate, from] }, { $lte: [effectiveDate, to] }] },
  };
  if (status && PAYMENT_STATUSES.includes(status)) match.paymentStatus = status;
  if (collectionStatus && COLLECTION_STATUSES.includes(collectionStatus)) {
    match.collectionStatus = collectionStatus;
  }
  // A bill counts toward a method filter if any part of it was paid that
  // way — correct for split payments (e.g. filtering "Cash" still surfaces
  // a Cash+UPI bill, and its real UPI portion still lands under UPI in the
  // breakdown below, rather than being misattributed).
  if (method && PAYMENT_METHODS.includes(method)) match["paymentMethods.method"] = method;

  const [summaryAgg, methodAgg, dailyAgg, dailyMethodAgg, transactions] = await Promise.all([
    Settlement.aggregate([
      { $match: match },
      {
        $group: {
          _id: null,
          totalSales: { $sum: "$grandTotal" },
          totalBills: { $sum: 1 },
          totalDiscount: { $sum: { $ifNull: ["$discount", 0] } },
          // Not-yet-collected money: bills still "pending" in full, plus
          // whatever shortfall remains on bills that were completed
          // without being fully paid (Credit or a partial collection).
          pendingGrandTotal: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$grandTotal", 0] } },
          shortfall: { $sum: { $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0] } },
        },
      },
    ]),
    // Payment-method breakdown: unwind so a split bill (e.g. Cash ₹600 +
    // UPI ₹400) contributes to each method separately instead of being
    // grouped under just one. Credit lines are excluded — that portion
    // hasn't actually been received (it's covered by pendingGrandTotal /
    // shortfall above, surfaced as Credit/Pending).
    Settlement.aggregate([
      { $match: match },
      { $unwind: "$paymentMethods" },
      { $match: { "paymentMethods.method": { $ne: "credit" } } },
      { $group: { _id: "$paymentMethods.method", total: { $sum: "$paymentMethods.amount" } } },
    ]),
    // Date-wise breakdown table + daily trend chart, one row per Kolkata
    // calendar day in range.
    Settlement.aggregate([
      { $match: match },
      { $addFields: { _bucketDate: effectiveDate } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$_bucketDate", timezone: "Asia/Kolkata" } },
          bills: { $sum: 1 },
          totalSales: { $sum: "$grandTotal" },
          discount: { $sum: { $ifNull: ["$discount", 0] } },
          pendingGrandTotal: { $sum: { $cond: [{ $eq: ["$paymentStatus", "pending"] }, "$grandTotal", 0] } },
          shortfall: { $sum: { $cond: [{ $gt: ["$remainingAmount", 0] }, "$remainingAmount", 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]),
    // Same per-method split as methodAgg above, but grouped per day too —
    // powers the Cash/UPI/Card columns of the daily breakdown table.
    Settlement.aggregate([
      { $match: match },
      { $addFields: { _bucketDate: effectiveDate } },
      { $unwind: "$paymentMethods" },
      { $match: { "paymentMethods.method": { $ne: "credit" } } },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: "%Y-%m-%d", date: "$_bucketDate", timezone: "Asia/Kolkata" } },
            method: "$paymentMethods.method",
          },
          total: { $sum: "$paymentMethods.amount" },
        },
      },
    ]),
    // Transaction Details table — reuses the exact Settlement fields
    // already shown on Settlement History, so no new bill-level data model
    // is introduced for the report.
    Settlement.find(match)
      .select(
        "settlementId billNumber tableLabel customerName phoneNumber grandTotal totalReceived remainingAmount paymentMethods paymentMethod paymentStatus collectionStatus settlementTime submittedAt receivedBy"
      )
      .sort({ submittedAt: -1 })
      .limit(1000)
      .lean(),
  ]);

  const summary = summaryAgg[0] || {
    totalSales: 0,
    totalBills: 0,
    totalDiscount: 0,
    pendingGrandTotal: 0,
    shortfall: 0,
  };
  const methodTotals = Object.fromEntries(methodAgg.map((r) => [r._id, r.total]));
  const cashCollected = round2(methodTotals.cash || 0);
  const upiCollected = round2(methodTotals.upi || 0);
  const cardCollected = round2(methodTotals.card || 0);
  const bankTransferCollected = round2(methodTotals.bank_transfer || 0);
  const onlineCollected = round2(upiCollected + cardCollected + bankTransferCollected);
  const creditPending = round2((summary.pendingGrandTotal || 0) + (summary.shortfall || 0));

  const dailyMethodMap = {};
  for (const row of dailyMethodAgg) {
    const { date, method: m } = row._id;
    if (!dailyMethodMap[date]) dailyMethodMap[date] = {};
    dailyMethodMap[date][m] = row.total;
  }

  const dailyBreakdown = dailyAgg.map((row) => {
    const methods = dailyMethodMap[row._id] || {};
    const cash = round2(methods.cash || 0);
    const upi = round2(methods.upi || 0);
    const card = round2(methods.card || 0);
    const bankTransfer = round2(methods.bank_transfer || 0);
    return {
      date: row._id,
      bills: row.bills,
      cash,
      upi,
      card,
      onlinePayments: round2(upi + card + bankTransfer),
      creditPending: round2((row.pendingGrandTotal || 0) + (row.shortfall || 0)),
      discounts: round2(row.discount || 0),
      totalSales: round2(row.totalSales || 0),
    };
  });

  res.json({
    range: { from, to },
    filters: { method: method || null, status: status || null, collectionStatus: collectionStatus || null },
    summary: {
      totalSales: round2(summary.totalSales || 0),
      totalBills: summary.totalBills || 0,
      cashCollected,
      upiCollected,
      cardCollected,
      bankTransferCollected,
      onlineCollected,
      creditPending,
      totalDiscount: round2(summary.totalDiscount || 0),
    },
    paymentMethodBreakdown: {
      cash: cashCollected,
      upi: upiCollected,
      card: cardCollected,
      bankTransfer: bankTransferCollected,
      credit: creditPending,
    },
    dailyBreakdown,
    // Report is capped at the 1000 most-recently-submitted matching bills —
    // generous for a single restaurant's typical volume even over "This
    // Month", while keeping the response bounded. `summary`/`dailyBreakdown`
    // above are always computed by the database over the full matching set
    // regardless of this cap, so totals stay accurate even if it's hit.
    transactionsTruncated: transactions.length >= 1000,
    transactions,
  });
});

module.exports = {
  listSettlements,
  getSettlement,
  createSettlement,
  collectSettlement,
  getSettlementHistory,
  getCreditCustomers,
  clearCreditBalance,
  getSettlementAnalytics,
  getDateWiseReport,
};