// Minimal localStorage so zustand's `persist` middleware behaves like it does
// in the customer's browser (the cart is persisted under "smartqr-cart" and
// survives page navigations/reloads — that persistence is exactly what the
// KOT bug depends on).
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => void store.set(k, String(v)),
  removeItem: (k) => void store.delete(k),
  clear: () => store.clear(),
  key: (i) => Array.from(store.keys())[i] ?? null,
  get length() { return store.size; },
};
export const resetBrowserStorage = () => store.clear();
// zustand's default persist storage reads `window.localStorage`.
if (typeof globalThis.window === "undefined") globalThis.window = globalThis;
