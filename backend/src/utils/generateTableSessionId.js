const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 16);

// Distinct prefix from the QR browsing session ("sess_") so the two
// concepts are never confused when logged or debugged side by side.
function generateTableSessionId() {
  return `tsess_${nanoid()}`;
}

module.exports = generateTableSessionId;
