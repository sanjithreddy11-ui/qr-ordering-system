import React from "react";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", minHeight: "100vh", background: "#F7F6F2" }}>
      <AdminSidebar />
      <main style={{ flex: 1, padding: "32px 40px", minWidth: 0 }}>
        {children}
      </main>
    </div>
  );
}