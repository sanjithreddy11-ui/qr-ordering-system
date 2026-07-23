const Razorpay = require("razorpay");

// Warn (rather than exit like config/db.js does for MONGODB_URI) because the
// rest of the app — including the existing cash checkout flow — must keep
// working even for a restaurant that hasn't set up online payments yet.
// Only the /api/payments/* routes actually need these to be present. The
// Razorpay SDK itself throws synchronously if key_id is missing, so we
// only construct it when both env vars are present and export null
// otherwise; paymentController checks for that and returns a clean 500
// instead of crashing the whole server at boot.
let razorpay = null;

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.warn(
    "Missing RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET in .env file — online (UPI/card) checkout will fail until these are set."
  );
} else {
  razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
  });
}

module.exports = razorpay;
