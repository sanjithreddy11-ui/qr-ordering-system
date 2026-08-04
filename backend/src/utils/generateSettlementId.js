const Counter = require("../models/Counter");

// Format: STL-000123 — same pattern as generateBillNumber.js, on its own
// counter sequence so settlement IDs and bill numbers never collide.
async function generateSettlementId(restaurantId) {
  const counter = await Counter.findOneAndUpdate(
    { name: `settlement:${restaurantId}` },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return `STL-${String(counter.seq).padStart(6, "0")}`;
}

module.exports = generateSettlementId;
