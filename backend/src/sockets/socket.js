const { Server } = require("socket.io");

let io = null;

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

module.exports = { initSocket, getIO, emitNewOrder, emitOrderStatusUpdate };
