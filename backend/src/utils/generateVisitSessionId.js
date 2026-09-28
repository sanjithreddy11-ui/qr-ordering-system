const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 16);

// Distinct prefix from both the QR browsing session ("sess_") and the
// dining TableSession ("tsess_") so all three concepts are never confused
// when logged or debugged side by side.
function generateVisitSessionId() {
  return `visit_${nanoid()}`;
}

module.exports = generateVisitSessionId;
