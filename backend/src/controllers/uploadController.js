const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");

// POST /api/admin/upload (multipart/form-data, field name "image")
// Returns a relative URL under /uploads/... that gets stored as a
// MenuItem's `image` field, same shape the field already used for
// hand-entered paths like "/fooditems/example.png".
const uploadImage = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ApiError(400, "No image file was uploaded");
  }
  res.status(201).json({ url: `/uploads/${req.file.filename}` });
});

module.exports = { uploadImage };
