import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Order, OrderStatus } from "@/types/order";

interface OrderStore {
  currentOrder: Order | null;
  setOrder: (order: Order) => void;
  updateStatus: (status: OrderStatus) => void;
  clearOrder: () => void;
}

export const useOrderStore = create<OrderStore>()(
  persist(
    (set) => ({
      currentOrder: null,
      setOrder: (order) => set({ currentOrder: order }),
      updateStatus: (status) =>
        set((state) =>
          state.currentOrder
            ? { currentOrder: { ...state.currentOrder, status } }
            : state
        ),
      clearOrder: () => set({ currentOrder: null }),
    }),
    { name: "smartqr-order" }
  )
);
