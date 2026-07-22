const Table = require("../models/Table");
const Reservation = require("../models/Reservation");
const TableSession = require("../models/TableSession");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const generateReservationId = require("../utils/generateReservationId");
const generateTableSessionId = require("../utils/generateTableSessionId");
const {
  emitTableReserved,
  emitTableAvailable,
  emitTableOccupied,
  emitReservationCreated,
  emitReservationUpdated,
  emitReservationCancelled,
  emitReservationCheckedIn,
  emitSessionStarted,
} = require("../sockets/socket");

// GET /api/admin/reservations/:restaurantId?date=YYYY-MM-DD&from=&to=
// Powers both the reservation list and the calendar (Today/Tomorrow/Week/
// Month are just different from/to ranges computed on the frontend).
const listReservations = asyncHandler(async (req, res) => {
  const { restaurantId } = req.params;
  const { date, from, to } = req.query;

  const filter = { restaurantId };
  if (date) {
    filter.reservationDate = date;
  } else if (from || to) {
    filter.reservationDate = {};
    if (from) filter.reservationDate.$gte = from;
    if (to) filter.reservationDate.$lte = to;
  }

  const reservations = await Reservation.find(filter).sort({ reservationDate: 1, reservationTime: 1 });
  res.json({ reservations });
});

// POST /api/admin/reservations
// Body: { restaurantId, tableId, customerName, phoneNumber, guestCount,
//         reservationDate, reservationTime, expectedDuration?, specialNotes? }
const createReservation = asyncHandler(async (req, res) => {
  const {
    restaurantId,
    tableId,
    customerName,
    phoneNumber,
    guestCount,
    reservationDate,
    reservationTime,
    expectedDuration,
    specialNotes,
  } = req.body;

  if (!restaurantId || !tableId || !customerName || !phoneNumber || !guestCount) {
    throw new ApiError(400, "restaurantId, tableId, customerName, phoneNumber and guestCount are required");
  }
  if (!reservationDate || !reservationTime) {
    throw new ApiError(400, "reservationDate and reservationTime are required");
  }

  const table = await Table.findById(tableId);
  if (!table) throw new ApiError(404, "Table not found");
  if (table.status !== "available") {
    throw new ApiError(400, `Table is currently "${table.status}" and cannot be reserved`);
  }

  const reservation = await Reservation.create({
    reservationId: generateReservationId(),
    restaurantId,
    tableId,
    customerName,
    phoneNumber,
    guestCount,
    reservationDate,
    reservationTime,
    expectedDuration: expectedDuration || 60,
    specialNotes: specialNotes || "",
    status: "confirmed",
  });

  table.status = "reserved";
  table.currentReservationId = reservation.reservationId;
  await table.save();

  emitTableReserved(table);
  emitReservationCreated(reservation);

  res.status(201).json({ reservation, table });
});

// PATCH /api/admin/reservations/:reservationId
// Edit reservation: guest count, time, notes, or reassign to another table.
const updateReservation = asyncHandler(async (req, res) => {
  const { customerName, phoneNumber, guestCount, reservationDate, reservationTime, expectedDuration, specialNotes, tableId } =
    req.body;

  const reservation = await Reservation.findOne({ reservationId: req.params.reservationId });
  if (!reservation) throw new ApiError(404, "Reservation not found");
  if (!["pending", "confirmed"].includes(reservation.status)) {
    throw new ApiError(400, `Cannot edit a reservation with status "${reservation.status}"`);
  }

  // Reassign to a different table ("Move Customer To Another Table" ready).
  if (tableId && tableId !== reservation.tableId.toString()) {
    const newTable = await Table.findById(tableId);
    if (!newTable) throw new ApiError(404, "Target table not found");
    if (newTable.status !== "available") {
      throw new ApiError(400, `Target table is currently "${newTable.status}"`);
    }

    const oldTable = await Table.findById(reservation.tableId);
    if (oldTable && oldTable.currentReservationId === reservation.reservationId) {
      oldTable.status = "available";
      oldTable.currentReservationId = null;
      await oldTable.save();
      emitTableAvailable(oldTable);
    }

    newTable.status = "reserved";
    newTable.currentReservationId = reservation.reservationId;
    await newTable.save();
    emitTableReserved(newTable);

    reservation.tableId = newTable._id;
  }

  if (customerName !== undefined) reservation.customerName = customerName;
  if (phoneNumber !== undefined) reservation.phoneNumber = phoneNumber;
  if (guestCount !== undefined) reservation.guestCount = guestCount;
  if (reservationDate !== undefined) reservation.reservationDate = reservationDate;
  if (reservationTime !== undefined) reservation.reservationTime = reservationTime;
  if (expectedDuration !== undefined) reservation.expectedDuration = expectedDuration;
  if (specialNotes !== undefined) reservation.specialNotes = specialNotes;

  await reservation.save();
  emitReservationUpdated(reservation);

  res.json({ reservation });
});

