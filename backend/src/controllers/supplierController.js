const Supplier = require("../models/Supplier");
const Ingredient = require("../models/Ingredient");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

function serializeSupplier(supplier) {
  return {
    id: supplier._id,
    restaurantId: supplier.restaurantId,
    name: supplier.name,
    phone: supplier.phone,
    email: supplier.email,
    address: supplier.address,
    notes: supplier.notes,
    createdAt: supplier.createdAt,
  };
}

// GET /api/admin/suppliers/:restaurantId
const listSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find({ restaurantId: req.params.restaurantId, isDeleted: false }).sort({ name: 1 });
  res.json({ suppliers: suppliers.map(serializeSupplier) });
});

// POST /api/admin/suppliers
// Body: { restaurantId, name, phone, email, address, notes }
const createSupplier = asyncHandler(async (req, res) => {
  const { restaurantId, name, phone, email, address, notes } = req.body;
  if (!restaurantId || !name) {
    throw new ApiError(400, "restaurantId and name are required");
  }

  const supplier = await Supplier.create({
    restaurantId,
    name: name.trim(),
    phone: phone?.trim() || "",
    email: email?.trim() || "",
    address: address?.trim() || "",
    notes: notes?.trim() || "",
  });

  res.status(201).json({ supplier: serializeSupplier(supplier) });
});

// PATCH /api/admin/suppliers/:restaurantId/:supplierId
const updateSupplier = asyncHandler(async (req, res) => {
  const { restaurantId, supplierId } = req.params;
  const allowedFields = ["name", "phone", "email", "address", "notes"];

  const updates = {};
  for (const field of allowedFields) {
    if (field in req.body) updates[field] = req.body[field];
  }

  const supplier = await Supplier.findOneAndUpdate(
    { _id: supplierId, restaurantId, isDeleted: false },
    updates,
    { new: true }
  );
  if (!supplier) throw new ApiError(404, "Supplier not found");

  res.json({ supplier: serializeSupplier(supplier) });
});

// DELETE /api/admin/suppliers/:restaurantId/:supplierId
const deleteSupplier = asyncHandler(async (req, res) => {
  const { restaurantId, supplierId } = req.params;

  const inUse = await Ingredient.findOne({ restaurantId, supplierId, isDeleted: false });
  if (inUse) {
    throw new ApiError(409, `Cannot delete — "${inUse.name}" still uses this supplier`);
  }

  const supplier = await Supplier.findOneAndUpdate(
    { _id: supplierId, restaurantId, isDeleted: false },
    { isDeleted: true },
    { new: true }
  );
  if (!supplier) throw new ApiError(404, "Supplier not found");

  res.json({ deleted: true });
});

module.exports = { listSuppliers, createSupplier, updateSupplier, deleteSupplier };
