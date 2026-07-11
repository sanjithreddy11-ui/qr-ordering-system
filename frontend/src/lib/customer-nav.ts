import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session-store";

/**
 * Pure function: builds a customer-facing URL for the given restaurant slug
 * and table token. Used directly wherever we don't have a React hook
 * available (e.g. inside plain functions), and internally by
 * `useBuildCustomerUrl`.
 *
 *   buildCustomerPath("lifafa", "/menu", "8d3af2e91c")
 *   -> "/lifafa/menu?table=8d3af2e91c"
 */
export function buildCustomerPath(
  restaurantSlug: string,
  path: string,
  tableToken?: string | null
): string {
  const normalizedPath = path === "/" || path === "" ? "" : path.startsWith("/") ? path : `/${path}`;
  const base = `/${restaurantSlug}${normalizedPath}`;
  return tableToken ? `${base}?table=${encodeURIComponent(tableToken)}` : base;
}

/**
 * React hook version — pulls restaurantSlug/tableToken from the session
 * store automatically, so callers never have to pass them manually.
 *
 * Usage:
 *   const buildCustomerUrl = useBuildCustomerUrl();
 *   router.push(buildCustomerUrl("/cart"));
 */
export function useBuildCustomerUrl() {
  const restaurantSlug = useSessionStore((s) => s.restaurantSlug);
  const tableToken = useSessionStore((s) => s.tableToken);

  return useCallback(
    (path: string) => buildCustomerPath(restaurantSlug ?? "", path, tableToken),
    [restaurantSlug, tableToken]
  );
}

/**
 * Convenience hook combining useRouter() + useBuildCustomerUrl() for the
 * common case of "just navigate me there, preserving the session".
 *
 * Usage:
 *   const goTo = useCustomerNavigate();
 *   goTo("/menu");
 */
export function useCustomerNavigate() {
  const router = useRouter();
  const buildCustomerUrl = useBuildCustomerUrl();

  return useCallback(
    (path: string) => router.push(buildCustomerUrl(path)),
    [router, buildCustomerUrl]
  );
}
