const bcrypt = require("bcryptjs");
const Staff = require("../models/Staff");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

const SALT_ROUNDS = 10;

function serializeStaff(staff) {
  // Never return passwordHash to the client, under any circumstances.
  return {
    id: staff._id,
    restaurantId: staff.restaurantId,
    name: staff.name,
    role: staff.role,
    email: staff.email,
    phone: staff.phone,
    isActive: staff.isActive,
    createdAt: staff.createdAt,
  };
}

// GET /api/admin/staff/:restaurantId
const listStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.find({ restaurantId: req.params.restaurantId }).sort({ name: 1 });
  res.json({ staff: staff.map(serializeStaff) });
});

// POST /api/admin/staff
// Body: { restaurantId, name, role, email, phone, password }
const createStaff = asyncHandler(async (req, res) => {
  const { restaurantId, name, role, email, phone, password } = req.body;

  if (!restaurantId || !name || !role || !email || !password) {
    throw new ApiError(400, "restaurantId, name, role, email, and password are required");
  }
  if (!["admin", "kitchen", "waiter"].includes(role)) {
    throw new ApiError(400, "role must be 'admin', 'kitchen', or 'waiter'");
  }
  if (password.length < 6) {
    throw new ApiError(400, "password must be at least 6 characters");
  }

  const existing = await Staff.findOne({ restaurantId, email });
  if (existing) {
    throw new ApiError(409, "A staff member with this email already exists for this restaurant");
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const staff = await Staff.create({
    restaurantId,
    name,
    role,
    email,
    phone: phone || "",
    passwordHash,
    isActive: true,
  });

  res.status(201).json({ staff: serializeStaff(staff) });
});

// PATCH /api/admin/staff/:staffId
// Body: any subset of { name, role, email, phone, isActive, password }
const updateStaff = asyncHandler(async (req, res) => {
  const { name, role, email, phone, isActive, password } = req.body;
  const updates = {};

  if (name !== undefined) updates.name = name;
  if (email !== undefined) updates.email = email;
  if (phone !== undefined) updates.phone = phone;
  if (isActive !== undefined) updates.isActive = isActive;
  if (role !== undefined) {
    if (!["admin", "kitchen", "waiter"].includes(role)) {
      throw new ApiError(400, "role must be 'admin', 'kitchen', or 'waiter'");
    }
    updates.role = role;
  }
  if (password !== undefined) {
    if (password.length < 6) {
      throw new ApiError(400, "password must be at least 6 characters");
    }
    updates.passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  }

  const staff = await Staff.findByIdAndUpdate(req.params.staffId, updates, { new: true });
  if (!staff) throw new ApiError(404, "Staff member not found");

  res.json({ staff: serializeStaff(staff) });
});

// DELETE /api/admin/staff/:staffId
const deleteStaff = asyncHandler(async (req, res) => {
  const staff = await Staff.findByIdAndDelete(req.params.staffId);
  if (!staff) throw new ApiError(404, "Staff member not found");
  res.json({ deleted: true });
});

module.exports = { listStaff, createStaff, updateStaff, deleteStaff };
