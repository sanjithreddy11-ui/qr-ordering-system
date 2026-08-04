const path = require("path");
const express = require("express");
const cors = require("cors");
const compression = require("compression");
const menuRoutes = require("./routes/menuRoutes");
const orderRoutes = require("./routes/orderRoutes");
const otpRoutes = require("./routes/otpRoutes");
const sessionRoutes = require("./routes/sessionRoutes");
const restaurantRoutes = require("./routes/restaurantRoutes");
const tableRoutes = require("./routes/tableRoutes");
const adminMenuRoutes = require("./routes/adminMenuRoutes");
const adminTableRoutes = require("./routes/adminTableRoutes");
const adminStaffRoutes = require("./routes/adminStaffRoutes");
const adminReservationRoutes = require("./routes/adminReservationRoutes");
const adminTableSessionRoutes = require("./routes/adminTableSessionRoutes");
const adminOrderRoutes = require("./routes/adminOrderRoutes");
const authRoutes = require("./routes/authRoutes");
const categoryRoutes = require("./routes/categoryRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const dashboardRoutes = require("./routes/dashboardRoutes");
const customerRoutes = require("./routes/customerRoutes");
const paymentAnalyticsRoutes = require("./routes/paymentAnalyticsRoutes");
const adminSettlementRoutes = require("./routes/adminSettlementRoutes");
const adminOfferRoutes = require("./routes/adminOfferRoutes");
const adminGstRoutes = require("./routes/adminGstRoutes");
const qzRoutes = require("./routes/qzRoutes");
const adminInventoryRoutes = require("./routes/adminInventoryRoutes");
const adminSupplierRoutes = require("./routes/adminSupplierRoutes");
const adminInvestmentRoutes = require("./routes/adminInvestmentRoutes");
const { requireAuth } = require("./middleware/auth");
const { UPLOAD_DIR } = require("./middleware/upload");
const ApiError = require("./utils/ApiError");

function createApp(clientOrigin) {
  const app = express();

  app.use(cors({ origin: clientOrigin }));
  app.use(compression());
  app.use(express.json());
  app.use("/uploads", express.static(UPLOAD_DIR));

  app.get("/health", (req, res) => res.json({ status: "ok" }));

  app.use("/api/menu", menuRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/otp", otpRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/restaurants", restaurantRoutes);
  app.use("/api/tables", tableRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/qz", qzRoutes);

  // Every /api/admin/* route requires a valid staff JWT from here down.
  app.use("/api/admin", requireAuth);
  app.use("/api/admin/menu", adminMenuRoutes);
  app.use("/api/admin/tables", adminTableRoutes);
  app.use("/api/admin/staff", adminStaffRoutes);
  app.use("/api/admin/reservations", adminReservationRoutes);
  app.use("/api/admin/table-sessions", adminTableSessionRoutes);
  app.use("/api/admin/orders", adminOrderRoutes);
  app.use("/api/admin/categories", categoryRoutes);
  app.use("/api/admin/upload", uploadRoutes);
  app.use("/api/admin/dashboard", dashboardRoutes);
  app.use("/api/admin/customers", customerRoutes);
  app.use("/api/admin/payments", paymentAnalyticsRoutes);
  app.use("/api/admin/settlements", adminSettlementRoutes);
  app.use("/api/admin/offers", adminOfferRoutes);
  app.use("/api/admin/gst", adminGstRoutes);
  // NOTE: these two were already implemented (controllers/routes existed
  // and frontend/src/lib/admin-api.ts already calls them for the Stock
  // Management page) but were never mounted here, so Stock Management's
  // ingredient/purchase/supplier calls were 404ing. Mounting them was
  // necessary groundwork for Investment & Expenses' required "automatically
  // increase stock quantity" integration to have a real inventory API to
  // call, and it also fixes those pre-existing 404s.
  app.use("/api/admin/inventory", adminInventoryRoutes);
  app.use("/api/admin/suppliers", adminSupplierRoutes);
  app.use("/api/admin/investment", adminInvestmentRoutes);

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