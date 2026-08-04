const mongoose = require("mongoose");

// GST Management Module: one document per restaurant, holding everything
// needed to compute and print GST correctly across the app (Menu
// Management, Billing, Printed Receipts, GST Dashboard/Reports).
//
// Deliberately kept as its own collection (rather than bolted onto
// Restaurant.js) so the tax-configuration concern stays isolated and can
// grow (IGST, CESS, HSN/SAC, state-wise slabs) without touching the core
// Restaurant profile document.
const CALCULATION_MODES = ["inclusive", "exclusive"];

const gstSettingsSchema = new mongoose.Schema(
  {
    restaurantId: { type: String, required: true, unique: true, index: true },

    // --- Business / statutory details shown on the printed invoice ---
    // Defaults fall back to Restaurant.name / Restaurant.address /
    // Restaurant.gstNumber at read time (see gstService.getSettings) so a
    // restaurant that hasn't touched GST Settings yet still gets sensible
    // values instead of blanks.
    businessName: { type: String, default: "" },
    gstin: { type: String, default: "" },
    businessAddress: { type: String, default: "" },

    // --- Calculation behavior ---
    calculationMode: { type: String, enum: CALCULATION_MODES, default: "exclusive" },
    defaultGstPercentage: { type: Number, default: 5, min: 0, max: 100 },
    enabled: { type: Boolean, default: true },

    // --- GST Slabs Module ---
    // Every percentage a menu item can be assigned to (Menu Management ->
    // item form -> GST Slab). The default GST % above must always be one
    // of these — enforced in gstService.upsertSettings.
    slabs: { type: [Number], default: [5, 12, 18, 28] },

    // --- Future-ready fields (not yet applied to billing calculations,
    // but modeled now so turning them on later needs no schema change) ---
    // IGST: IGST is only relevant for inter-state supply; today every
    // order is treated as intra-state (CGST+SGST split). Once the
    // restaurant's home state is known and a customer/billing state is
    // captured, orderService/gstService can branch to IGST instead of
    // CGST+SGST using this flag.
    igstEnabled: { type: Boolean, default: false },
    stateCode: { type: String, default: "" }, // e.g. "27" for Maharashtra
    // CESS: some categories (aerated drinks, luxury items, tobacco) also
    // attract a Compensation Cess on top of GST.
    cessEnabled: { type: Boolean, default: false },
    defaultCessPercentage: { type: Number, default: 0, min: 0, max: 100 },
  },
  { timestamps: true }
);

gstSettingsSchema.statics.CALCULATION_MODES = CALCULATION_MODES;

module.exports = mongoose.model("GstSettings", gstSettingsSchema);
