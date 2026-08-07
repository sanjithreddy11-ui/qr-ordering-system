import type { MenuItem, SelectedModifier } from "@/lib/menu-data";
export type PaymentMethod = "upi" | "cash" | "card";

export type OrderStatus = "pending" | "preparing" | "ready" | "completed" | "cancelled";

// The `item` on an order is a *snapshot* taken at order time (see backend
// models/Order.js), not a live MenuItem — it additionally carries the
// category the item belonged to at that moment, which KOT printing uses to
// route the line to the Kitchen Printer or Counter Printer. Optional so any
// pre-existing order snapshot missing these fields doesn't break typing.
export interface OrderItem {
  item: MenuItem & { categoryId?: string; categoryTitle?: string };
  quantity: number;
  // Item-Level Order Management: each ordered line now has its own status
  // through the same lifecycle as the order used to as a whole — see
  // backend models/Order.js and the admin Orders page's Order Details
  // modal, where staff complete/cancel one item at a time. Optional/absent
  // on orders placed before this feature existed (treat as "pending").
  status?: OrderStatus;
  // Stable per-line id used to address this exact item — see
  // lib/admin-api.ts:orderItemLineKey for the array-index fallback used
  // when it's missing (pre-existing orders).
  lineId?: string;
  // Menu Item Customization (Modifiers): the selected sauce (or any future
  // modifier) for this exact line — absent/[] for a non-customizable item,
  // or any order placed before this feature existed. See
  // lib/menu-data.ts:SelectedModifier.
  modifiers?: SelectedModifier[];
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
  // Daily Token Number System: the dining session's token number, stamped
  // onto the order at creation time — see backend models/Order.js. Null
  // for takeaway/counter orders with no table session, or orders placed
  // before this feature existed.
  tokenNumber?: number | null;
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
  paymentStatus?: "pending" | "paid";
}