const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 16);

// Admin Manual Ordering (Tables & QR -> Create Order) has no QR browsing
// Session (models/Session.js) to attribute the order to — there was no scan.
// Order.sessionId is required, so this generates a standalone placeholder
// identifier instead, distinct from both "sess_" (QR browsing session) and
// "tsess_" (TableSession/dining occupancy) so the three concepts are never
// confused when logged or debugged side by side.
function generateAdminSessionId() {
  return `asess_${nanoid()}`;
}

module.exports = generateAdminSessionId;