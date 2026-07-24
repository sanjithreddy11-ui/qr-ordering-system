const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const Table = require("../models/Table");
const Session = require("../models/Session");
const TableSession = require("../models/TableSession");
const ApiError = require("../utils/ApiError");
const generateOrderId = require("../utils/generateOrderId");
const generateTableSessionId = require("../utils/generateTableSessionId");
const { emitNewOrder, emitTableOccupied, emitSessionStarted } = require("../sockets/socket");

const TAX_RATE = 0.05;

// Table Management side effect, run after an order is successfully created:
//   - if the table has no active TableSession, create one and mark the
//     table Occupied (this is the FIRST order for this dining visit)
//   - if it already has one (from a previous order this visit, or from an
//     admin Check-In), just attach this order and refresh the bill total
// This never throws into the order-creation response — a failure here
// should never block or roll back a successful order, since the customer
// flow must keep working even if the table-management side is degraded.
async function syncTableOccupancyForOrder(table, order) {
  try {
    let session = table.currentSessionId
      ? await TableSession.findOne({ sessionId: table.currentSessionId, status: "active" })
      : await TableSession.findOne({ tableId: table._id, status: "active" });

    if (!session) {
      session = await TableSession.create({
        sessionId: generateTableSessionId(),
        restaurantId: order.restaurantId,
        tableId: table._id,
        tableToken: table.token,
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
      await session.save();
      // Table status doesn't change on repeat orders — it's already
      // "occupied" (or, in a reservation-check-in edge case, could already
      // be "occupied") too, so no further table update/emit is needed.
    }
  } catch (err) {
    console.error("Table occupancy sync failed (order was still created):", err);
  }
}

// Validates a checkout payload (identical shape to the POST /api/orders
// body) and computes the exact order fields that should be persisted —
// but does NOT save anything to the database. Prices are NOT trusted from
// the client — each item is looked up in the menu collection and totals
// are recomputed server-side.
//
// Shared by:
//   - orderController.createOrder (cash — creates the order immediately)
//   - paymentController.createPaymentOrder (upi/card — creates a Razorpay
//     order first; the real Order is only created after verifyPayment)
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
  if (!["upi", "cash", "card"].includes(paymentMethod)) {
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

  const orderItems = [];
  let subtotal = 0;

  for (const requested of items) {
    const menuItem = menuItemById.get(requested.id);
    if (!menuItem) continue; // silently skip unknown/removed items
    const quantity = Math.max(1, Number(requested.quantity) || 1);

    orderItems.push({
      item: {
        id: menuItem.id,
        name: menuItem.name,
        description: menuItem.description,
        price: menuItem.price,
        diet: menuItem.diet,
        image: menuItem.image,
      },
      quantity,
    });

    subtotal += menuItem.price * quantity;
  }

  if (orderItems.length === 0) {
    throw new ApiError(400, "No valid items to order");
  }

  const taxAmount = Math.round(subtotal * TAX_RATE);
  const totalAmount = subtotal + taxAmount;

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
    orderType,
    specialInstructions: specialInstructions || "",
    paymentMethod,
    status: "pending",
    placedAt: new Date(),
    estimatedMinutes: 20 + Math.floor(Math.random() * 11),
  };
}

// Persists a previously-built order (see validateAndBuildOrder above) and
// runs all post-creation side effects: the kitchen/admin Socket.IO
// broadcast and the table-occupancy sync. Shared so an order only ever
// gets created — and broadcast to the Kitchen/Admin dashboards — in one
// place, whether it came from the cash flow or a verified payment.
async function finalizeOrder(orderData) {
  const order = await Order.create(orderData);

  emitNewOrder(order);

  const table = await Table.findOne({ token: order.tableToken });
  if (table) {
    await syncTableOccupancyForOrder(table, order);
  }

  return order;
}

module.exports = { validateAndBuildOrder, finalizeOrder, TAX_RATE };
