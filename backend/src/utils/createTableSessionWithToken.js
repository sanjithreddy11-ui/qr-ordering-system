const TableSession = require("../models/TableSession");
const getBusinessDate = require("./getBusinessDate");

// Daily Token Number System: creates a new TableSession stamped with the
// next token number for `sessionData.restaurantId`, today. This is the
// SINGLE place a dining session is ever created with a token number — both
// the QR/Admin order flow (services/orderService.js:syncTableOccupancyForOrder,
// the very first order of a visit) and the Reservations Check-In flow
// (controllers/reservationController.js:checkInReservation) call this
// instead of `TableSession.create(...)` directly, so the numbering rule
// lives in exactly one place and the two flows can never disagree about
// what the next token should be.
//
// The token is computed by reading the highest tokenNumber already issued
// today for this restaurant (scoped by businessDate — see
// getBusinessDate.js, which is also why the sequence resets to 1 on its
// own every day, with no cron job) and adding one. That read-then-insert
// has a small race window if two sessions for the same restaurant start at
// the exact same instant; the unique {restaurantId, businessDate,
// tokenNumber} index on TableSession (see the model) turns a would-be
// duplicate token into a duplicate-key error instead, which this retries a
// few times against a freshly-read highest tokenNumber rather than ever
// handing the same token to two sessions.
const MAX_ATTEMPTS = 5;

async function createTableSessionWithToken(sessionData) {
  const businessDate = getBusinessDate();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const latest = await TableSession.findOne({ restaurantId: sessionData.restaurantId, businessDate })
      .sort({ tokenNumber: -1 })
      .select("tokenNumber")
      .lean();
    const tokenNumber = (latest?.tokenNumber || 0) + 1;

    try {
      return await TableSession.create({ ...sessionData, tokenNumber, businessDate });
    } catch (err) {
      const isTokenCollision = err?.code === 11000 && err?.keyPattern && "tokenNumber" in err.keyPattern;
      if (!isTokenCollision || attempt === MAX_ATTEMPTS) throw err;
      // Someone else just took this exact token — loop and re-read the new
      // highest tokenNumber for another attempt.
    }
  }
}

module.exports = createTableSessionWithToken;
