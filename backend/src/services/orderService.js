const Order = require("../models/Order");
const Customer = require("../models/Customer");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const Session = require("../models/Session");
const TableSession = require("../models/TableSession");
const Settlement = require("../models/Settlement");
const ApiError = require("../utils/ApiError");
const generateOrderId = require("../utils/generateOrderId");
const generateTableSessionId = require("../utils/generateTableSessionId");
const generateAdminSessionId = require("../utils/generateAdminSessionId");
const createTableSessionWithToken = require("../utils/createTableSessionWithToken");
const {
  emitNewOrder,
  emitTableOccupied,
  emitSessionStarted,
  emitSettlementUpdated,
  emitOrderDeleted,
  emitSessionEnded,
  emitTableAvailable,
  emitOrderStatusUpdate,
} = require("../sockets/socket");
const { deductStockForOrder } = require("./stockService");
const gstService = require("./gstService");

// Legacy flat rate — no longer used to compute order tax (see
// gstService.computeOrderGst, which reads GST Settings + each item's GST
// slab instead), but kept exported since other modules may still import
// it for reference/backward compatibility.
const TAX_RATE = 0.05;

// Menu Item Customization (Modifiers): validates one requested cart line's
// modifier selections against the *menu item's own* modifierGroups (never
// trusting the client for which groups exist, what's required, or what a
// valid option/price is), and returns:
//   - modifiers: the snapshot array to store on the order line (group +
//     option names captured now, so a later menu edit never changes what a
//     historical order shows — same reasoning as the `item` snapshot).
//   - priceDelta: summed extra unit price from the selected options
//     (every sauce today is priceDelta 0, but this keeps the door open for
//     a future paid modifier without another schema/logic change).
//
// Shared by both validateAndBuildOrder (customer QR flow) and
// validateAndBuildAdminOrder (staff manual order), so a required modifier
// can never be skipped no matter which flow places the order — and a
// non-customizable item (no modifierGroups) is a no-op here, exactly as
// before this feature existed.
//
// requestedModifiers: [{ groupId, optionIds: string[] }], as sent by the
// client (see frontend lib/api.ts PlaceOrderPayload). Only groups defined
// on `menuItem.modifierGroups` are ever considered — anything else the
// client sends is silently ignored, not merged into the order.
function resolveLineModifiers(menuItem, requestedModifiers, itemLabel) {
  const groups = menuItem.modifierGroups || [];
  if (groups.length === 0) return { modifiers: [], priceDelta: 0 };

  const requestedByGroupId = new Map(
    (Array.isArray(requestedModifiers) ? requestedModifiers : []).map((m) => [m.groupId, m])
  );

  const modifiers = [];
  let priceDelta = 0;

  for (const group of groups) {
    const requestedGroup = requestedByGroupId.get(group.id);
    const rawIds = Array.isArray(requestedGroup?.optionIds) ? requestedGroup.optionIds : [];
    const selectedIds = [...new Set(rawIds.filter(Boolean))];

    if (group.required && selectedIds.length === 0) {
      throw new ApiError(400, `Please select ${group.name} for "${itemLabel}"`);
    }
    if (group.selectionType === "single" && selectedIds.length > 1) {
      throw new ApiError(400, `Only one ${group.name} option can be selected for "${itemLabel}"`);
    }

    for (const optionId of selectedIds) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option) {
        throw new ApiError(400, `Invalid ${group.name} option selected for "${itemLabel}"`);
      }
      modifiers.push({
        groupId: group.id,
        groupName: group.name,
        optionId: option.id,
        optionName: option.name,
        priceDelta: option.priceDelta || 0,
      });
      priceDelta += option.priceDelta || 0;
    }
  }

  return { modifiers, priceDelta };
}

