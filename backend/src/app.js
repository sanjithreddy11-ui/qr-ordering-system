const express = require("express");
const cors = require("cors");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const adminMenuRoutes = require("./routes/adminMenuRoutes");
const adminTableRoutes = require("./routes/adminTableRoutes");
const adminStaffRoutes = require("./routes/adminStaffRoutes");
const adminReservationRoutes = require("./routes/adminReservationRoutes");
const adminTableSessionRoutes = require("./routes/adminTableSessionRoutes");
const ApiError = require("./utils/ApiError");

function createApp(clientOrigin) {
  const app = express();

  app.use(cors({ origin: clientOrigin }));
  app.use(express.json());

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/menu", menuRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/restaurants", restaurantRoutes);
  app.use("/api/admin/menu", adminMenuRoutes);
  app.use("/api/admin/tables", adminTableRoutes);
  app.use("/api/admin/staff", adminStaffRoutes);
  app.use("/api/admin/reservations", adminReservationRoutes);
  app.use("/api/admin/table-sessions", adminTableSessionRoutes);

  // 404
  app.use((req, res) => {
    res.status(404).json({ error: "Route not found" });
  });

  // Central error handler
  app.use((err, req, res, next) => {
    if (err instanceof ApiError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  });

  return app;
}

module.exports = createApp;
