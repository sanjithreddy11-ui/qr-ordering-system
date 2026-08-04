"use client";

import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import AdminSidebar from "@/components/admin/AdminSidebar";
import PrinterProvider from "@/components/admin/printer/PrinterProvider";
import KotAutoPrintProvider from "@/components/admin/printer/KotAutoPrintProvider";
import { useAuthStore } from "@/store/auth-store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/login");
    }
  }, [hydrated, token, router]);

  // Close the mobile drawer automatically on route change (nav Link already
  // does this via its own onClick, but this also covers back/forward nav).
  const pathname = usePathname();
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (!hydrated || !token) {
    return (
      <div style={{ display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", background: "#F7F6F2" }}>
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: "#6B6B63" }}>
          Loading…
        </p>
      </div>
    );
  }

  return (
    <PrinterProvider>
    <KotAutoPrintProvider>
    <div style={{ display: "flex", minHeight: "100vh", background: "#F7F6F2" }}>
      <AdminSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {/* Mobile-only top bar with hamburger toggle — hidden from md up,
            where the sidebar is always visible inline instead. */}
        <div
          className="flex md:hidden"
          style={{
            alignItems: "center",
            gap: 12,
            padding: "14px 16px",
            background: "#FFFFFF",
            borderBottom: "1px solid #EAEAE5",
            position: "sticky",
            top: 0,
            zIndex: 30,
          }}
        >
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 36,
              height: 36,
              flexShrink: 0,
              borderRadius: 8,
              border: "1px solid #EAEAE5",
              background: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            <Menu size={18} />
          </button>
          <span
            style={{
              fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
              fontSize: 18,
              fontWeight: 700,
              color: "#1C1C1C",
            }}
          >
            Admin Dashboard
          </span>
        </div>

        <main
          className="px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8"
          style={{ flex: 1, minWidth: 0 }}
        >
          {children}
        </main>
      </div>
    </div>
    </KotAutoPrintProvider>
    </PrinterProvider>
  );
}