// Table Management side effect, run after an order is successfully created:
//   - if the table has no active TableSession, create one (assigning the
//     next Daily Token Number — see createTableSessionWithToken.js — since
//     this is the FIRST order of the visit) and mark the table Occupied
//   - if it already has one (from a previous order this visit, or from an
//     admin Check-In), just attach this order and refresh the bill total
//     — its tokenNumber is left untouched, exactly as assigned at creation
// This never throws into the order-creation response — a failure here
// should never block or roll back a successful order, since the customer
// flow must keep working even if the table-management side is degraded.
// Returns the resolved/created session (so finalizeOrder can stamp its
// tokenNumber onto the order), or null if nothing could be resolved.
async function syncTableOccupancyForOrder(table, order) {
  try {
    let session = table.currentSessionId
      ? await TableSession.findOne({ sessionId: table.currentSessionId, status: "active" })
      : await TableSession.findOne({ tableId: table._id, status: "active" });

    if (!session) {
      session = await createTableSessionWithToken({
        sessionId: generateTableSessionId(),
        restaurantId: order.restaurantId,
        tableId: table._id,
        tableToken: table.token,
        // Best-effort, from this (first) order of the visit — see the
        // TableSession model comment. Previously these were left blank,
        // which is why the table popup showed "Walk-in" / "—" even when
        // the customer had typed their name & phone at checkout.
        customerName: order.customerName || "",
        phoneNumber: order.customerPhone || "",
        // Always "cash" — shown in the table popup as "Payment Method".
        // Orders start here and stay "pending" until staff collect payment
        // at the counter.
        paymentMethod: order.paymentMethod || null,
        orderIds: [order.orderId],
        sessionStart: order.placedAt,
        currentBill: order.totalAmount,
        status: "active",
      });

      table.status = "occupied";
      table.currentSessionId = session.sessionId;
      table.occupiedAt = session.sessionStart;
      await table.save();

      emitSessionStarted(session);
      emitTableOccupied(table);
    } else {
      session.orderIds.push(order.orderId);
      session.currentBill += order.totalAmount;
      // Backfill only if still empty — a repeat order from the same visit
      // shouldn't silently overwrite what staff are already seeing (e.g. a
      // different guest at the table, or a method the cashier already
      // picked on the billing screen).
      if (!session.customerName && order.customerName) session.customerName = order.customerName;
      if (!session.phoneNumber && order.customerPhone) session.phoneNumber = order.customerPhone;
      if (!session.paymentMethod && order.paymentMethod) session.paymentMethod = order.paymentMethod;
      await session.save();

      // Defensive re-sync: Table.status and its live TableSession can drift
      // apart — e.g. a data reset that clears Tables back to "available"
      // without also clearing/closing TableSessions (see seed/reset-data.js)
      // leaves an orphaned "active" session behind. Without this, the next
      // order just silently attaches to that orphaned session and the table
      // keeps showing "Available" forever, since this branch used to assume
      // "a live active session exists" already implied "table is Occupied".
      // Scoped to "available" only, so a table already mid-Billing/
      // Awaiting-Payment/etc. isn't yanked back to Occupied.
      if (table.status === "available") {
        table.status = "occupied";
        table.currentSessionId = session.sessionId;
        table.occupiedAt = table.occupiedAt || session.sessionStart;
        await table.save();
        emitTableOccupied(table);
      }
    }

    return session;
  } catch (err) {
    console.error("Table occupancy sync failed (order was still created):", err);
    return null;
  }
}

// Customer Tracking: runs on every successful checkout (cash order created
// immediately, or online order created after payment verification — both
// go through finalizeOrder below). Phone number is the unique customer
// identifier (see models/Customer.js's unique index on
// restaurantId+phone):
//   - unseen phone  -> create a new Customer (firstVisit/lastVisit = now,
//     totalOrders = 1, totalSpent = this order's total).
//   - known phone   -> increment totalOrders/totalSpent, bump lastVisit,
//     and recompute the average — never create a second document.
// Never throws into the order-creation response, same reasoning as
// syncTableOccupancyForOrder — a Customer-tracking hiccup should never
// block a successful checkout.
async function upsertCustomerFromOrder(order) {
  if (!order.customerPhone) return;

  try {
    const existing = await Customer.findOne({
      restaurantId: order.restaurantId,
      phone: order.customerPhone,
    });

    const totalOrders = (existing?.totalOrders ?? 0) + 1;
    const totalSpent = (existing?.totalSpent ?? 0) + order.totalAmount;

    await Customer.findOneAndUpdate(
      { restaurantId: order.restaurantId, phone: order.customerPhone },
      {
        restaurantId: order.restaurantId,
        phone: order.customerPhone,
        name: order.customerName || existing?.name || "Guest",
        totalOrders,
        totalSpent,
        averageOrderValue: Math.round(totalSpent / totalOrders),
        firstVisit: existing?.firstVisit || order.placedAt,
        lastVisit: order.placedAt,
      },
      { upsert: true, new: true }
    );
  } catch (err) {
    console.error("Customer upsert failed (order was still created):", err);
  }
}

