// Mirrors backend/src/config/tables.js — keep both in sync.
// This is the single source of truth for demo table tokens on the
// frontend (used e.g. to generate/print demo QR links for testing).

export const DEMO_RESTAURANT_SLUG = "lifafa";

export interface DemoTable {
  token: string;
  label: string;
}

export const DEMO_TABLES: DemoTable[] = [
  { token: "8d3af2e91c", label: "Table 1" },
  { token: "a7f93cb102", label: "Table 2" },
  { token: "2b71d9aa5f", label: "Table 3" },
  { token: "9bc72df110", label: "Table 4" },
  { token: "61df7ac991", label: "Table 5" },
  { token: "fe3b61aa09", label: "Table 6" },
  { token: "4dc8f21bd0", label: "Table 7" },
  { token: "d11f923c7e", label: "Table 8" },
  { token: "8ac92ef631", label: "Table 9" },
  { token: "f93ab281ce", label: "Table 10" },
];

// Used only as a last-resort fallback (e.g. testing checkout without ever
// visiting the landing page). Real visits always get a real token from the
// QR URL, captured once by the [restaurantId] layout.
export const DEFAULT_DEMO_TABLE_TOKEN = DEMO_TABLES[0].token;
