"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/session-store";
import { useCartStore } from "@/store/cart-store";
import { useOrderStore } from "@/store/order-store";
import BottomNav from "@/components/customer/BottomNav";
import CategoryMenuBackButton from "@/components/customer/CategoryMenuBackButton";

// Bottom nav is hidden on the linear checkout flow (cart/checkout/
// order-success) and on Home (handled separately via isHomePage below).
// It stays visible on Menu, Active Orders, and Past Orders.
const NAV_HIDDEN_SEGMENTS = ["cart", "checkout", "order-success"];

function getLastPathSegment(pathname: string | null): string {
  if (!pathname) return "";
  const segments = pathname.split("/").filter(Boolean); // drops "", trailing slash safe
  return segments[segments.length - 1] ?? "";
}

export default function CustomerTabsLayout({ children }: { children: React.ReactNode }) {
  const params = useParams<{ restaurantId: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const restaurantSlug = params.restaurantId;

  const ensureSession = useSessionStore((s) => s.ensureSession);
  const tableToken = useSessionStore((s) => s.tableToken);
  const [sessionReady, setSessionReady] = useState(false);

  // cart-store and order-store use skipHydration too (same SSR mismatch
  // fix as session-store below) — they don't gate any logic here, so a
  // simple once-on-mount rehydrate is enough.
  useEffect(() => {
    useCartStore.persist.rehydrate();
    useOrderStore.persist.rehydrate();
  }, []);

  // Reads the `?table=` URL param exactly ONCE per restaurant slug — this
  // is intentionally not in a dependency on searchParams, so navigating
  // between tabs never re-triggers a URL read.
  const hasBootstrapped = useRef<string | null>(null);
  useEffect(() => {
    if (hasBootstrapped.current === restaurantSlug) return;
    hasBootstrapped.current = restaurantSlug;

    (async () => {
      // session-store uses skipHydration: true (fixes an SSR/client
      // hydration mismatch), which means its in-memory state starts
      // empty on the client until explicitly rehydrated. ensureSession()
      // below reads that state to decide whether to reuse an existing
      // session — so this MUST complete first, or every page load would
      // wrongly look like a brand new visit and create a redundant session.
      await useSessionStore.persist.rehydrate();

      const tableFromUrl = searchParams.get("table");
      try {
        await ensureSession(restaurantSlug, tableFromUrl);
      } catch {
        // Backend not reachable — let the UI render anyway during local dev.
      } finally {
        setSessionReady(true);
      }
    })();
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

  const lastSegment = getLastPathSegment(pathname);
  const pathSegments = pathname ? pathname.split("/").filter(Boolean) : [];
  // Home page is exactly "/[restaurantId]" — one segment, no sub-route.
  const isHomePage = pathSegments.length === 1;
  const showBottomNav =
    sessionReady && !isHomePage && !NAV_HIDDEN_SEGMENTS.includes(lastSegment);
  return (
    <div className="relative min-h-dvh bg-bg-primary pb-20">
      <CategoryMenuBackButton />
      {children}
      {showBottomNav && <BottomNav />}
    </div>
  );
}