import type { MenuItem } from "@/lib/menu-data";
export type PaymentMethod = "upi" | "cash" | "card";

export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

export interface OrderItem {
  item: MenuItem;
  quantity: number;
}

export interface CheckoutForm {
  customerName: string;
  customerPhone: string;
  orderType: "dine-in" | "takeaway";
  specialInstructions: string;
  paymentMethod: PaymentMethod;
}

export interface Order {
  orderId: string;
  sessionId: string;
  restaurantId: string;
  tableToken: string;       // opaque token from QR code; backend resolves to real table
  tableLabel?: string | null;
  customerName?: string;
  customerPhone?: string;
  items: OrderItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  orderType: "dine-in" | "takeaway";
  specialInstructions: string;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  placedAt: string;         // ISO timestamp
  estimatedMinutes: number;
  // Only present on orders created via the Razorpay (upi/card) flow.
  paymentStatus?: "pending" | "paid";
  razorpayOrderId?: string | null;
  razorpayPaymentId?: string | null;
}
