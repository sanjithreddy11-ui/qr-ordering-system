const { customAlphabet } = require("nanoid");

const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 5);

// Format: INV-YYYYMMDD-XXXXX — date-stamped so it's readable on a printed
// receipt, with a short random suffix so two sessions closed the same day
// never collide. Generated once per session (on first Print Bill, or at
// Collect Payment for upi/card) and then kept stable for any re-print.
function generateInvoiceNumber() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `INV-${y}${m}${d}-${nanoid()}`;
}

module.exports = generateInvoiceNumber;
