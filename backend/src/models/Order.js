const mongoose = require("mongoose");
const { customAlphabet } = require("nanoid");

const ORDER_STATUSES = ["pending", "preparing", "ready", "completed", "cancelled"];

// Item-Level Order Management: every ordered line now carries its own
// status through the same pending -> preparing -> ready -> completed
// lifecycle as the order used to as a whole (or "cancelled" at any point).
// The order's own `status` (below) is no longer set directly by staff for
// item-level actions — it's derived from these (see
// services/orderService.js:computeOrderStatusFromItems) so it never
// disagrees with what's actually happening to each item.
const ORDER_ITEM_STATUSES = ORDER_STATUSES;

// Short, unambiguous id for addressing one line within an order (e.g.
// PATCH /api/admin/orders/:orderId/items/:lineId/status). Array index isn't
// stable/addressable enough once items can be independently completed or
// cancelled out of order, so every line gets its own id at creation time —
// same alphabet/shape as generateOrderId, just scoped to one order instead
// of globally unique.
const lineIdAlphabet = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 8);
function generateLineId() {
  return `LN-${lineIdAlphabet()}`;
}

// Menu Item Customization (Modifiers): the customer's selected option(s)
// for one modifier group on this line, snapshotted at order time — same
// reasoning as the `item` snapshot below: if the menu's modifier groups
// change later, historical orders keep showing exactly what was ordered.
// One entry per group the customer made a selection in (a required
// single-choice group always contributes exactly one entry per order line).
const orderItemModifierSchema = new mongoose.Schema(
  {
    groupId: { type: String, required: true },
    groupName: { type: String, required: true }, // e.g. "Sauce"
    optionId: { type: String, required: true },
    optionName: { type: String, required: true }, // e.g. "Mushroom Sauce"
    priceDelta: { type: Number, default: 0 },
  },
  { _id: false }
);

// A snapshot of the menu item at the time it was ordered, so historical
// orders don't change if you later edit prices/names in the menu.
const orderItemSchema = new mongoose.Schema(
  {
    // Item-Level Order Management: stable per-line identifier, generated
    // once when the order is placed (see services/orderService.js). Falls
    // back to `default` so it's always populated even for lines built
    // before this field existed via older code paths that forgot to set it.
    lineId: { type: String, default: generateLineId },
    item: {
      id: { type: String, required: true },
      name: { type: String, required: true },
      description: { type: String, default: "" },
      price: { type: Number, required: true },
      diet: { type: String, enum: ["veg", "non-veg"], required: true },
      image: { type: String, default: "" },
      // Snapshotted from MenuItem at order time (see models/MenuItem.js) so
      // KOT printing can route each line to the Kitchen or Counter printer
      // by category — see frontend lib/printer/kot.ts. Defaulted to "" so
      // historical orders created before this field existed still validate.
      categoryId: { type: String, default: "" },
      categoryTitle: { type: String, default: "" },
    },
    quantity: { type: Number, required: true, min: 1 },
    // Per-line customization, e.g. "No Onion", "Extra Cheese", "Less Ice".
    // Optional and free-text — added for Admin Manual Ordering (Tables & QR
    // -> Create Order) but available to any order source since it lives on
    // the line item itself, not the top-level order.
    notes: { type: String, default: "" },

    // Menu Item Customization (Modifiers): the selected sauce (or any
    // future required/optional modifier) for this exact line, e.g.
    // [{ group: "Sauce", option: "Red Sauce" }] carried through everywhere
    // this line is shown — cart, checkout, Admin Order Details, KOT,
    // Billing. Defaults to [] so every pre-existing order (and every line
    // for a non-customizable item) is unaffected. Two cart lines for the
    // same menu item with different modifiers are never merged — each
    // stays its own array entry with its own quantity (see
    // services/orderService.js validateAndBuildOrder).
    modifiers: { type: [orderItemModifierSchema], default: [] },

    // --- Item-Level Order Management ---
    // Each ordered item is now tracked independently. Defaults to "pending"
    // so every pre-existing order (created before this feature) reads as
    // "still active" rather than silently appearing completed/cancelled.
    status: { type: String, enum: ORDER_ITEM_STATUSES, default: "pending" },
    // GST Management Module: the exact per-line tax breakdown computed at
    // order time (see gstService.computeLineGst), snapshotted here so a
    // later item cancellation can recompute the order's aggregate
    // subtotal/taxableAmount/taxAmount/totalAmount by simply re-summing the
    // *remaining* lines — never by re-deriving GST rates from the menu or
    // today's GST Settings, which could silently drift from what this
    // order actually charged when it was placed. `null` for any line built
    // before this field existed; recomputation falls back to the order's
    // own effectiveGstRate for those (see orderService.js).
    lineSubtotal: { type: Number, default: null },
    lineTaxableAmount: { type: Number, default: null },
    lineTaxAmount: { type: Number, default: null },
    lineTotal: { type: Number, default: null },
    gstSlabUsed: { type: Number, default: null },
  },
  { _id: false }
);