// Validates a checkout payload (identical shape to the POST /api/orders
// body) and computes the exact order fields that should be persisted —
// but does NOT save anything to the database. Prices are NOT trusted from
// the client — each item is looked up in the menu collection and totals
// are recomputed server-side.
//
// Used by orderController.createOrder — cash is the only supported
// payment method, so the order is always created immediately.
async function validateAndBuildOrder(body) {
  const {
    sessionId,
    restaurantId: clientRestaurantId,
    tableToken,
    items,
    orderType,
    specialInstructions,
    paymentMethod,
    customerName,
    customerPhone,
  } = body;

  if (!sessionId) {
    throw new ApiError(400, "sessionId is required");
  }
  // Name and phone are now required for every order — no OTP/SMS
  // verification, just presence + a basic format check, so a customer must
  // at least type in a real-looking number before they can place an order.
  if (!customerName || !customerPhone) {
    throw new ApiError(400, "Name and phone number are required to place an order");
  }
  if (!/^\d{7,15}$/.test(String(customerPhone).trim())) {
    throw new ApiError(400, "Please enter a valid phone number");
  }
  if (!clientRestaurantId || !tableToken || !Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "restaurantId, tableToken and at least one item are required");
  }
  if (!["dine-in", "takeaway"].includes(orderType)) {
    throw new ApiError(400, "orderType must be 'dine-in' or 'takeaway'");
  }
  if (paymentMethod !== "cash") {
    throw new ApiError(400, "Invalid paymentMethod");
  }

  // --- Table token validation (required) ---
  // The Table collection is the single source of truth for table identity.
  // tableToken is looked up on its own (tokens are globally unique — see
  // the unique index on Table.token) rather than scoped to the client's
  // claimed restaurantId, specifically so a mismatched/spoofed restaurantId
  // can't be used to smuggle a fake table through.
  const table = await Table.findOne({ token: tableToken });
  if (!table) {
    throw new ApiError(404, "Invalid table. Please scan the QR code again.");
  }

  // restaurantId is derived from the matched Table document, never trusted
  // from the client, from here on down.
  const restaurantId = table.restaurantId;

  const session = await Session.findOne({ sessionId });
  if (!session) {
    throw new ApiError(400, "Session not found. Please reopen the menu from your QR code.");
  }
  if (session.isExpired()) {
    throw new ApiError(410, "Your session has expired. Please reopen the menu from your QR code.");
  }

  const menuItemIds = items.map((i) => i.id);
  const menuItems = await MenuItem.find({
    restaurantId,
    id: { $in: menuItemIds },
  });

  if (menuItems.length === 0) {
    throw new ApiError(400, "None of the submitted items were found on the menu");
  }

  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  // GST Management Module: fetched up front (rather than after the loop)
  // so each line's GST breakdown can be computed and snapshotted onto it
  // as it's built — see gstService.computeLineGst and the Item-Level Order
  // Management comment on Order.items[].lineSubtotal for why this
  // snapshot matters (it's what makes recomputing totals after a later
  // item cancellation exact, without re-deriving GST rates).
  const gstSettings = await gstService.getSettings(restaurantId);

  const orderItems = [];
  const gstLineItems = [];
  let subtotal = 0;

  for (const requested of items) {
    const menuItem = menuItemById.get(requested.id);
    if (!menuItem) continue; // silently skip unknown/removed items
    const quantity = Math.max(1, Number(requested.quantity) || 1);

    // Menu Item Customization (Modifiers): required groups (e.g. Sauce)
    // must be satisfied or this throws — a customer can never check out
    // with a customizable item missing its required selection, no matter
    // what the client sent (or omitted).
    const { modifiers, priceDelta } = resolveLineModifiers(menuItem, requested.modifiers, menuItem.name);
    const effectiveUnitPrice = menuItem.price + priceDelta;

    const lineGst = gstService.computeLineGst(effectiveUnitPrice, quantity, menuItem.gstSlab, gstSettings);

    orderItems.push({
      item: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        // Menu Item Customization (Modifiers): the effective per-unit
        // price INCLUDING any selected modifier's priceDelta (0 for every
        // sauce today), not just the bare menu price. Every existing place
        // that shows a line amount — cart, checkout, Admin Order Details,
        // billing, KOT prep — multiplies `item.price * quantity`, so
        // snapshotting the effective price here is what keeps every one
        // of those screens correct without individually teaching each of
        // them about modifiers/priceDelta.
        price: effectiveUnitPrice,
        diet: menuItem.diet,
        image: menuItem.image,
        categoryId: menuItem.categoryId,
        categoryTitle: menuItem.categoryTitle,
      },
      quantity,
      modifiers,
      // Item-Level Order Management: every line starts "pending" and is
      // then independently advanced/completed/cancelled from the admin
      // Orders page (see controllers/adminOrderController.js:updateOrderItemStatus).
      status: "pending",
      lineSubtotal: lineGst.lineSubtotal,
      lineTaxableAmount: lineGst.lineTaxableAmount,
      lineTaxAmount: lineGst.lineTaxAmount,
      lineTotal: lineGst.lineTotal,
      gstSlabUsed: lineGst.rate,
    });

    subtotal += effectiveUnitPrice * quantity;
    // GST Management Module: carried separately from orderItems (rather
    // than snapshotted onto each order line) since gstSlab is a billing
    // concept, not part of the menu-item snapshot shown to the customer.
    gstLineItems.push({ price: effectiveUnitPrice, quantity, gstSlab: menuItem.gstSlab });
  }

  if (orderItems.length === 0) {
    throw new ApiError(400, "No valid items to order");
  }

  // GST Management Module: tax is computed per-item off each MenuItem's
  // GST slab (or the restaurant's default) and the current GST Settings
  // (Enabled/Disabled, Inclusive/Exclusive) — see gstService.computeOrderGst.
  // Replaces the old flat TAX_RATE calculation.
  const gst = gstService.computeOrderGst(gstLineItems, gstSettings);
  const taxAmount = gst.taxAmount;
  const totalAmount = gst.totalAmount;

  return {
    orderId: generateOrderId(),
    sessionId,
    restaurantId,
    tableToken: table.token,
    tableLabel: table.label,
    customerName: customerName ? customerName.trim() : "",
    customerPhone: customerPhone ? customerPhone.trim() : "",
    items: orderItems,
    subtotal,
    taxAmount,
    totalAmount,
    taxableAmount: gst.taxableAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    gstMode: gst.gstMode,
    effectiveGstRate: gst.effectiveGstRate,
    orderType,
    specialInstructions: specialInstructions || "",
    paymentMethod,
    status: "pending",
    placedAt: new Date(),
    estimatedMinutes: 20 + Math.floor(Math.random() * 11),
  };
}

// Placeholder tableToken/tableLabel for Admin Manual Orders with no physical
// table (Take Away, placed at the counter). Order.tableToken is required by
// the schema — this can never collide with a real table token (see
// config/tables.js, where every real token is a 10-char hex-ish string), and
// `finalizeOrder` below simply finds no matching Table for it, so no
// table-occupancy side effects run, which is exactly what a Take Away order
// needs.
const ADMIN_TAKEAWAY_TOKEN = "ADMIN-TAKEAWAY";
const ADMIN_TAKEAWAY_LABEL = "Takeaway";

