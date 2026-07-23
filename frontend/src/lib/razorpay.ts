// Loads the Razorpay Standard Checkout script (https://checkout.razorpay.com/v1/checkout.js)
// exactly once, and resolves once window.Razorpay is available. Safe to
// call every time the customer taps "Place Order" — it's a no-op if the
// script is already loaded or loading.

declare global {
  interface Window {
    Razorpay: RazorpayConstructor;
  }
}

// Minimal typing for the parts of the Razorpay Checkout JS API this app
// actually uses — the SDK itself ships no official TypeScript types.
export interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export interface RazorpayOptions {
  key: string;
  amount: number;
  currency: string;
  name: string;
  description?: string;
  order_id: string;
  prefill?: { name?: string; contact?: string };
  theme?: { color?: string };
  method?: { upi?: boolean; card?: boolean };
  handler: (response: RazorpaySuccessResponse) => void;
  modal?: { ondismiss?: () => void };
}

interface RazorpayInstance {
  open: () => void;
  on: (event: "payment.failed", handler: (response: { error: { description?: string } }) => void) => void;
}

type RazorpayConstructor = new (options: RazorpayOptions) => RazorpayInstance;

const CHECKOUT_SRC = "https://checkout.razorpay.com/v1/checkout.js";
const SCRIPT_ID = "razorpay-checkout-script";

export function loadRazorpayCheckout(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if (window.Razorpay) {
      resolve(true);
      return;
    }

    const existing = document.getElementById(SCRIPT_ID);
    if (existing) {
      existing.addEventListener("load", () => resolve(true));
      existing.addEventListener("error", () => resolve(false));
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = CHECKOUT_SRC;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}
