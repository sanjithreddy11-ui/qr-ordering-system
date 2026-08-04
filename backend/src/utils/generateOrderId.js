const { customAlphabet } = require("nanoid");

// Unambiguous alphabet: no 0/O, 1/I to avoid confusion when read aloud
// in a kitchen or typed in by staff.
const nanoid = customAlphabet("23456789ABCDEFGHJKLMNPQRSTUVWXYZ", 6);

function generateOrderId() {
  const today = new Date();
  const yy = String(today.getFullYear()).slice(-2);
  const mm = String(today.getMonth() + 1).padStart(2, "0");
  const dd = String(today.getDate()).padStart(2, "0");
  return `ORD-${yy}${mm}${dd}-${nanoid()}`;
}

module.exports = generateOrderId;
