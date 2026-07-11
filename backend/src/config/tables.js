// Centralized source of truth for demo table tokens. Edit this file to
// add/remove/relabel tables — nothing else in the backend should hardcode
// table tokens. Re-run `npm run seed` after changing this.

const DEMO_RESTAURANT_ID = "lifafa";

// Fixed, unguessable per-table tokens (not sequential IDs like "tbl_1").
// These stay constant for the demo so printed QR codes keep working.
const DEMO_TABLES = [
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
].map((t) => ({ ...t, restaurantId: DEMO_RESTAURANT_ID }));

module.exports = { DEMO_RESTAURANT_ID, DEMO_TABLES };
