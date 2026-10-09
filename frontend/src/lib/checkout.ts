// Customer checkout helpers — kept out of app/(customer)/checkout/page.tsx
// so the order-submission contract can be unit-tested without rendering React.
import { useCartStore, type CartEntry } from "@/store/cart-store";
import { useOrderStore } from "@/store/order-store";
import type { Order } from "@/types/order";
import type { PlaceOrderPayload } from "@/lib/api";

/**
 * Cart lines -> the `items` array POST /api/orders expects.
 *
 * Menu Item Customization (Modifiers): each cart entry's selected modifiers
 * are grouped back into { groupId, optionIds } — the shape the backend
 * validates against the menu item's own modifierGroups (see
 * backend/src/services/orderService.js:resolveLineModifiers). Omitted for a
 * plain item (entry.modifiers is undefined/empty).
 */
export function buildOrderItemsPayload(items: CartEntry[]): PlaceOrderPayload["items"] {
  return items.map((e) => ({
    id: e.item.id,
    quantity: e.quantity,
    modifiers:
      e.modifiers && e.modifiers.length > 0
        ? e.modifiers.map((m) => ({ groupId: m.groupId, optionIds: [m.optionId] }))
        : undefined,
  }));
}

/**
 * Submits the customer's cart as ONE order and, only once the backend has
 * accepted it, hands the cart's contents over to that order.
 *
 * Why this exists (KOT bug): the cart is persisted in localStorage
 * ("smartqr-cart") and nothing ever emptied it after a successful checkout.
 * So when the same customer ordered again at the same table, the new cart
 * still held the items of their previous order, and the second POST
 * /api/orders carried BOTH. The backend then (correctly) stored them all on
 * the new order, "new-order" was emitted with them, and the auto-printed KOT
 * listed the previous drink again.
 *
 * - If `place` rejects, nothing is touched: the cart stays intact so the
 *   customer can retry — an order is never silently lost.
 * - On success the order is recorded (for the order-success page) BEFORE the
 *   cart is emptied, so there's no moment where neither holds the items.
 * - Only the cart is emptied. Table session, QR token, visit/OTP state and
 *   previously placed orders are not modified.
 */
export async function placeOrderAndResetCart(place: () => Promise<Order>): Promise<Order> {
  const order = await place();
  useOrderStore.getState().setOrder(order);
  useCartStore.getState().clearCart();
  return order;
}