// Table statuses (see models/Table.js) that Admin Manual Ordering is allowed
// to place a NEW walk-in order against, and what happens for each — mirrors
// the Business Logic section of the Admin Manual Order spec:
//   - "available": syncTableOccupancyForOrder (below, shared with the QR
//     flow) opens a brand-new TableSession for this order.
//   - "occupied": syncTableOccupancyForOrder finds the existing active
//     TableSession and merges this order into it instead.
// Every other status (billing/reserved/cleaning/out_of_service) is refused
// with a clear reason — the spec only defines behavior for the two above,
// plus an explicit block for "billing" (Awaiting Payment).
const ADMIN_ORDERABLE_TABLE_STATUSES = ["available", "occupied"];

// Validates an Admin Manual Order payload (POST /api/admin/orders body) and
// computes the exact order fields that should be persisted — mirrors
// validateAndBuildOrder above but for staff placing an order directly from
// the Tables & QR dashboard rather than a customer's own QR session:
//   - no QR browsing Session to validate (there was no scan)
//   - customer name/phone are optional (walk-ins)
//   - table is chosen by _id from the live Table Grid, not scanned by token
//   - Take Away orders have no table at all
// Prices are still never trusted from the client — recomputed the same way.
async function validateAndBuildAdminOrder(body, staff) {
  const {
    restaurantId,
    orderType,
    tableId,
    items,
    specialInstructions,
    customerName,
    customerPhone,
  } = body;

  if (!restaurantId) {
    throw new ApiError(400, "restaurantId is required");
  }
  if (!["dine-in", "takeaway"].includes(orderType)) {
    throw new ApiError(400, "orderType must be 'dine-in' or 'takeaway'");
  }
  if (!Array.isArray(items) || items.length === 0) {
    throw new ApiError(400, "At least one item is required");
  }
  if (customerPhone && !/^\d{7,15}$/.test(String(customerPhone).trim())) {
    throw new ApiError(400, "Please enter a valid phone number");
  }

  let tableToken = ADMIN_TAKEAWAY_TOKEN;
  let tableLabel = ADMIN_TAKEAWAY_LABEL;

  if (orderType === "dine-in") {
    if (!tableId) {
      throw new ApiError(400, "tableId is required for a Dine In order");
    }
    const table = await Table.findOne({ _id: tableId, restaurantId });
    if (!table) {
      throw new ApiError(404, "Table not found");
    }
    if (table.status === "billing") {
      throw new ApiError(
        400,
        `${table.label} is awaiting payment. Please settle the current session before starting a new order.`
      );
    }
    if (!ADMIN_ORDERABLE_TABLE_STATUSES.includes(table.status)) {
      throw new ApiError(
        400,
        `${table.label} is currently "${table.status}" and can't take a new order right now.`
      );
    }
    tableToken = table.token;
    tableLabel = table.label;
  }

  const menuItemIds = items.map((i) => i.id);
  const menuItems = await MenuItem.find({
    restaurantId,
    id: { $in: menuItemIds },
  });

  if (menuItems.length === 0) {
    throw new ApiError(400, "None of the submitted items were found on the menu");
  }

  const menuItemById = new Map(menuItems.map((m) => [m.id, m]));

  // GST Management Module — see the matching comment in
  // validateAndBuildOrder above.
  const gstSettings = await gstService.getSettings(restaurantId);

  const orderItems = [];
  const gstLineItems = [];
  let subtotal = 0;

  for (const requested of items) {
    const menuItem = menuItemById.get(requested.id);
    if (!menuItem) continue; // silently skip unknown/removed items
    if (!menuItem.isAvailable) {
      throw new ApiError(400, `"${menuItem.name}" is currently unavailable`);
    }
    const quantity = Math.max(1, Number(requested.quantity) || 1);

    // Menu Item Customization (Modifiers) — see the matching comment in
    // validateAndBuildOrder above. Admin Manual Ordering doesn't yet have a
    // picker UI for selecting a sauce, but the validation still applies:
    // staff can't accidentally place a customizable item without its
    // required selection either, and can pass `modifiers` the same shape
    // once that UI exists.
    const { modifiers, priceDelta } = resolveLineModifiers(menuItem, requested.modifiers, menuItem.name);
    const effectiveUnitPrice = menuItem.price + priceDelta;

    const lineGst = gstService.computeLineGst(effectiveUnitPrice, quantity, menuItem.gstSlab, gstSettings);

    orderItems.push({
      item: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        price: effectiveUnitPrice,
        diet: menuItem.diet,
        image: menuItem.image,
        categoryId: menuItem.categoryId,
        categoryTitle: menuItem.categoryTitle,
      },
      quantity,
      notes: requested.notes ? String(requested.notes).trim() : "",
      modifiers,
      // Item-Level Order Management — see the matching comment in
      // validateAndBuildOrder above.
      status: "pending",
      lineSubtotal: lineGst.lineSubtotal,
      lineTaxableAmount: lineGst.lineTaxableAmount,
      lineTaxAmount: lineGst.lineTaxAmount,
      lineTotal: lineGst.lineTotal,
      gstSlabUsed: lineGst.rate,
    });

    subtotal += effectiveUnitPrice * quantity;
    gstLineItems.push({ price: effectiveUnitPrice, quantity, gstSlab: menuItem.gstSlab });
  }

  if (orderItems.length === 0) {
    throw new ApiError(400, "No valid items to order");
  }

  const gst = gstService.computeOrderGst(gstLineItems, gstSettings);
  const taxAmount = gst.taxAmount;
  const totalAmount = gst.totalAmount;

  return {
    orderId: generateOrderId(),
    sessionId: generateAdminSessionId(),
    restaurantId,
    tableToken,
    tableLabel,
    customerName: customerName ? String(customerName).trim() : "",
    customerPhone: customerPhone ? String(customerPhone).trim() : "",
    items: orderItems,
    subtotal,
    taxAmount,
    totalAmount,
    taxableAmount: gst.taxableAmount,
    cgstAmount: gst.cgstAmount,
    sgstAmount: gst.sgstAmount,
    igstAmount: gst.igstAmount,
    gstMode: gst.gstMode,
    effectiveGstRate: gst.effectiveGstRate,
    orderType,
    specialInstructions: specialInstructions || "",
    paymentMethod: "cash",
    status: "pending",
    placedAt: new Date(),
    estimatedMinutes: 20 + Math.floor(Math.random() * 11),
    orderSource: "ADMIN",
    placedByStaffId: staff?.staffId || null,
    placedByStaffName: staff?.name || "",
  };
}

