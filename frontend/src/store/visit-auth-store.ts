import { create } from "zustand";
import { persist } from "zustand/middleware";

// Visit-Based Customer Authentication (frontend half — see backend
// models/VisitSession.js for the full design).
//
// `deviceId` is a secure random identifier for this browser, generated
// ONCE and persisted indefinitely in localStorage — deliberately separate
// from the QR *browsing* session in store/session-store.ts, which expires
// after a few hours and regenerates whenever a different table's QR is
// scanned. This one never expires and never changes on its own; only the
// backend closing its VisitSession (Submit Bill, etc.) ever "forgets" it,
// which is exactly the "not a permanent login" behavior required — the
// device id itself is stable, but it stops being useful the moment its
// visit is closed.
//
// `visitToken`/`phone`/`name` are only ever a CACHE of what an ACTIVE
// VisitSession said the last time the backend confirmed one — they are
// never trusted as authorization by themselves. Every order placement
// re-validates the token server-side (see backend middleware/
// verifyPhoneToken.js), and the checkout page re-confirms an active visit
// with GET /api/visit/status before ever skipping the OTP screen (see
// lib/api.ts:getVisitStatus). Closing the visit anywhere else in the app
// (Submit Bill, force-close, etc.) simply makes that re-check fail, at
// which point the frontend clears this and falls back to asking for OTP —
// it does not need to actively "know" the visit closed.
function generateDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `dev_${crypto.randomUUID()}`;
  }
  // Fallback for older browsers without crypto.randomUUID.
  return `dev_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

interface VisitAuthState {
  deviceId: string | null;
  visitToken: string | null;
  phone: string | null;
  name: string | null;

  ensureDeviceId: () => string;
  setVisit: (visit: { visitToken: string; phone: string; name?: string }) => void;
  clearVisit: () => void;
}

export const useVisitAuthStore = create<VisitAuthState>()(
  persist(
    (set, get) => ({
      deviceId: null,
      visitToken: null,
      phone: null,
      name: null,

      ensureDeviceId: () => {
        const existing = get().deviceId;
        if (existing) return existing;
        const fresh = generateDeviceId();
        set({ deviceId: fresh });
        return fresh;
      },

      setVisit: ({ visitToken, phone, name }) =>
        set({ visitToken, phone, name: name || null }),

      // Called once the frontend learns (via GET /api/visit/status, or a
      // failed order/history call) that the visit is no longer active —
      // NEVER call this to end a visit; only the backend actually ends
      // one. This just stops the frontend from presenting stale state.
      clearVisit: () => set({ visitToken: null, phone: null, name: null }),
    }),
    { name: "maxibrew-visit-auth", skipHydration: true }
  )
);
