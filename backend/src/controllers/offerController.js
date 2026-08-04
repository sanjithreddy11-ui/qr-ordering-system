const Offer = require("../models/Offer");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const DISCOUNT_TYPES = ["flat", "percentage"];

function serializeOffer(offer) {
  return {
    id: offer._id,
    restaurantId: offer.restaurantId,
    name: offer.name,
    discountType: offer.discountType,
    discountValue: offer.discountValue,
    minOrderAmount: offer.minOrderAmount,
    isActive: offer.isActive,
    createdAt: offer.createdAt,
  };
}

function validateDiscount(discountType, discountValue) {
  if (!DISCOUNT_TYPES.includes(discountType)) {
    throw new ApiError(400, "discountType must be 'flat' or 'percentage'");
  }
  if (typeof discountValue !== "number" || Number.isNaN(discountValue) || discountValue <= 0) {
    throw new ApiError(400, "discountValue must be a positive number");
  }
  if (discountType === "percentage" && discountValue > 100) {
    throw new ApiError(400, "A percentage discount cannot exceed 100");
  }
}

// GET /api/admin/offers/:restaurantId
const listOffers = asyncHandler(async (req, res) => {
  const offers = await Offer.find({ restaurantId: req.params.restaurantId }).sort({ createdAt: -1 }).lean();
  res.json({ offers: offers.map(serializeOffer) });
});

// POST /api/admin/offers
// Body: { restaurantId, name, discountType, discountValue, minOrderAmount? }
const createOffer = asyncHandler(async (req, res) => {
  const { restaurantId, name, discountType, discountValue, minOrderAmount } = req.body;

  if (!restaurantId || !name || !name.trim()) {
    throw new ApiError(400, "restaurantId and name are required");
  }
  validateDiscount(discountType, discountValue);
  if (minOrderAmount !== undefined && (typeof minOrderAmount !== "number" || minOrderAmount < 0)) {
    throw new ApiError(400, "minOrderAmount must be a non-negative number");
  }

  const offer = await Offer.create({
    restaurantId,
    name: name.trim(),
    discountType,
    discountValue,
    minOrderAmount: minOrderAmount || 0,
    isActive: true,
  });

  res.status(201).json({ offer: serializeOffer(offer) });
});

// PATCH /api/admin/offers/:offerId
// Body: any subset of { name, discountType, discountValue, minOrderAmount, isActive }
// Used for both full edits and the Enable/Disable toggle (isActive only).
const updateOffer = asyncHandler(async (req, res) => {
  const { name, discountType, discountValue, minOrderAmount, isActive } = req.body;
  const updates = {};

  if (name !== undefined) {
    if (!name.trim()) throw new ApiError(400, "name cannot be empty");
    updates.name = name.trim();
  }
  if (discountType !== undefined || discountValue !== undefined) {
    const existing = await Offer.findById(req.params.offerId);
    if (!existing) throw new ApiError(404, "Offer not found");
    const nextType = discountType !== undefined ? discountType : existing.discountType;
    const nextValue = discountValue !== undefined ? discountValue : existing.discountValue;
    validateDiscount(nextType, nextValue);
    updates.discountType = nextType;
    updates.discountValue = nextValue;
  }
  if (minOrderAmount !== undefined) {
    if (typeof minOrderAmount !== "number" || minOrderAmount < 0) {
      throw new ApiError(400, "minOrderAmount must be a non-negative number");
    }
    updates.minOrderAmount = minOrderAmount;
  }
  if (isActive !== undefined) updates.isActive = isActive;

  const offer = await Offer.findByIdAndUpdate(req.params.offerId, updates, { new: true });
  if (!offer) throw new ApiError(404, "Offer not found");

  res.json({ offer: serializeOffer(offer) });
});

// DELETE /api/admin/offers/:offerId
const deleteOffer = asyncHandler(async (req, res) => {
  const offer = await Offer.findByIdAndDelete(req.params.offerId);
  if (!offer) throw new ApiError(404, "Offer not found");
  res.json({ deleted: true });
});

module.exports = { listOffers, createOffer, updateOffer, deleteOffer };
