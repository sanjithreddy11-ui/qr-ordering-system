import { API_ENDPOINTS } from "@/constants/api-endpoints";
import type { MenuCategory } from "@/lib/menu-data";
import type { Order, PaymentMethod } from "@/types/order";
import type { Restaurant } from "@/types/session";

class ApiRequestError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiRequestError(res.status, body?.error ?? "Request failed");
  }
  return body as T;
}

export async function fetchMenu(restaurantId: string): Promise<MenuCategory[]> {
  const res = await fetch(API_ENDPOINTS.menu(restaurantId), { cache: "no-store" });
  const data = await handle<{ menu: MenuCategory[] }>(res);
  return data.menu;
}

export interface PlaceOrderPayload {
  sessionId: string;
  restaurantId: string;
  tableToken: string;
  items: { id: string; quantity: number }[];
  orderType: "dine-in" | "takeaway";
  specialInstructions: string;
  paymentMethod: PaymentMethod;
  customerName?: string;
  customerPhone?: string;
}

export async function placeOrder(payload: PlaceOrderPayload): Promise<Order> {
  const res = await fetch(API_ENDPOINTS.orders(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ order: Order }>(res);
  return data.order;
}

export async function fetchOrder(orderId: string): Promise<Order> {
  const res = await fetch(API_ENDPOINTS.order(orderId), { cache: "no-store" });
  const data = await handle<{ order: Order }>(res);
  return data.order;
}

export async function fetchOrdersForRestaurant(
  restaurantId: string,
  status?: string
): Promise<Order[]> {
  const res = await fetch(API_ENDPOINTS.ordersByRestaurant(restaurantId, status), {
    cache: "no-store",
  });
  const data = await handle<{ orders: Order[] }>(res);
  return data.orders;
}

export async function updateOrderStatus(
  orderId: string,
  status: string
): Promise<Order> {
  const res = await fetch(API_ENDPOINTS.orderStatus(orderId), {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  });
  const data = await handle<{ order: Order }>(res);
  return data.order;
}

export interface CreateSessionResponse {
  sessionId: string;
  restaurantId: string;
  tableToken: string;
  expiresAt: string;
}

export async function createSession(payload: {
  restaurantId: string;
  tableToken: string;
}): Promise<CreateSessionResponse> {
  const res = await fetch(API_ENDPOINTS.sessions(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle<CreateSessionResponse>(res);
}

export async function getSessionStatus(
  sessionId: string
): Promise<{ valid: boolean; expiresAt?: string }> {
  const res = await fetch(API_ENDPOINTS.sessionStatus(sessionId), { cache: "no-store" });
  return handle<{ valid: boolean; expiresAt?: string }>(res);
}

export async function fetchOrdersBySession(
  sessionId: string
): Promise<{ active: Order[]; past: Order[] }> {
  const res = await fetch(API_ENDPOINTS.ordersBySession(sessionId), { cache: "no-store" });
  return handle<{ active: Order[]; past: Order[] }>(res);
}

export async function fetchRestaurant(restaurantId: string): Promise<Restaurant> {
  const res = await fetch(API_ENDPOINTS.restaurant(restaurantId), { cache: "no-store" });
  const data = await handle<{ restaurant: Restaurant }>(res);
  return data.restaurant;
}

// --- Razorpay Standard Checkout (upi/card) ---
// Same payload shape as placeOrder above — this is the online-payment
// counterpart of POST /api/orders. The order itself is NOT created by
// this call; see verifyRazorpayPayment below.
export type CreateRazorpayOrderPayload = PlaceOrderPayload;

export interface CreateRazorpayOrderResponse {
  razorpayOrderId: string;
  amount: number; // in paise
  currency: string;
  keyId: string;
}

export async function createRazorpayOrder(
  payload: CreateRazorpayOrderPayload
): Promise<CreateRazorpayOrderResponse> {
  const res = await fetch(API_ENDPOINTS.paymentsCreateOrder(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handle<CreateRazorpayOrderResponse>(res);
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

// Only once this succeeds does the backend create the real order — the
// response shape matches placeOrder's, so callers can treat both the same.
export async function verifyRazorpayPayment(payload: VerifyPaymentPayload): Promise<Order> {
  const res = await fetch(API_ENDPOINTS.paymentsVerify(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await handle<{ order: Order }>(res);
  return data.order;
}
