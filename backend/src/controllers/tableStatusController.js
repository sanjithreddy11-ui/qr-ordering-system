const Table = require("../models/Table");
const TableSession = require("../models/TableSession");
const Reservation = require("../models/Reservation");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { sortTablesByLabel } = require("../utils/sortTablesByLabel");
const {
  emitTableBilling,
  emitTableCleaning,
  emitTableAvailable,
  emitTableOutOfService,
  emitSessionEnded,
} = require("../sockets/socket");

// Tables created before the status-lifecycle fields were added to the
// schema have no `status`/`capacity`/etc. stored in Mongo at all. `.lean()`
// returns the raw stored document and does NOT apply Mongoose schema
// defaults (those only get applied when hydrating a full Document), so
// without this, older tables come back with `status: undefined` and break
// any code that keys off it (e.g. STATUS_META[status] on the frontend).
// This backfills the same defaults declared in models/Table.js.
function normalizeTable(table) {
  return {
    ...table,
    status: table.status || "available",
    capacity: table.capacity ?? 4,
    currentSessionId: table.currentSessionId ?? null,
    currentReservationId: table.currentReservationId ?? null,
    occupiedAt: table.occupiedAt ?? null,
  };
}

// GET /api/admin/tables/:restaurantId/grid
// Enriched table list for the live Table Grid: each table plus its active
// session (if occupied/billing) and active reservation (if reserved).
const getTableGrid = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const rawTables = await Table.find({ restaurantId }).lean();
  const tables = sortTablesByLabel(rawTables.map(normalizeTable));

  const sessionIds = tables.map((t) => t.currentSessionId).filter(Boolean);
  const reservationIds = tables.map((t) => t.currentReservationId).filter(Boolean);

  const [sessions, reservations] = await Promise.all([
    sessionIds.length
      ? TableSession.find({ sessionId: { $in: sessionIds } }).lean()
      : [],
    reservationIds.length
      ? Reservation.find({ reservationId: { $in: reservationIds } }).lean()
      : [],
  ]);

  const sessionById = new Map(sessions.map((s) => [s.sessionId, s]));
  const reservationById = new Map(reservations.map((r) => [r.reservationId, r]));

  const grid = tables.map((table) => ({
    ...table,
    activeSession: table.currentSessionId ? sessionById.get(table.currentSessionId) || null : null,
    activeReservation: table.currentReservationId
      ? reservationById.get(table.currentReservationId) || null
      : null,
  }));

  res.json({ tables: grid });
});

// GET /api/admin/tables/:tableId/details
// Full detail view for the table-details drawer/modal.
const getTableDetails = asyncHandler(async (req, res) => {
  const rawTable = await Table.findById(req.params.tableId).lean();
  if (!rawTable) throw new ApiError(404, "Table not found");
  const table = normalizeTable(rawTable);

  const [activeSession, activeReservation] = await Promise.all([
    table.currentSessionId ? TableSession.findOne({ sessionId: table.currentSessionId }).lean() : null,
    table.currentReservationId
      ? Reservation.findOne({ reservationId: table.currentReservationId }).lean()
      : null,
  ]);

  res.json({ table, activeSession, activeReservation });
});

// PATCH /api/admin/tables/:tableId/billing
// Manual-only transition: admin taps this when the customer asks for the
// bill. Never triggered automatically by a payment event.
const markBilling = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, "Table not found");
  if (table.status !== "occupied") {
    throw new ApiError(400, `Cannot move to billing from status "${table.status}"`);
  }

  table.status = "billing";
  await table.save();

  emitTableBilling(table);
  res.json({ table });
});

// PATCH /api/admin/tables/:tableId/close-session
// Admin action once the customer has paid and left: ends the active
// TableSession and moves the table to Cleaning.
const closeSession = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, "Table not found");

  const session = table.currentSessionId
    ? await TableSession.findOne({ sessionId: table.currentSessionId, status: "active" })
    : null;

  if (session) {
    session.status = "closed";
    session.sessionEnd = new Date();
    await session.save();
    emitSessionEnded(session);
  }

  table.status = "cleaning";
  table.currentSessionId = null;
  table.currentReservationId = null;
  table.occupiedAt = null;
  await table.save();

  emitTableCleaning(table);
  res.json({ table, closedSession: session });
});

// PATCH /api/admin/tables/:tableId/available
// Used both for "Mark Available" after cleaning and to clear a table
// manually (e.g. from Out of Service).
const markAvailable = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, "Table not found");

  table.status = "available";
  table.currentSessionId = null;
  table.currentReservationId = null;
  table.occupiedAt = null;
  await table.save();

  emitTableAvailable(table);
  res.json({ table });
});

// PATCH /api/admin/tables/:tableId/out-of-service
const markOutOfService = asyncHandler(async (req, res) => {
  const table = await Table.findById(req.params.tableId);
  if (!table) throw new ApiError(404, "Table not found");

  table.status = "out_of_service";
  await table.save();

  emitTableOutOfService(table);
  res.json({ table });
});

// GET /api/admin/tables/:restaurantId/analytics
const getTableAnalytics = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;

  const tables = (await Table.find({ restaurantId }).lean()).map(normalizeTable);
  const counts = {
    available: 0,
    reserved: 0,
    occupied: 0,
    billing: 0,
    cleaning: 0,
    out_of_service: 0,
  };
  for (const t of tables) counts[t.status] = (counts[t.status] || 0) + 1;

  // Closed sessions in the last 30 days power duration/turnover stats.
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const closedSessions = await TableSession.find({
    restaurantId,
    status: "closed",
    sessionEnd: { $gte: since },
  }).lean();

  const durationsMinutes = closedSessions
    .filter((s) => s.sessionStart && s.sessionEnd)
    .map((s) => (new Date(s.sessionEnd) - new Date(s.sessionStart)) / 60000);

  const averageDiningDurationMinutes = durationsMinutes.length
    ? Math.round(durationsMinutes.reduce((a, b) => a + b, 0) / durationsMinutes.length)
    : 0;

  const sessionsPerTable = new Map();
  for (const s of closedSessions) {
    sessionsPerTable.set(s.tableId.toString(), (sessionsPerTable.get(s.tableId.toString()) || 0) + 1);
  }
  const tableById = new Map(tables.map((t) => [t._id.toString(), t]));
  const mostUsedTables = Array.from(sessionsPerTable.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([tableId, count]) => ({ tableId, label: tableById.get(tableId)?.label ?? tableId, sessionCount: count }));

  const averageTurnoverPerTable = tables.length
    ? Math.round((closedSessions.length / tables.length) * 100) / 100
    : 0;

  const reservationCounts = await Reservation.aggregate([
    { $match: { restaurantId } },
    { $group: { _id: "$tableId", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
    { $limit: 5 },
  ]);
  const mostReservedTables = reservationCounts.map((r) => ({
    tableId: r._id.toString(),
    label: tableById.get(r._id.toString())?.label ?? r._id.toString(),
    reservationCount: r.count,
  }));

  res.json({
    counts,
    averageDiningDurationMinutes,
    averageTurnoverPerTable,
    mostUsedTables,
    mostReservedTables,
  });
});

module.exports = {
  getTableGrid,
  getTableDetails,
  markBilling,
  closeSession,
  markAvailable,
  markOutOfService,
  getTableAnalytics,
};