// DELETE /api/admin/reservations/:reservationId  (Cancel Reservation)
const cancelReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findOne({ reservationId: req.params.reservationId });
  if (!reservation) throw new ApiError(404, "Reservation not found");

  reservation.status = "cancelled";
  await reservation.save();

  const table = await Table.findById(reservation.tableId);
  if (table && table.currentReservationId === reservation.reservationId) {
    table.status = "available";
    table.currentReservationId = null;
    await table.save();
    emitTableAvailable(table);
  }

  emitReservationCancelled(reservation);
  res.json({ reservation });
});

// POST /api/admin/reservations/:reservationId/check-in
// Customer has arrived: starts a TableSession and occupies the table.
const checkInReservation = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findOne({ reservationId: req.params.reservationId });
  if (!reservation) throw new ApiError(404, "Reservation not found");
  if (!["pending", "confirmed"].includes(reservation.status)) {
    throw new ApiError(400, `Cannot check in a reservation with status "${reservation.status}"`);
  }

  const table = await Table.findById(reservation.tableId);
  if (!table) throw new ApiError(404, "Table not found");

  const existingActive = await TableSession.findOne({ tableId: table._id, status: "active" });
  if (existingActive) {
    throw new ApiError(400, "Table already has an active session");
  }

  const session = await TableSession.create({
    sessionId: generateTableSessionId(),
    restaurantId: reservation.restaurantId,
    tableId: table._id,
    tableToken: table.token,
    customerName: reservation.customerName,
    phoneNumber: reservation.phoneNumber,
    reservationId: reservation.reservationId,
    orderIds: [],
    sessionStart: new Date(),
    currentBill: 0,
    status: "active",
  });

  reservation.status = "checked_in";
  reservation.checkedInAt = new Date();
  await reservation.save();

  table.status = "occupied";
  table.currentSessionId = session.sessionId;
  table.occupiedAt = session.sessionStart;
  await table.save();

  emitReservationCheckedIn(reservation);
  emitSessionStarted(session);
  emitTableOccupied(table);

  res.json({ reservation, session, table });
});

// POST /api/admin/reservations/:reservationId/no-show
const markNoShow = asyncHandler(async (req, res) => {
  const reservation = await Reservation.findOne({ reservationId: req.params.reservationId });
  if (!reservation) throw new ApiError(404, "Reservation not found");
  if (!["pending", "confirmed"].includes(reservation.status)) {
    throw new ApiError(400, `Cannot mark no-show for a reservation with status "${reservation.status}"`);
  }

  reservation.status = "no_show";
  await reservation.save();

  const table = await Table.findById(reservation.tableId);
  if (table && table.currentReservationId === reservation.reservationId) {
    table.status = "available";
    table.currentReservationId = null;
    await table.save();
    emitTableAvailable(table);
  }

  emitReservationCancelled(reservation);
  res.json({ reservation });
});

module.exports = {
  listReservations,
  createReservation,
  updateReservation,
  cancelReservation,
  checkInReservation,
  markNoShow,
};