// Persists a previously-built order (see validateAndBuildOrder above) and
// runs all post-creation side effects: the kitchen/admin Socket.IO
// broadcast and the table-occupancy sync. Shared so an order only ever
// gets created — and broadcast to the Kitchen/Admin dashboards — in one
// place, whether it came from the cash flow or a verified payment.
async function finalizeOrder(orderData) {
  const order = await Order.create(orderData);

  const table = await Table.findOne({ token: order.tableToken });
  let session = null;
  if (table) {
    session = await syncTableOccupancyForOrder(table, order);
  }

  // Daily Token Number System: stamp the session's token number onto this
  // order (see Order.tokenNumber for why) before broadcasting it, so the
  // "new-order" event auto-print listens for (KotAutoPrintProvider.tsx)
  // already carries the number the ticket needs — no extra round-trip.
  // Intentionally a no-op for takeaway/counter orders with no table
  // session, and never overwrites with a stale value on failure (session
  // is null if table-occupancy sync above failed or there's no table).
  if (session?.tokenNumber != null) {
    order.tokenNumber = session.tokenNumber;
    await order.save();
  }

  emitNewOrder(order);

  await upsertCustomerFromOrder(order);

  // Stock Management: this cash-only checkout creates the order already
  // "pending" and confirmed for the kitchen (there's no separate
  // paid/confirmed step to hook into), so this is the equivalent moment —
  // deduct ingredient stock for every item that has a recipe mapped. Never
  // throws into the order-creation response, same reasoning as the other
  // side effects above.
  try {
    await deductStockForOrder(order);
  } catch (err) {
    console.error("Stock deduction failed (order was still created):", err);
  }

  return order;
}

// ---------------------------------------------------------------------------
// Item-Level Order Management
// ---------------------------------------------------------------------------
// Replaces "delete the whole order" as the day-to-day staff action: every
// ordered line is completed or cancelled independently, and the order's own
// `status` is derived from its items rather than set directly (except by
// the Kitchen Dashboard, which still advances a whole ticket at once — see
// controllers/orderController.js:updateOrderStatus, which cascades onto
// every still-active item so the two flows never disagree).

// Given an order's items array, derives what the order's own `status`
// should be:
//   - every item cancelled                 -> "cancelled"
//   - no items left pending/preparing/ready -> "completed"
//     (i.e. every item is completed or cancelled, with at least one completed)
//   - otherwise                             -> the least-progressed status
//     among the still-active (pending/preparing/ready) items, since the
//     order as a whole can never be "further along" than its least-ready
//     item.
const ACTIVE_STATUS_RANK = { pending: 0, preparing: 1, ready: 2 };
function computeOrderStatusFromItems(items) {
  const statuses = items.map((i) => i.status || "pending");
  const activeStatuses = statuses.filter((s) => s !== "completed" && s !== "cancelled");

  if (activeStatuses.length === 0) {
    const allCancelled = statuses.every((s) => s === "cancelled");
    return allCancelled ? "cancelled" : "completed";
  }

  return activeStatuses.reduce(
    (least, s) => (ACTIVE_STATUS_RANK[s] < ACTIVE_STATUS_RANK[least] ? s : least),
    activeStatuses[0]
  );
}

// Locates one line within an order's items array by its lineId. Falls back
// to treating the id as a plain array index for orders placed before
// lineId existed (their stored items have no lineId to match against, so
// the frontend addresses them positionally instead — see
// lib/admin-api.ts:updateOrderItemStatus).
function findOrderItemIndex(order, lineId) {
  const byLineId = order.items.findIndex((line) => line.lineId && line.lineId === lineId);
  if (byLineId !== -1) return byLineId;

  const asIndex = Number(lineId);
  if (Number.isInteger(asIndex) && asIndex >= 0 && asIndex < order.items.length && !order.items[asIndex].lineId) {
    return asIndex;
  }
  return -1;
}

