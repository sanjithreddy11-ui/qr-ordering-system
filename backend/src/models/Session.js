const mongoose = require("mongoose");

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS) || 3;

const sessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, unique: true, index: true },
    restaurantId: { type: String, required: true, index: true },
    tableToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

sessionSchema.statics.TTL_HOURS = SESSION_TTL_HOURS;

sessionSchema.methods.isExpired = function () {
  return Date.now() > this.expiresAt.getTime();
};

module.exports = mongoose.model("Session", sessionSchema);
