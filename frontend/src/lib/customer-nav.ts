import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { useSessionStore } from "@/store/session-store";

/**
 * Pure function: builds a customer-facing URL for the given path and table
 * token. The app is single-tenant (Maxibrew only), so URLs no longer carry
 * a restaurant slug segment — only the `?table=` token, which identifies
 * which physical table the QR code belongs to.
 *
 *   buildCustomerPath("/menu", "8d3af2e91c")
 *   -> "/menu?table=8d3af2e91c"
 */
export function buildCustomerPath(
  path: string,
  tableToken?: string | null
): string {
  const normalizedPath = path === "/" || path === "" ? "/" : path.startsWith("/") ? path : `/${path}`;
  return tableToken ? `${normalizedPath}?table=${encodeURIComponent(tableToken)}` : normalizedPath;
}

/**
 * React hook version — pulls tableToken from the session store
 * automatically, so callers never have to pass it manually.
 *
 * Usage:
 *   const buildCustomerUrl = useBuildCustomerUrl();
 *   router.push(buildCustomerUrl("/cart"));
 */
export function useBuildCustomerUrl() {
  const tableToken = useSessionStore((s) => s.tableToken);

  return useCallback(
    (path: string) => buildCustomerPath(path, tableToken),
    [tableToken]
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
