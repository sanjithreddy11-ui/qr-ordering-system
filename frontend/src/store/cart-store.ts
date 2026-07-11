import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { MenuItem } from "@/lib/menu-data";
const TAX_RATE = 0.05;

export interface CartEntry {
  item: MenuItem;
  quantity: number;
}

interface CartStore {
  items: CartEntry[];
  restaurantId: string | null;
  tableToken: string | null;    // opaque token from QR URL segment

  addItem: (item: MenuItem, restaurantId?: string, tableToken?: string) => void;
  removeItem: (item: MenuItem) => void;
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

      addItem: (item, restaurantId, tableToken) =>
        set((state) => {
          const exists = state.items.find((e) => e.item.id === item.id);
          return {
            restaurantId: restaurantId ?? state.restaurantId,
            tableToken: tableToken ?? state.tableToken,
            items: exists
              ? state.items.map((e) =>
                  e.item.id === item.id ? { ...e, quantity: e.quantity + 1 } : e
                )
              : [...state.items, { item, quantity: 1 }],
          };
        }),

      removeItem: (item) =>
        set((state) => ({
          items: state.items
            .map((e) =>
              e.item.id === item.id ? { ...e, quantity: e.quantity - 1 } : e
            )
            .filter((e) => e.quantity > 0),
        })),

      clearCart: () => set({ items: [], restaurantId: null, tableToken: null }),

      // Called once on the menu page when it loads, so the QR code's table
      // identity is captured even before the first item is added to cart.
      setTableToken: (restaurantId, tableToken) =>
        set({ restaurantId, tableToken }),

      totalItems: () => get().items.reduce((sum, e) => sum + e.quantity, 0),
      subtotal: () =>
        get().items.reduce((sum, e) => sum + e.item.price * e.quantity, 0),
      taxAmount: () => Math.round(get().subtotal() * TAX_RATE),
      totalAmount: () => get().subtotal() + get().taxAmount(),
    }),
    { name: "smartqr-cart", skipHydration: true }
  )
);