const crypto = require("crypto");
const razorpay = require("../config/razorpay");
const PendingPayment = require("../models/PendingPayment");
const ApiError = require("../utils/ApiError");
const asyncHandler = require("../utils/asyncHandler");
const { validateAndBuildOrder, finalizeOrder } = require("../services/orderService");

// POST /api/payments/create-order
// Body: identical to POST /api/orders (see orderController) — this is the
// "upi"/"card" checkout flow, which pays online via Razorpay Standard
// Checkout instead of creating the order immediately.
//
// The order is NOT created here. We validate/price it exactly like the
// cash flow does (via services/orderService), stash that payload in
// PendingPayment keyed by the Razorpay order id, and only turn it into a
// real Order once /api/payments/verify confirms the payment signature.
const createPaymentOrder = asyncHandler(async (req, res) => {
  if (!razorpay) {
    throw new ApiError(500, "Online payments are not configured for this restaurant yet.");
  }

  const orderData = await validateAndBuildOrder(req.body);

  const amountInPaise = Math.round(orderData.totalAmount * 100);
  if (amountInPaise < 100) {
    throw new ApiError(400, "Order amount must be at least ₹1 to pay online");
  }

  let razorpayOrder;
  try {
    razorpayOrder = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: orderData.orderId,
      notes: {
        restaurantId: orderData.restaurantId,
        sessionId: orderData.sessionId,
        tableToken: orderData.tableToken,
      },
    });
  } catch (err) {
    // Covers both bad Razorpay credentials (auth failures) and any other
    // Razorpay API failure — neither should leak details to the client.
    console.error("Razorpay order creation failed:", err?.error || err);
    throw new ApiError(502, "Could not start payment. Please try again.");
  }

  await PendingPayment.create({
    razorpayOrderId: razorpayOrder.id,
    orderData,
    status: "created",
  });

  res.status(201).json({
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: process.env.RAZORPAY_KEY_ID,
  });
});

// POST /api/payments/verify
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
//
// The frontend's claim that a payment succeeded is never trusted — the
// HMAC signature (order_id|payment_id, signed with the Razorpay secret) is
// the only accepted proof. The Order document — and therefore its
// appearance on the Kitchen and Admin dashboards — is only ever created
// once that check passes.
const verifyPayment = asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    throw new ApiError(400, "Missing payment verification fields");
  }
  if (!process.env.RAZORPAY_KEY_SECRET) {
    throw new ApiError(500, "Online payments are not configured for this restaurant yet.");
  }

  const pending = await PendingPayment.findOne({ razorpayOrderId: razorpay_order_id });
  if (!pending) {
    throw new ApiError(404, "Payment session not found or expired. Please try again.");
  }
  if (pending.status === "paid") {
    throw new ApiError(409, "This payment has already been processed");
  }

  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  const expected = Buffer.from(expectedSignature, "utf8");
  const received = Buffer.from(razorpay_signature, "utf8");
  const isValid =
    expected.length === received.length && crypto.timingSafeEqual(expected, received);

  if (!isValid) {
    pending.status = "failed";
    await pending.save();
    throw new ApiError(400, "Payment verification failed");
  }

  pending.status = "paid";
  await pending.save();

  const order = await finalizeOrder({
    ...pending.orderData,
    paymentStatus: "paid",
    razorpayOrderId: razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
  });

  res.status(201).json({ order });
});

module.exports = { createPaymentOrder, verifyPayment };