// Cascades one item's status change out to everything downstream that was
// computed off this order's totals — mirrors deleteOrderCascade below, but
// recomputes (rather than strips out the order entirely) since the order
// document itself still exists, just with new totals.
async function recalculateDownstreamForOrder(order) {
  const { orderId, restaurantId, customerPhone } = order;

  // --- Table Management: keep TableSession.currentBill in sync with the
  // orders it currently rolls up, the same way syncTableOccupancyForOrder /
  // deleteOrderCascade maintain it. ---
  try {
    const sessions = await TableSession.find({ orderIds: orderId });
    for (const session of sessions) {
      const sessionOrders = await Order.find({ orderId: { $in: session.orderIds } });
      session.currentBill = sessionOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      await session.save();
    }
  } catch (err) {
    console.error("TableSession currentBill recompute failed (item status change was still applied):", err);
  }

  // --- Settlements Module: if this order was already billed under a
  // Settlement (Submit Bill already ran), keep subtotal/tax/grandTotal in
  // sync too — same recompute deleteOrderCascade performs on delete, but
  // re-summing from whichever linked orders are still non-cancelled
  // (mirrors submitBillForTable's activeOrders filter) rather than
  // stripping an orderId out of the list. ---
  try {
    const settlements = await Settlement.find({ orderIds: orderId });
    for (const settlement of settlements) {
      const settlementOrders = await Order.find({ orderId: { $in: settlement.orderIds } });
      const activeOrders = settlementOrders.filter((o) => o.status !== "cancelled");

      const newSubtotal = activeOrders.reduce((sum, o) => sum + o.subtotal, 0);
      let newGrandTotal;
      if (settlement.discount > 0) {
        const gstSettings = await gstService.getSettings(settlement.restaurantId);
        const applied = gstService.recomputeWithDiscount(activeOrders, settlement.discount, gstSettings);
        settlement.discount = applied.discount;
        settlement.tax = applied.tax;
        settlement.taxableAmount = applied.taxableAmount;
        settlement.cgstAmount = applied.cgstAmount;
        settlement.sgstAmount = applied.sgstAmount;
        settlement.igstAmount = applied.igstAmount;
        newGrandTotal = applied.grandTotal;
      } else {
        settlement.tax = activeOrders.reduce((sum, o) => sum + o.taxAmount, 0);
        settlement.taxableAmount = activeOrders.reduce((sum, o) => sum + (o.taxableAmount ?? o.subtotal), 0);
        settlement.cgstAmount = activeOrders.reduce((sum, o) => sum + (o.cgstAmount || 0), 0);
        settlement.sgstAmount = activeOrders.reduce((sum, o) => sum + (o.sgstAmount || 0), 0);
        settlement.igstAmount = activeOrders.reduce((sum, o) => sum + (o.igstAmount || 0), 0);
        newGrandTotal = activeOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      }
      settlement.subtotal = newSubtotal;
      // Only rescale the still-owed Credit balance — money already
      // collected is never retroactively "refunded" by this recompute.
      if (settlement.paymentStatus === "credit" && settlement.outstandingAmount > 0) {
        settlement.outstandingAmount = Math.min(settlement.outstandingAmount, newGrandTotal);
      }
      settlement.grandTotal = newGrandTotal;
      const receivedSoFar = settlement.totalReceived || 0;
      const roundedGrandTotal = Math.round(newGrandTotal * 100) / 100;
      settlement.remainingAmount = Math.round((roundedGrandTotal - receivedSoFar) * 100) / 100;
      settlement.collectionStatus =
        receivedSoFar <= 0 ? "UNPAID" : receivedSoFar >= roundedGrandTotal ? "PAID" : "PARTIALLY_PAID";
      await settlement.save();
      emitSettlementUpdated(settlement);
    }
  } catch (err) {
    console.error("Settlement recompute failed (item status change was still applied):", err);
  }

  // --- Customer Tracking: recompute totalOrders/totalSpent/averageOrderValue
  // straight from every order this phone number still has, same fields
  // upsertCustomerFromOrder maintains at checkout — so a cancelled item's
  // value is backed out of a customer's running total instead of silently
  // overstating how much they've actually spent. ---
  if (customerPhone) {
    try {
      const customerOrders = await Order.find({ restaurantId, customerPhone });
      if (customerOrders.length > 0) {
        const totalOrders = customerOrders.length;
        const totalSpent = customerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
        await Customer.findOneAndUpdate(
          { restaurantId, phone: customerPhone },
          { totalOrders, totalSpent, averageOrderValue: Math.round(totalSpent / totalOrders) }
        );
      }
    } catch (err) {
      console.error("Customer totals recompute failed (item status change was still applied):", err);
    }
  }
}

