const mongoose = require("mongoose");

const restaurantSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    logo: { type: String, default: "" },
    description: { type: String, default: "" },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    theme: {
      primaryColor: { type: String, default: "#3A4C3B" },
      secondaryColor: { type: String, default: "#263429" },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Restaurant", restaurantSchema);
