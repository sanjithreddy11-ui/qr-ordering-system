import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface AdminStaff {
  id: string;
  name: string;
  email: string;
  role: "admin" | "kitchen" | "waiter";
  restaurantId: string;
}

interface AuthStore {
  token: string | null;
  staff: AdminStaff | null;
  setSession: (token: string, staff: AdminStaff) => void;
  logout: () => void;
}

// Replaces the old `localStorage.setItem("isAuthenticated", "true")` check.
// The token is a real JWT issued by POST /api/auth/login and verified by
// the backend's requireAuth middleware on every /api/admin/* route.
export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      staff: null,
      setSession: (token, staff) => set({ token, staff }),
      logout: () => set({ token: null, staff: null }),
    }),
    { name: "smartqr-admin-auth", skipHydration: true }
  )
);
