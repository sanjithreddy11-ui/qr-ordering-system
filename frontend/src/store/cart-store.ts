import { create } from "zustand";
import { persist } from "zustand/middleware";
import { cartEntryKey, type MenuItem, type SelectedModifier } from "@/lib/menu-data";
const TAX_RATE = 0.05;

export interface CartEntry {
  item: MenuItem;
  quantity: number;
  // Menu Item Customization (Modifiers): the selected sauce (or any future
  // modifier) for this exact cart line. Undefined/[] for a plain item.
  // Two entries can share the same item.id as long as their modifiers
  // differ — see cartEntryKey in lib/menu-data.ts, which is what
  // distinguishes them everywhere in this store.
  modifiers?: SelectedModifier[];
}

// A cart line's effective unit price — the base menu price plus any
// selected modifier's priceDelta (0 for every sauce today, but this keeps
// totals correct the moment a paid modifier exists).
function entryUnitPrice(entry: CartEntry): number {
  const modifierDelta = (entry.modifiers ?? []).reduce((sum, m) => sum + (m.priceDelta || 0), 0);
  return entry.item.price + modifierDelta;
}

function keyOf(entry: Pick<CartEntry, "item" | "modifiers">): string {
  return cartEntryKey(entry.item.id, entry.modifiers);
}

interface CartStore {
  items: CartEntry[];
  restaurantId: string | null;
  tableToken: string | null;    // opaque token from QR URL segment

  // `modifiers` is required for any item with a required modifier group —
  // enforced upstream by the customization modal (components/customer/
  // ModifierModal.tsx), never by this store. A second addItem call for the
  // same item + same modifiers increments that line's quantity; different
  // modifiers create a new, separate line instead of merging.
  addItem: (item: MenuItem, modifiers?: SelectedModifier[], restaurantId?: string, tableToken?: string) => void;
  // Decrements the matching line (by item + modifiers) by one, removing it
  // once it reaches zero. Falls back to the first entry for this item.id
  // when no modifiers are given, so non-customizable-item call sites don't
  // need to change.
  removeItem: (item: MenuItem, modifiers?: SelectedModifier[]) => void;
  clearCart: () => void;
  setTableToken: (restaurantId: string, tableToken: string) => void;

  totalItems: () => number;
  subtotal: () => number;
  taxAmount: () => number;
  totalAmount: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      restaurantId: null,
      tableToken: null,

      addItem: (item, modifiers, restaurantId, tableToken) =>
        set((state) => {
          const key = cartEntryKey(item.id, modifiers);
          const exists = state.items.find((e) => keyOf(e) === key);
          return {
            restaurantId: restaurantId ?? state.restaurantId,
            tableToken: tableToken ?? state.tableToken,
            items: exists
              ? state.items.map((e) => (keyOf(e) === key ? { ...e, quantity: e.quantity + 1 } : e))
              : [...state.items, { item, modifiers, quantity: 1 }],
          };
        }),

      removeItem: (item, modifiers) =>
        set((state) => {
          // No modifiers passed (e.g. a plain-item call site) — fall back
          // to the first matching line for this item.id, same as the
          // original single-entry-per-item behaviour.
          const key = modifiers !== undefined ? cartEntryKey(item.id, modifiers) : null;
          let matched = false;
          return {
            items: state.items
              .map((e) => {
                const isMatch = key !== null ? keyOf(e) === key : !matched && e.item.id === item.id;
                if (isMatch) matched = true;
                return isMatch ? { ...e, quantity: e.quantity - 1 } : e;
              })
              .filter((e) => e.quantity > 0),
          };
        }),

      clearCart: () => set({ items: [], restaurantId: null, tableToken: null }),

      // Called once on the menu page when it loads, so the QR code's table
      // identity is captured even before the first item is added to cart.
      setTableToken: (restaurantId, tableToken) =>
        set({ restaurantId, tableToken }),

      totalItems: () => get().items.reduce((sum, e) => sum + e.quantity, 0),
      subtotal: () =>
        get().items.reduce((sum, e) => sum + entryUnitPrice(e) * e.quantity, 0),
      taxAmount: () => Math.round(get().subtotal() * TAX_RATE),
      totalAmount: () => get().subtotal() + get().taxAmount(),
    }),
    { name: "smartqr-cart", skipHydration: true }
  )
);

export { cartEntryKey, entryUnitPrice };