const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Staff = require("../models/Staff");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { JWT_SECRET } = require("../middleware/auth");

const TOKEN_TTL = "12h";

// POST /api/auth/login
// Body: { restaurantId, email, password }
// Looks up the Staff record (existing model — previously created but never
// wired to anything, see the note in models/Staff.js) and issues a JWT.
const login = asyncHandler(async (req, res) => {
  const { restaurantId, email, password } = req.body;

  if (!restaurantId || !email || !password) {
    throw new ApiError(400, "restaurantId, email, and password are required");
  }

  const staff = await Staff.findOne({ restaurantId, email });
  if (!staff || !staff.isActive) {
    throw new ApiError(401, "Invalid email or password");
  }

  const valid = await bcrypt.compare(password, staff.passwordHash);
  if (!valid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const token = jwt.sign(
    {
      staffId: staff._id,
      restaurantId: staff.restaurantId,
      role: staff.role,
      email: staff.email,
      name: staff.name,
    },
    JWT_SECRET,
    { expiresIn: TOKEN_TTL }
  );

  res.json({
    token,
    staff: {
      id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      restaurantId: staff.restaurantId,
    },
  });
});

// GET /api/auth/me
// Lets the frontend verify an existing token / rehydrate the logged-in
// staff member on page load, without re-sending credentials.
const me = asyncHandler(async (req, res) => {
  const staff = await Staff.findById(req.staff.staffId);
  if (!staff || !staff.isActive) {
    throw new ApiError(401, "Invalid session");
  }
  res.json({
    staff: {
      id: staff._id,
      name: staff.name,
      email: staff.email,
      role: staff.role,
      restaurantId: staff.restaurantId,
    },
  });
});

module.exports = { login, me };
