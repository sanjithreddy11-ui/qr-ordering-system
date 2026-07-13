const mongoose = require("mongoose");

// NOTE: This model exists so the admin dashboard can manage staff records
// (name, role, contact info). It intentionally does NOT gate access to
// anything yet — no route currently checks a logged-in staff member's
// identity or role. Passwords are hashed and stored so this is ready to
// wire up to real authentication later, but until that middleware exists,
// creating a Staff record does not grant that person any special access.
const staffSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, index: true },
    name: { type: String, required: true },
    role: { type: String, enum: ["admin", "kitchen", "waiter"], required: true },
    email: { type: String, required: true },
    phone: { type: String, default: "" },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

staffSchema.index({ restaurantId: 1, email: 1 }, { unique: true });

module.exports = mongoose.model("Staff", staffSchema);
