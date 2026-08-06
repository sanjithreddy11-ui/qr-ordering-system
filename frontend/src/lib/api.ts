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
  const res = await fetch(API_ENDPOINTS.menu(restaurantId), {
    next: { revalidate: 30 },
  });
  const data = await handle<{ menu: MenuCategory[] }>(res);
  return data.menu;
}

export async function sendOtp(phone: string): Promise<void> {
  const res = await fetch(API_ENDPOINTS.otpSend(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone }),
  });
  await handle<{ success: boolean }>(res);
}

export async function verifyOtp(phone: string, otp: string): Promise<string> {
  const res = await fetch(API_ENDPOINTS.otpVerify(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phone, otp }),
  });
  const data = await handle<{ verified: boolean; token: string }>(res);
  return data.token;
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

// verificationToken is the token returned by verifyOtp() above, once the
// customer has confirmed the OTP for this phone. The backend re-checks it
// against the phone number on this order before creating it — see
// backend/src/middleware/verifyPhoneToken.js.
export async function placeOrder(payload: PlaceOrderPayload, verificationToken: string): Promise<Order> {
  const res = await fetch(API_ENDPOINTS.orders(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${verificationToken}`,
    },
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
  const res = await fetch(API_ENDPOINTS.restaurant(restaurantId), {
    next: { revalidate: 60 },
  });
  const data = await handle<{ restaurant: Restaurant }>(res);
  return data.restaurant;
}

// Resolves a human-readable table label ("Table 5") from the raw QR token
// in the URL, so customer-facing UI (like the waiter-call button) never
// has to show staff the raw token.
export async function fetchTableByToken(
  token: string
): Promise<{ token: string; label: string; restaurantId: string }> {
  const res = await fetch(API_ENDPOINTS.tableByToken(token), { cache: "no-store" });
  return handle(res);
}