// Where an order originated. Every existing order in the system predates
// this field and is a QR (customer self-order) order, hence the default.
// Kept purely informational — the Kitchen workflow (see
// controllers/orderController.js / the Kitchen Dashboard) is identical for
// every source and never branches on this value.
const ORDER_SOURCES = ["QR", "ADMIN", "WAITER", "ONLINE", "SWIGGY", "ZOMATO"];

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true, index: true },
    sessionId: { type: String, required: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableToken: { type: String, required: true },
    tableLabel: { type: String, default: null }, // resolved friendly name e.g. "Table 4"

    // Daily Token Number System: a snapshot of the dining session's
    // tokenNumber (see models/TableSession.js) at the moment this order was
    // attached to it — kept here purely so KOT printing and the "new-order"
    // broadcast (see services/orderService.js:finalizeOrder) never need an
    // extra session lookup just to print a ticket. This can never drift
    // from the session's own value: a session's tokenNumber is assigned
    // exactly once, at session creation, and every order added to that
    // session afterward is stamped with that same, already-final number —
    // same reasoning as tableLabel above. Null for takeaway/counter orders
    // that never attach to a table session.
    tokenNumber: { type: Number, default: null },

    // Collected once at checkout. Optional so guest checkout keeps working;
    // used to power Customer analytics (see models/Customer.js) once an
    // order reaches "completed".
    customerName: { type: String, default: "" },
    customerPhone: { type: String, default: "", index: true },

    items: { type: [orderItemSchema], required: true },

    subtotal: { type: Number, required: true },
    taxAmount: { type: Number, required: true },
    totalAmount: { type: Number, required: true },

    // GST Management Module: a fuller breakdown of taxAmount, computed
    // per-item from each MenuItem's GST slab (see services/gstService.js)
    // instead of the old single flat rate. Kept alongside the existing
    // subtotal/taxAmount/totalAmount (still the source of truth for every
    // pre-existing revenue calculation) so nothing else in the app has to
    // change to keep working — these fields are purely additive.
    //
    // taxableAmount: the amount GST was actually calculated on. Equals
    // `subtotal` when GST is Exclusive; less than `subtotal` when
    // Inclusive (tax is backed out of the menu price instead of added on
    // top). Falls back to `subtotal` for any order placed before this
    // field existed.
    taxableAmount: { type: Number, default: null },
    cgstAmount: { type: Number, default: 0 },
    sgstAmount: { type: Number, default: 0 },
    // Always 0 today — every order is treated as intra-state. Modeled now
    // (future-ready) so switching an order to inter-state billing later
    // only means populating this instead of cgst/sgst, with no schema
    // change. See GstSettings.igstEnabled.
    igstAmount: { type: Number, default: 0 },
    // Snapshot of GstSettings at the moment this order was placed, so a
    // later settings change (mode flipped, default % changed) never
    // silently rewrites the tax on historical orders/reports.
    gstMode: { type: String, enum: ["inclusive", "exclusive", "disabled"], default: "exclusive" },
    // Weighted-average GST % across this order's line items — e.g. an
    // order mixing a 5% starter and 18% dessert nets some blended rate.
    // Used to keep discount/settlement recalculation (billingCalculator)
    // consistent with however this order's tax was actually built up.
    effectiveGstRate: { type: Number, default: 0 },

    orderType: { type: String, enum: ["dine-in", "takeaway"], required: true },
    specialInstructions: { type: String, default: "" },
    paymentMethod: { type: String, enum: ["cash"], default: "cash", required: true },

    // Admin Manual Ordering (Tables & QR -> Create Order) and future
    // channels (waiter tablets, aggregators) all funnel through the same
    // Order model — this is the only thing that distinguishes them.
    orderSource: { type: String, enum: ORDER_SOURCES, default: "QR", index: true },
    // Populated only when orderSource === "ADMIN" (or "WAITER"), for audit —
    // which staff member created this order from the dashboard.
    placedByStaffId: { type: String, default: null },
    placedByStaffName: { type: String, default: "" },

    // Cash-only checkout: orders stay "pending" until staff collect payment
    // at the counter (see controllers/paymentAnalyticsController.js
    // collectCashPayment), which is the same as "collected but not tracked
    // here" for any pre-existing orders.
    paymentStatus: { type: String, enum: ["pending", "paid"], default: "pending" },

    status: { type: String, enum: ORDER_STATUSES, default: "pending", index: true },
    // Timeline shown on the admin Orders page — one entry per status the
    // order has passed through, in order.
    statusHistory: {
      type: [
        {
          status: { type: String, enum: ORDER_STATUSES, required: true },
          changedAt: { type: Date, default: Date.now },
        },
      ],
      default: () => [{ status: "pending", changedAt: new Date() }],
    },

    placedAt: { type: Date, default: Date.now },
    estimatedMinutes: { type: Number, default: 20 },
  },
  { timestamps: true }
);

orderSchema.statics.STATUSES = ORDER_STATUSES;
orderSchema.statics.SOURCES = ORDER_SOURCES;
orderSchema.statics.ITEM_STATUSES = ORDER_ITEM_STATUSES;

// Performance: every hot-path read in this app (dashboard summary, revenue
// breakdown, analytics, peak-hours, the Orders page, the "live orders"
// dashboard widget) filters by restaurantId and a placedAt range and/or
// status, then sorts by placedAt. Before this, only single-field indexes
// existed (restaurantId, status individually) — Mongo could use at most
// one of them per query and had to scan+sort the rest in memory, which
// gets slower every day as the orders collection grows. These compound
// indexes are what those exact query shapes need:
//   - { restaurantId, placedAt } covers date-range aggregations
//     (revenueBetween, analytics summary/dailyTotals, peak-hours) and any
//     restaurantId+placedAt sort with no status filter.
//   - { restaurantId, status, placedAt } covers status-filtered, date-sorted
//     reads (the dashboard's "live orders" widget, the Orders page's status
//     filter, the Kitchen dashboard).
orderSchema.index({ restaurantId: 1, placedAt: -1 });
orderSchema.index({ restaurantId: 1, status: 1, placedAt: -1 });
// Covers getCustomerOrderHistory (Customers page "Order History" view).
orderSchema.index({ restaurantId: 1, customerPhone: 1, placedAt: -1 });

module.exports = mongoose.model("Order", orderSchema);