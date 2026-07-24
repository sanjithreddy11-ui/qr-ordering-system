const { Server } = require("socket.io");
const { DEMO_TABLES } = require("../config/tables");

let io = null;

function resolveTableLabel(tableToken) {
  return DEMO_TABLES.find((t) => t.token === tableToken)?.label ?? tableToken ?? "Table";
}

// ---------------------------------------------------------------------------
// Group ordering — one shared, live cart per physical table.
//
// Everyone who scans the same table's QR code lands on the same
// (restaurantId, tableToken) pair, so that pair doubles as the "group id" —
// no separate invite code needed. State lives in-memory only (a Map), keyed
// by `${restaurantId}:${tableToken}`, and is intentionally NOT persisted to
// Mongo: it only needs to survive for the length of one dining session, and
// resetting on a backend restart is an acceptable tradeoff for the
// simplicity this buys. Swap this for a GroupCart collection later if you
// need it to survive redeploys.
// ---------------------------------------------------------------------------
const groupOrders = new Map();

function groupKey(restaurantId, tableToken) {
  return `${restaurantId}:${tableToken}`;
}

function groupRoom(restaurantId, tableToken) {
  return `table:${groupKey(restaurantId, tableToken)}`;
}

function getOrCreateGroup(restaurantId, tableToken) {
  const key = groupKey(restaurantId, tableToken);
  let group = groupOrders.get(key);
  if (!group) {
    group = { participants: new Map(), lines: new Map() };
    groupOrders.set(key, group);
  }
  return group;
}

function serializeGroup(group) {
  return {
    participants: Array.from(group.participants.values()).map((p) => ({
      participantId: p.participantId,
      name: p.name,
    })),
    lines: Array.from(group.lines.values()).map(({ lineId, menuItemId, name, price, quantity, participantId, participantName }) => ({
      lineId,
      menuItemId,
      name,
      price,
      quantity,
      participantId,
      participantName,
    })),
  };
}

function broadcastGroup(io, restaurantId, tableToken) {
  const group = getOrCreateGroup(restaurantId, tableToken);
  io.to(groupRoom(restaurantId, tableToken)).emit("group:state", serializeGroup(group));
}

/**
 * Sets up Socket.io on top of the existing HTTP server.
 *
 * Rooms are scoped per restaurant so that if you ever host multiple
 * restaurants on the same backend, one kitchen never sees another's orders.
 *
 *   - Kitchen dashboard joins room: `kitchen:<restaurantId>`
 *   - Customer order-success page joins room: `order:<orderId>`
 *   - Customer active-orders tab joins room: `session:<sessionId>`
 */
function initSocket(httpServer, clientOrigin) {
  io = new Server(httpServer, {
    cors: {
      origin: clientOrigin,
      methods: ["GET", "POST", "PATCH"],
    },
  });

  io.on("connection", (socket) => {
    socket.on("join-kitchen", (restaurantId) => {
      if (!restaurantId) return;
      socket.join(`kitchen:${restaurantId}`);
    });

    // ---- Table Management dashboard --------------------------------------
    // Joined by the admin "Tables" page to receive live status/reservation/
    // session updates without polling.
    socket.on("join-tables", (restaurantId) => {
      if (!restaurantId) return;
      socket.join(`tables:${restaurantId}`);
    });

    socket.on("leave-tables", (restaurantId) => {
      if (!restaurantId) return;
      socket.leave(`tables:${restaurantId}`);
    });

    socket.on("join-order", (orderId) => {
      if (!orderId) return;
      socket.join(`order:${orderId}`);
    });

    socket.on("leave-order", (orderId) => {
      if (!orderId) return;
      socket.leave(`order:${orderId}`);
    });

    socket.on("join-session", (sessionId) => {
      if (!sessionId) return;
      socket.join(`session:${sessionId}`);
    });

    socket.on("leave-session", (sessionId) => {
      if (!sessionId) return;
      socket.leave(`session:${sessionId}`);
    });

    // ---- One-tap waiter call --------------------------------------------
    // Fired straight from the customer's menu page; pings every device
    // watching this restaurant's kitchen room (kitchen dashboard today,
    // could be a dedicated staff-only room later).
    socket.on("call-waiter", ({ restaurantId, tableToken, tableLabel }) => {
      if (!restaurantId) return;
      io.to(`kitchen:${restaurantId}`).emit("waiter-called", {
        restaurantId,
        tableToken: tableToken || null,
        tableLabel: tableLabel || resolveTableLabel(tableToken),
        at: Date.now(),
      });
    });

    // ---- Group shared menu/cart -------------------------------------------
    socket.data.groupRooms = socket.data.groupRooms || new Set();

    socket.on("group:join", ({ restaurantId, tableToken, participantId, name }) => {
      if (!restaurantId || !tableToken || !participantId) return;

      const room = groupRoom(restaurantId, tableToken);
      socket.join(room);
      socket.data.groupRooms.add(room);

      const group = getOrCreateGroup(restaurantId, tableToken);
      const existing = group.participants.get(participantId);
      const socketIds = existing ? existing.socketIds : new Set();
      socketIds.add(socket.id);
      group.participants.set(participantId, {
        participantId,
        name: name || existing?.name || "Guest",
        socketIds,
      });

      broadcastGroup(io, restaurantId, tableToken);
    });

    socket.on("group:leave", ({ restaurantId, tableToken, participantId }) => {
      if (!restaurantId || !tableToken || !participantId) return;

      const room = groupRoom(restaurantId, tableToken);
      socket.leave(room);
      socket.data.groupRooms.delete(room);

      const group = getOrCreateGroup(restaurantId, tableToken);
      const p = group.participants.get(participantId);
      if (p) {
        p.socketIds.delete(socket.id);
        if (p.socketIds.size === 0) group.participants.delete(participantId);
      }

      broadcastGroup(io, restaurantId, tableToken);
    });

    socket.on("group:add-item", ({ restaurantId, tableToken, participantId, name, item }) => {
      if (!restaurantId || !tableToken || !participantId || !item?.id) return;

      const group = getOrCreateGroup(restaurantId, tableToken);
      const lineId = `${item.id}:${participantId}`;
      const existing = group.lines.get(lineId);

      group.lines.set(lineId, {
        lineId,
        menuItemId: item.id,
        name: item.name,
        price: item.price,
        quantity: (existing?.quantity ?? 0) + 1,
        participantId,
        participantName: name || group.participants.get(participantId)?.name || "Guest",
      });

      broadcastGroup(io, restaurantId, tableToken);
    });

    socket.on("group:remove-item", ({ restaurantId, tableToken, participantId, itemId }) => {
      if (!restaurantId || !tableToken || !participantId || !itemId) return;

      const group = getOrCreateGroup(restaurantId, tableToken);
      const lineId = `${itemId}:${participantId}`;
      const existing = group.lines.get(lineId);
      if (!existing) return;

      if (existing.quantity <= 1) {
        group.lines.delete(lineId);
      } else {
        group.lines.set(lineId, { ...existing, quantity: existing.quantity - 1 });
      }

      broadcastGroup(io, restaurantId, tableToken);
    });

    socket.on("disconnect", () => {
      for (const room of socket.data.groupRooms) {
        const key = room.slice("table:".length);
        const sepIndex = key.indexOf(":");
        const restaurantId = key.slice(0, sepIndex);
        const tableToken = key.slice(sepIndex + 1);

        const group = groupOrders.get(key);
        if (!group) continue;

        for (const [participantId, p] of group.participants.entries()) {
          p.socketIds.delete(socket.id);
          if (p.socketIds.size === 0) group.participants.delete(participantId);
        }

        broadcastGroup(io, restaurantId, tableToken);
      }
    });
  });

  return io;
}

