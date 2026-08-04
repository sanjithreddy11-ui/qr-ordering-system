const Counter = require("../models/Counter");

// Format: BILL-000124 — a plain sequential number per restaurant, distinct
// from the Invoice Number's date-stamped/random format. Generated once per
// session (first Print Bill) and then kept stable for every reprint,
// mirroring how generateInvoiceNumber.js is used.
//
// $inc + findOneAndUpdate with upsert is atomic at the MongoDB level, so
// two "Print Bill" clicks landing at the same instant on two different
// tables still get distinct, never-repeating numbers.
async function generateBillNumber(restaurantId) {
  const counter = await Counter.findOneAndUpdate(
    { name: `bill:${restaurantId}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `BILL-${String(counter.seq).padStart(6, "0")}`;
}

module.exports = generateBillNumber;
