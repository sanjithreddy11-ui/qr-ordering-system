"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/session-store";
import BottomNav from "@/components/customer/BottomNav";
// Bottom nav is intentionally NOT shown on the linear checkout flow
// (cart/checkout/order-success) — only on the four tab destinations.
const NAV_HIDDEN_SUFFIXES = ["/cart", "/checkout", "/order-success"];

export default function CustomerTabsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const restaurantSlug = params.restaurantId;

  const ensureSession = useSessionStore((s) => s.ensureSession);
  const tableToken = useSessionStore((s) => s.tableToken);
  const [sessionReady, setSessionReady] = useState(false);

  // Reads the `?table=` URL param exactly ONCE per restaurant slug — this
  // is intentionally not in a dependency on searchParams, so navigating
  // between tabs never re-triggers a URL read.
  const hasBootstrapped = useRef<string | null>(null);
  useEffect(() => {
    if (hasBootstrapped.current === restaurantSlug) return;
    hasBootstrapped.current = restaurantSlug;

    const tableFromUrl = searchParams.get("table");
    ensureSession(restaurantSlug, tableFromUrl)
      .catch(() => {
        // Backend not reachable — let the UI render anyway during local dev.
      })
      .finally(() => setSessionReady(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantSlug]);

  // Self-healing: if the URL's table param ever drifts from the session
  // store (stale link, browser back/forward, manual edit), silently
  // correct the address bar to match the store — the store is the source
  // of truth, never the URL.
  useEffect(() => {
    if (!sessionReady || !tableToken) return;
    const currentUrlToken = searchParams.get("table");
    if (currentUrlToken === tableToken) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("table", tableToken);
    router.replace(`${pathname}?${params.toString()}`);
    // Deliberately excludes searchParams from deps to avoid a replace loop —
    // this only needs to re-check when the path or the store's token changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tableToken, sessionReady]);

  const showBottomNav =
    sessionReady && !NAV_HIDDEN_SUFFIXES.some((suffix) => pathname?.endsWith(suffix));

  return (
    <div className="relative min-h-dvh bg-bg-primary pb-20">
      {children}
      {showBottomNav && <BottomNav />}
    </div>
  );
}
