const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 16);

function generateSessionId() {
  return `sess_${nanoid()}`;
}

module.exports = generateSessionId;
