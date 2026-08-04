"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Home, UtensilsCrossed, Clock, ReceiptText } from "lucide-react";
import { useBuildCustomerUrl } from "@/lib/customer-nav";
import { useUIStore } from "@/store/ui-store";

const TABS = [
  { key: "home", label: "Home", icon: Home, path: "/" },
  { key: "menu", label: "Menu", icon: UtensilsCrossed, path: "/menu" },
  { key: "active", label: "Active Orders", icon: Clock, path: "/active-orders" },
  { key: "past", label: "Past Orders", icon: ReceiptText, path: "/past-orders" },
];

export default function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const buildCustomerUrl = useBuildCustomerUrl();
  const isCategoryMenuOpen = useUIStore((s) => s.isCategoryMenuOpen);

  return (
    <AnimatePresence>
      {!isCategoryMenuOpen && (
        <motion.nav
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 380, damping: 32 }}
          className="fixed bottom-0 left-0 right-0 z-[1000] mx-auto max-w-[480px]"
          style={{
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(16px)",
            WebkitBackdropFilter: "blur(16px)",
            borderTop: "1px solid rgba(0,0,0,0.06)",
            boxShadow: "0 -8px 24px rgba(0,0,0,0.05)",
          }}
        >
          <div className="flex items-stretch justify-around px-1 pb-[env(safe-area-inset-bottom)]">
            {TABS.map((tab) => {
              // Compare against the *unqualified* path segment so this
              // works regardless of query string.
              const segment = tab.path === "/" ? "" : tab.path;
              const isActive =
                segment === ""
                  ? pathname === "/" // home is the exact root route now
                  : pathname?.includes(segment);
              const Icon = tab.icon;

              return (
                <button
                  key={tab.key}
                  onClick={() => router.push(buildCustomerUrl(tab.path))}
                  className="flex flex-1 flex-col items-center gap-1 py-2.5"
                  style={{ WebkitTapHighlightColor: "transparent" }}
                >
                  <Icon
                    size={21}
                    strokeWidth={isActive ? 2.4 : 1.8}
                    color={isActive ? "#3A4C3B" : "#9A9A94"}
                  />
                  <span
                    className="font-body text-[10px] font-semibold"
                    style={{ color: isActive ? "#3A4C3B" : "#9A9A94" }}
                  >
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        </motion.nav>
      )}
    </AnimatePresence>
  );
}
