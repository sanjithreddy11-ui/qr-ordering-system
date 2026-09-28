const crypto = require("crypto");
const VisitSession = require("../models/VisitSession");
const Customer = require("../models/Customer");
const Table = require("../models/Table");
const ApiError = require("../utils/ApiError");
const generateVisitSessionId = require("../utils/generateVisitSessionId");

// Visit-Based Customer Authentication (see models/VisitSession.js for the
// full design rationale). This service is the single place that creates,
// checks, and closes VisitSessions — every route that needs any of that
// behavior goes through here rather than touching the model directly, so
// the "same device + same active visit = no OTP" rule can never be
// accidentally bypassed or duplicated inconsistently across controllers.

// Find-or-create the permanent Customer identity for a phone number.
// Deliberately minimal — full stat maintenance (totalOrders/totalSpent/
// averageOrderValue/lastVisit) stays exactly where it already lived, in
// services/orderService.js:upsertCustomerFromOrder, called at checkout.
// This just makes sure a Customer row exists the moment OTP is verified
// (per the required First Visit flow: "Verify OTP -> Find/create customer
// -> Create ACTIVE visit session"), so VisitSession always has a real
// customerId to point at instead of inventing its own parallel identity.
async function findOrCreateCustomer(restaurantId, phone, name) {
  const existing = await Customer.findOne({ restaurantId, phone });
  if (existing) {
    // Backfill a real name if we only had a placeholder before and the
    // customer has now typed one in — never overwrite a real name with a
    // blank/placeholder one.
    if (name && existing.name === "Guest" && name !== "Guest") {
      existing.name = name;
      await existing.save();
    }
    return existing;
  }

  return Customer.create({
    restaurantId,
    phone,
    name: name || "Guest",
    totalOrders: 0,
    totalSpent: 0,
    averageOrderValue: 0,
    firstVisit: new Date(),
    lastVisit: new Date(),
  });
}

// GET /api/visit/status equivalent — used by the frontend BEFORE showing
// the phone/OTP form at all, so a returning customer on an already-trusted
// device during an already-open visit never sees the OTP screen. Trusting
// a bare deviceId here is the same trust level the app already gives the
// anonymous QR browsing Session (see controllers/sessionController.js:
// getSessionStatus) — it only ever confirms "yes, a visit is open", it
// never authorizes placing an order (see resolveActiveVisitByToken below,
// which order creation actually depends on).
async function getActiveVisitByDevice(restaurantId, deviceId) {
  if (!restaurantId || !deviceId) return null;
  return VisitSession.findOne({ restaurantId, deviceId, status: "active" });
}

// Creates a brand-new ACTIVE visit session immediately after a successful
// OTP verification. Defensive: if this device somehow already had an
// active visit (shouldn't happen — the frontend only calls this when
// getActiveVisitByDevice found none — but a stale tab, a race between two
// requests, etc. are all possible), that older one is superseded/closed
// first rather than left dangling, since only one active visit per device
// can ever exist (see the unique partial index on VisitSession).
async function createVisitSession({ restaurantId, tableToken, customerId, phone, deviceId }) {
  if (!deviceId) {
    throw new ApiError(400, "Missing device identifier. Please reload the page and try again.");
  }

  const table = await Table.findOne({ token: tableToken });
  if (!table) {
    throw new ApiError(404, "Invalid table. Please scan the QR code again.");
  }

  await VisitSession.updateMany(
    { restaurantId, deviceId, status: "active" },
    { $set: { status: "closed", endedAt: new Date(), endReason: "SUPERSEDED" } }
  );

  const token = crypto.randomBytes(32).toString("hex");

  const visit = await VisitSession.create({
    visitSessionId: generateVisitSessionId(),
    restaurantId,
    customerId,
    phone,
    tableId: table._id,
    tableToken: table.token,
    deviceId,
    token,
    status: "active",
    startedAt: new Date(),
  });

  return visit;
}

// Used by middleware/verifyPhoneToken.js at every order placement — the
// ONLY thing that actually authorizes creating an order during a visit.
// Never trusts phone/deviceId/customerId from the request body alone: the
// token must match an ACTIVE VisitSession AND that session's own stored
// phone must match the phone the order claims, exactly like the old
// PhoneVerification-token check it replaces.
async function resolveActiveVisitByToken(token, phone) {
  if (!token || !phone) return null;

  const visit = await VisitSession.findOne({ token, status: "active" });
  if (!visit) return null;
  if (visit.phone !== phone) return null;

  return visit;
}

// Called once a table's bill is successfully submitted (or, defensively,
// whenever its dining session otherwise ends — see collectPayment,
// collectSettlement, deleteSettlementCascade, closeSession) to invalidate
// every customer's visit-level OTP trust at that table. Multiple different
// customers/devices can have ordered under the same table, each with their
// own VisitSession, so this closes ALL of them, not just one. Never
// deletes — closed visits stay in the collection as history (per the
// "do not delete old sessions" requirement), same treatment TableSession
// already gives closed dining sessions.
async function closeActiveVisitSessionsForTable(tableId, endReason) {
  if (!tableId) return { closedCount: 0 };

  const result = await VisitSession.updateMany(
    { tableId, status: "active" },
    { $set: { status: "closed", endedAt: new Date(), endReason } }
  );

  return { closedCount: result.modifiedCount || 0 };
}

module.exports = {
  findOrCreateCustomer,
  getActiveVisitByDevice,
  createVisitSession,
  resolveActiveVisitByToken,
  closeActiveVisitSessionsForTable,
};
