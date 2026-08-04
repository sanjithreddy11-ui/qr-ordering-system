"use client";

import React, { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSessionStore } from "@/store/session-store";
import { useCartStore } from "@/store/cart-store";
import { useOrderStore } from "@/store/order-store";
import BottomNav from "@/components/customer/BottomNav";
import CategoryMenuBackButton from "@/components/customer/CategoryMenuBackButton";

const NAV_HIDDEN_SEGMENTS = ["cart", "checkout", "order-success", "menu"];

function getLastPathSegment(pathname: string | null): string {
  if (!pathname) return "";
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

// useSearchParams() requires a Suspense boundary above it, or Next.js
// fails the production build with "missing-suspense-with-csr-bailout" for
// every route under this layout (cart, active-orders, etc. — not just the
// pages that call the hook directly, since they all inherit this layout).
function CustomerLayoutInner({ children }: { children: React.ReactNode }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const ensureSession = useSessionStore((s) => s.ensureSession);
  const tableToken = useSessionStore((s) => s.tableToken);
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    useCartStore.persist.rehydrate();
    useOrderStore.persist.rehydrate();
  }, []);

  const hasBootstrapped = useRef(false);
  useEffect(() => {
    if (hasBootstrapped.current) return;
    hasBootstrapped.current = true;

    (async () => {
      await useSessionStore.persist.rehydrate();
      const tableFromUrl = searchParams.get("table");
      try {
        await ensureSession(tableFromUrl);
      } catch {
        // Backend not reachable — let the UI render anyway during local dev.
      } finally {
        setSessionReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!sessionReady || !tableToken) return;
    const currentUrlToken = searchParams.get("table");
    if (currentUrlToken === tableToken) return;

    const params = new URLSearchParams(searchParams.toString());
    params.set("table", tableToken);
    router.replace(`${pathname}?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, tableToken, sessionReady]);

  const lastSegment = getLastPathSegment(pathname);
  const showBottomNav = sessionReady && !NAV_HIDDEN_SEGMENTS.includes(lastSegment);

  return (
    <div className="mx-auto max-w-[480px] relative">
      <div className="washi-bg" />
      <div className="relative z-10 min-h-dvh bg-bg-primary pb-20">
        <CategoryMenuBackButton />
        {children}
        {showBottomNav && <BottomNav />}
      </div>
    </div>
  );
}

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={null}>
      <CustomerLayoutInner>{children}</CustomerLayoutInner>
    </Suspense>
  );
}