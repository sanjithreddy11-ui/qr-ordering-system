require("dotenv").config();

const mongoose = require("mongoose");
const connectDB = require("../config/db");

const Order = require("../models/Order");
const Customer = require("../models/Customer");
const Session = require("../models/Session");
const TableSession = require("../models/TableSession");
const Settlement = require("../models/Settlement");
const Table = require("../models/Table");

// Clears all test/demo activity data before handing the project off:
//   - Orders, Customers, Sessions, TableSessions, Settlements: deleted entirely
//   - Tables: status reset to "available", session/reservation pointers cleared
// Does NOT touch Restaurant, MenuItem, or Staff — run `npm run seed`
// separately if you also want to reset those to their defaults.

async function resetData() {
  try {
    await connectDB();

    console.log("Deleting orders...");
    const orders = await Order.deleteMany({});
    console.log(`  removed ${orders.deletedCount} order(s)`);

    console.log("Deleting customers...");
    const customers = await Customer.deleteMany({});
    console.log(`  removed ${customers.deletedCount} customer(s)`);

    console.log("Deleting sessions...");
    const sessions = await Session.deleteMany({});
    console.log(`  removed ${sessions.deletedCount} session(s)`);

    // Table dining sessions (Table Management) are a separate collection
    // from the browsing Sessions above — must be cleared too, or any
    // session left "active" at reset time becomes orphaned: it still
    // points at a table that's about to be reset to "available", so the
    // very next order silently attaches to it without ever re-marking the
    // table Occupied (see orderService.js:syncTableOccupancyForOrder).
    console.log("Deleting table sessions...");
    const tableSessions = await TableSession.deleteMany({});
    console.log(`  removed ${tableSessions.deletedCount} table session(s)`);

    console.log("Deleting settlements...");
    const settlements = await Settlement.deleteMany({});
    console.log(`  removed ${settlements.deletedCount} settlement(s)`);

    console.log("Resetting table statuses...");
    const tables = await Table.updateMany(
      {},
      {
        $set: {
          status: "available",
          currentSessionId: null,
          currentReservationId: null,
          occupiedAt: null,
        },
      }
    );
    console.log(`  reset ${tables.modifiedCount} table(s)`);

    console.log(
      "Reset complete. Orders, Customers, Sessions, TableSessions, and Settlements cleared; Tables set to available."
    );

    await mongoose.connection.close();
    process.exit(0);
  } catch (err) {
    console.error("Reset failed:", err);

    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

resetData();