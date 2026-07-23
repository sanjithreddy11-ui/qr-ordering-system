import type { TableStatus } from "@/lib/admin-api";

// Flat, professional palette for the Table Management module's status
// badges, per spec: Available green, Reserved yellow, Occupied red,
// Billing purple, Cleaning orange, Out of Service gray. Kept local to this
// module (not merged into the shared adminColors) so it can't affect any
// other admin page's styling.
export const STATUS_META: Record<TableStatus, { label: string; color: string }> = {
  available: { label: "Available", color: "#2E7D4F" },
  reserved: { label: "Reserved", color: "#CA8A04" },
  occupied: { label: "Occupied", color: "#DC2626" },
  billing: { label: "Billing", color: "#7C3AED" },
  cleaning: { label: "Cleaning", color: "#EA580C" },
  out_of_service: { label: "Out of Service", color: "#6B7280" },
};

// Flat (no-gradient) button colors for the Table Management module, using
// the same dark-green brand primary as the rest of the dashboard. Scoped
// here rather than changing the shared PrimaryButton/SecondaryButton
// (which have a decorative gradient used dashboard-wide, including Menu
// Management) so other modules keep their exact current appearance.
export const TABLE_BUTTON_COLORS = {
  primary: "#3A4C3B",
  primaryText: "#FFFFFF",
  secondaryBorder: "#EAEAE5",
  secondaryText: "#1C1C1C",
  danger: "#DC2626",
};

// Defensive lookup: falls back to the "available" appearance instead of
// throwing if a table ever arrives with a missing/unrecognized status
// (e.g. stale cached data, a status value added on the backend before the
// frontend knows about it).
export function statusMeta(status: TableStatus | undefined | null) {
  return (status && STATUS_META[status]) || STATUS_META.available;
}

export const STATUS_FILTERS: TableStatus[] = [
  "available",
  "reserved",
  "occupied",
  "billing",
  "cleaning",
  "out_of_service",
];

export function formatDuration(startIso: string | null | undefined, endIso?: string | null): string {
  if (!startIso) return "—";
  const start = new Date(startIso).getTime();
  const end = endIso ? new Date(endIso).getTime() : Date.now();
  const minutes = Math.max(0, Math.round((end - start) / 60000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

export function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}