function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialized. Call initSocket() first.");
  }
  return io;
}

/** Notify the kitchen dashboard that a new order has been placed. */
function emitNewOrder(order) {
  getIO().to(`kitchen:${order.restaurantId}`).emit("new-order", order);
  getIO().to(`session:${order.sessionId}`).emit("new-order", order);
}

/** Notify the kitchen, the order-success page, and the Active Orders tab. */
function emitOrderStatusUpdate(order) {
  getIO().to(`kitchen:${order.restaurantId}`).emit("order-status-updated", order);
  getIO().to(`order:${order.orderId}`).emit("order-status-updated", order);
  getIO().to(`session:${order.sessionId}`).emit("order-status-updated", order);
}

// ---------------------------------------------------------------------------
// Table Management emits — all scoped to the `tables:<restaurantId>` room
// joined by the admin Tables page. `table` / `reservation` / `session` are
// the plain serialized Mongo documents (already .toJSON()-friendly).
// ---------------------------------------------------------------------------
function emitTableEvent(restaurantId, event, payload) {
  getIO().to(`tables:${restaurantId}`).emit(event, payload);
}

const emitTableOccupied = (table) => emitTableEvent(table.restaurantId, "tableOccupied", table);
const emitTableReserved = (table) => emitTableEvent(table.restaurantId, "tableReserved", table);
const emitTableAvailable = (table) => emitTableEvent(table.restaurantId, "tableAvailable", table);
const emitTableCleaning = (table) => emitTableEvent(table.restaurantId, "tableCleaning", table);
const emitTableBilling = (table) => emitTableEvent(table.restaurantId, "tableBilling", table);
const emitTableOutOfService = (table) =>
  emitTableEvent(table.restaurantId, "tableOutOfService", table);

const emitReservationCreated = (r) => emitTableEvent(r.restaurantId, "reservationCreated", r);
const emitReservationUpdated = (r) => emitTableEvent(r.restaurantId, "reservationUpdated", r);
const emitReservationCancelled = (r) => emitTableEvent(r.restaurantId, "reservationCancelled", r);
const emitReservationCheckedIn = (r) => emitTableEvent(r.restaurantId, "reservationCheckedIn", r);

const emitSessionStarted = (s) => emitTableEvent(s.restaurantId, "sessionStarted", s);
const emitSessionEnded = (s) => emitTableEvent(s.restaurantId, "sessionEnded", s);
// Payment method chosen, bill printed, or payment collected on a session —
// the Tables grid and the Current Dining Session page both listen for this.
const emitSessionPaymentUpdated = (s) => emitTableEvent(s.restaurantId, "sessionPaymentUpdated", s);

module.exports = {
  initSocket,
  getIO,
  emitNewOrder,
  emitOrderStatusUpdate,
  emitTableOccupied,
  emitTableReserved,
  emitTableAvailable,
  emitTableCleaning,
  emitTableBilling,
  emitTableOutOfService,
  emitReservationCreated,
  emitReservationUpdated,
  emitReservationCancelled,
  emitReservationCheckedIn,
  emitSessionStarted,
  emitSessionEnded,
  emitSessionPaymentUpdated,
};