// PATCH /api/admin/orders/:orderId/items/:lineId/status — Complete or
// Cancel exactly one ordered item, leaving every other item on the order
// untouched. The order's own status/subtotal/taxAmount/totalAmount/GST
// figures are then recomputed from its items (see
// computeOrderStatusFromItems / gstService.recomputeOrderAggregatesFromItems)
// rather than set directly, so they can never drift from what's actually
// happened to each item.
async function updateOrderItemStatus(orderId, restaurantId, lineId, newStatus) {
  if (!["completed", "cancelled"].includes(newStatus)) {
    throw new ApiError(400, "status must be 'completed' or 'cancelled'");
  }

  const order = await Order.findOne({ orderId, restaurantId });
  if (!order) throw new ApiError(404, "Order not found");

  if (order.status === "completed" || order.status === "cancelled") {
    throw new ApiError(400, `This order is already ${order.status} and its items can no longer be changed.`);
  }

  const idx = findOrderItemIndex(order, lineId);
  if (idx === -1) throw new ApiError(404, "Item not found on this order");

  const line = order.items[idx];
  if (line.status === "completed" || line.status === "cancelled") {
    throw new ApiError(400, `This item is already ${line.status} and cannot be changed.`);
  }

  line.status = newStatus;

  // GST Management Module: re-derive subtotal/taxableAmount/cgst/sgst/igst/
  // taxAmount/totalAmount/effectiveGstRate from whatever items are still
  // not cancelled, using each line's own snapshotted GST breakdown.
  const aggregates = gstService.recomputeOrderAggregatesFromItems(order);
  order.subtotal = aggregates.subtotal;
  order.taxableAmount = aggregates.taxableAmount;
  order.cgstAmount = aggregates.cgstAmount;
  order.sgstAmount = aggregates.sgstAmount;
  order.igstAmount = aggregates.igstAmount;
  order.taxAmount = aggregates.taxAmount;
  order.totalAmount = aggregates.totalAmount;
  order.effectiveGstRate = aggregates.effectiveGstRate;

  const derivedStatus = computeOrderStatusFromItems(order.items);
  if (derivedStatus !== order.status) {
    order.status = derivedStatus;
    order.statusHistory.push({ status: derivedStatus, changedAt: new Date() });
  }

  await order.save();

  // Let the Kitchen Dashboard, order-tracking page, and Active Orders tab
  // pick up both the item-level change and any derived order-status change
  // immediately — same broadcast the Kitchen's whole-order status update
  // already uses, since the payload is just the (now updated) order doc.
  emitOrderStatusUpdate(order);

  await recalculateDownstreamForOrder(order);

  return order;
}
const sessionOrders = await Order.find({ orderId: { $in: session.orderIds } });
session.currentBill = sessionOrders.reduce((sum, o) => sum + o.totalAmount, 0);
await session.save();

