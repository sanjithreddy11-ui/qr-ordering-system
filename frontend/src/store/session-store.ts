import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { SessionInfo } from "@/types/session";
import { createSession as apiCreateSession, getSessionStatus } from "@/lib/api";
import { RESTAURANT_ID } from "@/constants/restaurant";

interface SessionStore extends Partial<SessionInfo> {
  /**
   * Ensures a valid session exists for this (single-tenant) restaurant.
   * This is the ONLY place in the app that should read the `?table=` URL
   * param — it's called once by the customer layout when a customer first
   * lands on the site. Every other page reads tableToken from this store,
   * never from useSearchParams() directly.
   *
   * Behavior:
   * - If we already have a valid (non-expired) session, reuse it — the
   *   URL's table param is ignored, because we've already "read it once"
   *   earlier in this visit.
   * - Otherwise (first visit or expired session), the URL's table token
   *   becomes the new session's table.
   */
  ensureSession: (tableTokenFromUrl?: string | null) => Promise<SessionInfo>;
  clearSession: () => void;
}

function isLocallyValid(
  state: Partial<SessionInfo>,
  tableTokenFromUrl?: string | null
) {
  if (!state.sessionId || !state.expiresAt || !state.tableToken) return false;

  // A different table token in the URL means a *different QR code* was
  // scanned (e.g. same device, different table). That must never reuse
  // a cached session from another table — even if that session hasn't
  // expired yet. Only fall back to the cached session when the URL has
  // no table param at all (e.g. an internal navigation/refresh where
  // the store itself is the only source of truth).
  if (tableTokenFromUrl && tableTokenFromUrl !== state.tableToken) return false;

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

      ensureSession: async (tableTokenFromUrl) => {
        const state = get();

        if (isLocallyValid(state, tableTokenFromUrl)) {
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
        // already have a valid session.
        const tableToken = tableTokenFromUrl || state.tableToken || "";

        const created = await apiCreateSession({ restaurantId: RESTAURANT_ID, tableToken });

        const fresh: SessionInfo = {
          sessionId: created.sessionId,
          restaurantId: created.restaurantId,
          restaurantSlug: RESTAURANT_ID, // kept for backward-compat with SessionInfo shape
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
    { name: "smartqr-session", skipHydration: true }
  )
);