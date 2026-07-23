"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AdminSidebar from "@/components/admin/AdminSidebar";
import { useAuthStore } from "@/store/auth-store";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { token } = useAuthStore();
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    useAuthStore.persist.rehydrate();
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/login");
    }
  }, [hydrated, token, router]);

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
    <div style={{ display: "flex", minHeight: "100vh", background: "#F7F6F2" }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: "32px 40px", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}