// NEW: if every order in this session is now cancelled/zero, the table
// isn't really occupied anymore — free it, same as deleteOrderCascade.
const stillActive = sessionOrders.some(
  (o) => o.status !== "cancelled" && o.totalAmount > 0
);
if (!stillActive && session.status === "active") {
  session.status = "closed";
  session.sessionEnd = new Date();
  await session.save();
  emitSessionEnded(session);

  const table = await Table.findById(session.tableId);
  if (table && table.currentSessionId === session.sessionId) {
    table.status = "available";
    table.currentSessionId = null;
    table.currentReservationId = null;
    table.occupiedAt = null;
    await table.save();
    emitTableAvailable(table);
  }
}
// Permanent Order Deletion (Admin Dashboard -> Orders -> Delete): removes an
// order as if it had never been created — a HARD delete, not a status
// change to "cancelled". Every place an orderId is denormalized elsewhere
// (TableSession.orderIds/currentBill, Settlement.orderIds/totals,
// Customer's running totals) is cleaned up/recalculated here so nothing
// downstream (Analytics, Revenue, Reports, Settlements, Dashboard cards)
// keeps counting it. Orders/Analytics/Revenue/Dashboard/Payments/Search are
// all queried live off the Order collection (see analyticsController,
// dashboardController, paymentAnalyticsController, orderController) so
// simply deleting the Order document already takes care of those — only
// the stored/denormalized aggregates below need explicit recalculation.
async function deleteOrderCascade(order) {
  const { orderId, restaurantId, customerPhone } = order;

  // --- Table Management: detach from any dining session that rolled this
  // order in (active or already closed) and recompute the bill total from
  // whatever orders remain. If that leaves an ACTIVE session with zero
  // orders, the table was never really occupied anymore — close the
  // session and free the table immediately (same close-session-and-free-
  // table step settlementController.collectSettlement performs on a real
  // payment collection) instead of leaving it stuck showing "Occupied"
  // with 0 orders / ₹0. ---
  const sessions = await TableSession.find({ orderIds: orderId });
  for (const session of sessions) {
    session.orderIds = session.orderIds.filter((id) => id !== orderId);
    const remainingOrders = await Order.find({ orderId: { $in: session.orderIds } });
    session.currentBill = remainingOrders.reduce((sum, o) => sum + o.totalAmount, 0);

    if (session.orderIds.length === 0 && session.status === "active") {
      session.status = "closed";
      session.sessionEnd = new Date();
      await session.save();
      emitSessionEnded(session);

      const table = await Table.findById(session.tableId);
      if (table && table.currentSessionId === session.sessionId) {
        table.status = "available";
        table.currentSessionId = null;
        table.currentReservationId = null;
        table.occupiedAt = null;
        await table.save();
        emitTableAvailable(table);
      }
    } else {
      await session.save();
    }
  }

  // --- Settlements Module: strip the order out of any settlement it was
  // billed under and recompute subtotal/tax/grandTotal from the remaining
  // orders, so Settlement totals and the Reports/Analytics built on top of
  // them never include the deleted order again. ---
  const settlements = await Settlement.find({ orderIds: orderId });
  for (const settlement of settlements) {
    settlement.orderIds = settlement.orderIds.filter((id) => id !== orderId);
    const remainingOrders = await Order.find({ orderId: { $in: settlement.orderIds } });

    const newSubtotal = remainingOrders.reduce((sum, o) => sum + o.subtotal, 0);
    let newGrandTotal;
    // Offers & Discounts Module: if this settlement had an offer applied at
    // billing time, re-run the same discount against the new (smaller)
    // taxable base instead of dropping it — the discount amount itself was
    // frozen when the bill was submitted, so it's simply re-capped via
    // gstService.recomputeWithDiscount (which already clamps discount
    // <= subtotal). GST Management Module: this also keeps
    // taxableAmount/cgstAmount/sgstAmount/igstAmount on the Settlement in
    // sync with whatever orders remain, not just the total tax figure.
    if (settlement.discount > 0) {
      const gstSettings = await gstService.getSettings(settlement.restaurantId);
      const applied = gstService.recomputeWithDiscount(remainingOrders, settlement.discount, gstSettings);
      settlement.discount = applied.discount;
      settlement.tax = applied.tax;
      settlement.taxableAmount = applied.taxableAmount;
      settlement.cgstAmount = applied.cgstAmount;
      settlement.sgstAmount = applied.sgstAmount;
      settlement.igstAmount = applied.igstAmount;
      newGrandTotal = applied.grandTotal;
    } else {
      settlement.tax = remainingOrders.reduce((sum, o) => sum + o.taxAmount, 0);
      settlement.taxableAmount = remainingOrders.reduce((sum, o) => sum + (o.taxableAmount ?? o.subtotal), 0);
      settlement.cgstAmount = remainingOrders.reduce((sum, o) => sum + (o.cgstAmount || 0), 0);
      settlement.sgstAmount = remainingOrders.reduce((sum, o) => sum + (o.sgstAmount || 0), 0);
      settlement.igstAmount = remainingOrders.reduce((sum, o) => sum + (o.igstAmount || 0), 0);
      newGrandTotal = remainingOrders.reduce((sum, o) => sum + o.totalAmount, 0);
    }
    settlement.subtotal = newSubtotal;
    // Only rescale the still-owed Credit balance — a settlement that's
    // already been fully paid/partially cleared shouldn't have money that
    // was actually collected retroactively "refunded" by this cleanup.
    if (settlement.paymentStatus === "credit" && settlement.outstandingAmount > 0) {
      settlement.outstandingAmount = Math.min(settlement.outstandingAmount, newGrandTotal);
    }
    settlement.grandTotal = newGrandTotal;
    // Payment Collection Tracking: totalReceived itself doesn't change
    // (money already collected isn't retroactively un-collected by this
    // cleanup) but remainingAmount/collectionStatus are derived from
    // grandTotal, so they need to be refreshed against the new total —
    // otherwise a settlement could keep showing PARTIALLY_PAID after the
    // bill shrank to match what was actually received.
    const receivedSoFar = settlement.totalReceived || 0;
    const roundedGrandTotal = Math.round(newGrandTotal * 100) / 100;
    settlement.remainingAmount = Math.round((roundedGrandTotal - receivedSoFar) * 100) / 100;
    settlement.collectionStatus =
      receivedSoFar <= 0 ? "UNPAID" : receivedSoFar >= roundedGrandTotal ? "PAID" : "PARTIALLY_PAID";
    await settlement.save();
    emitSettlementUpdated(settlement);
  }

  // --- Customer Tracking: recompute totalOrders/totalSpent/averageOrderValue
  // (and first/last visit) straight from whatever orders this phone number
  // still has — the same fields upsertCustomerFromOrder maintains on
  // checkout, kept in sync here instead of just decremented so they can
  // never drift. If this was their only order, the Customer record itself
  // is removed (it would never have existed otherwise). ---
  if (customerPhone) {
    const remainingCustomerOrders = await Order.find({ restaurantId, customerPhone });
    if (remainingCustomerOrders.length === 0) {
      await Customer.deleteOne({ restaurantId, phone: customerPhone });
    } else {
      const totalOrders = remainingCustomerOrders.length;
      const totalSpent = remainingCustomerOrders.reduce((sum, o) => sum + o.totalAmount, 0);
      const visitTimes = remainingCustomerOrders.map((o) => o.placedAt.getTime());
      await Customer.findOneAndUpdate(
        { restaurantId, phone: customerPhone },
        {
          totalOrders,
          totalSpent,
          averageOrderValue: Math.round(totalSpent / totalOrders),
          firstVisit: new Date(Math.min(...visitTimes)),
          lastVisit: new Date(Math.max(...visitTimes)),
        }
      );
    }
  }

  // --- Finally, the physical delete. Everything above must run first,
  // since it depends on the order still existing to compute "remaining"
  // totals against the still-current orderId lists. ---
  await Order.deleteOne({ orderId });

  // Let the Kitchen Dashboard / order-tracking / Active Orders tab (any of
  // which may already be open elsewhere) drop this order immediately
  // instead of waiting on their own polling.
  emitOrderDeleted(order);
}

module.exports = {
  validateAndBuildOrder,
  validateAndBuildAdminOrder,
  finalizeOrder,
  deleteOrderCascade,
  updateOrderItemStatus,
  computeOrderStatusFromItems,
  recalculateDownstreamForOrder,
  TAX_RATE,
};