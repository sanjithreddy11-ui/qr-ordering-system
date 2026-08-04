const fs = require("fs");
const path = require("path");
const multer = require("multer");

const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "uploads");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
    cb(null, unique);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only JPEG, PNG, WEBP, and GIF images are allowed"));
    }
    cb(null, true);
  },
});

// Investment & Expenses Module: invoice uploads for Purchases/Expenses/
// Assets. Kept as its own multer instance (separate from `upload` above)
// because invoices need to accept PDFs on top of images, while every
// existing caller of `upload` (Menu images, etc.) should keep behaving
// exactly as before.
const INVOICE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/jpg", "application/pdf"]);

const invoiceUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB — invoices can be scanned multi-page PDFs
  fileFilter: (req, file, cb) => {
    if (!INVOICE_MIME_TYPES.has(file.mimetype)) {
      return cb(new Error("Only PDF, PNG, JPEG, and JPG invoices are allowed"));
    }
    cb(null, true);
  },
});

module.exports = { upload, invoiceUpload, UPLOAD_DIR };
