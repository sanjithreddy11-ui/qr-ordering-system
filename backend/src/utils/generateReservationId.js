const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 16);

function generateReservationId() {
  return `resv_${nanoid()}`;
}

module.exports = generateReservationId;
