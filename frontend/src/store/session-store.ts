import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionInfo } from "@/types/session";
import { createSession as apiCreateSession, getSessionStatus } from "@/lib/api";

interface SessionStore extends Partial<SessionInfo> {
  /**
   * Ensures a valid session exists for this restaurant. This is the ONLY
   * place in the app that should read the `?table=` URL param — it's
   * called once by the `[restaurantId]` layout when a customer first
   * lands on the site. Every other page reads restaurantSlug/tableToken
   * from this store, never from useSearchParams() directly.
   *
   * Behavior:
   * - If we already have a valid (non-expired) session for this exact
   *   restaurant, reuse it — the URL's table param is ignored, because
   *   we've already "read it once" earlier in this visit.
   * - Otherwise (first visit, expired session, or a different
   *   restaurant), the URL's table token becomes the new session's table.
   */
  ensureSession: (restaurantSlug: string, tableTokenFromUrl?: string | null) => Promise<SessionInfo>;
  clearSession: () => void;
}

function isLocallyValid(state: Partial<SessionInfo>, restaurantSlug: string) {
  if (!state.sessionId || !state.expiresAt || !state.tableToken) return false;
  if (state.restaurantSlug !== restaurantSlug) return false;
  return new Date(state.expiresAt).getTime() > Date.now();
}

export const useSessionStore = create<SessionStore>()(
  persist(
    (set, get) => ({
      sessionId: undefined,
      restaurantId: undefined,
      restaurantSlug: undefined,
      tableToken: undefined,
      expiresAt: undefined,

      ensureSession: async (restaurantSlug, tableTokenFromUrl) => {
        const state = get();

        if (isLocallyValid(state, restaurantSlug)) {
          // Double-check with the backend in case it was invalidated
          // server-side — but don't block the UI on this round trip.
          getSessionStatus(state.sessionId!).then((status) => {
            if (!status.valid) {
              set({
                sessionId: undefined,
                restaurantId: undefined,
                restaurantSlug: undefined,
                tableToken: undefined,
                expiresAt: undefined,
              });
            }
          });
          return state as SessionInfo;
        }

        // Fallback: URL param is only trusted when the store didn't
        // already have a valid session for this restaurant.
        const tableToken = tableTokenFromUrl || state.tableToken || "";

        const created = await apiCreateSession({ restaurantId: restaurantSlug, tableToken });

        const fresh: SessionInfo = {
          sessionId: created.sessionId,
          restaurantId: created.restaurantId,
          restaurantSlug, // same value as restaurantId today; kept separate for future use
          tableToken: created.tableToken,
          expiresAt: created.expiresAt,
        };

        set(fresh);
        return fresh;
      },

      clearSession: () =>
        set({
          sessionId: undefined,
          restaurantId: undefined,
          restaurantSlug: undefined,
          tableToken: undefined,
          expiresAt: undefined,
        }),
    }),
    { name: "smartqr-session" }
  )
);
