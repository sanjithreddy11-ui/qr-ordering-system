import type { TableStatus } from "@/lib/admin-api";

export const STATUS_META: Record<TableStatus, { label: string; color: string; dot: string }> = {
  available: { label: "Available", color: "#2E7D4F", dot: "🟢" },
  reserved: { label: "Reserved", color: "#C9971F", dot: "🟡" },
  occupied: { label: "Occupied", color: "#C24C2E", dot: "🔴" },
  billing: { label: "Billing", color: "#7C3AED", dot: "🟣" },
  cleaning: { label: "Cleaning", color: "#3F3F3F", dot: "⚫" },
  out_of_service: { label: "Out of Service", color: "#9CA3AF", dot: "⚪" },
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
