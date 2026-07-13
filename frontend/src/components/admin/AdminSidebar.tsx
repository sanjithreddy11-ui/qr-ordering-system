"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  Receipt,
  Settings,
  Users,
} from "lucide-react";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed },
  { label: "Tables & QR", href: "/dashboard/tables", icon: QrCode },
  { label: "Orders & Sales", href: "/dashboard/orders", icon: Receipt },
  { label: "Staff", href: "/dashboard/staff", icon: Users },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];
export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside
      style={{
        width: 240,
        flexShrink: 0,
        background: "#FFFFFF",
        borderRight: "1px solid #EAEAE5",
        minHeight: "100vh",
        padding: "24px 16px",
        position: "sticky",
        top: 0,
      }}
    >
      <div style={{ padding: "0 8px", marginBottom: 32 }}>
        <div
          style={{
            fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
            fontSize: 22,
            fontWeight: 700,
            color: "#1C1C1C",
          }}
        >
          Lifafa
        </div>
        <div
          style={{
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 11,
            fontWeight: 600,
            color: "#999",
            letterSpacing: "0.06em",
            textTransform: "uppercase",
          }}
        >
          Admin Dashboard
        </div>
      </div>

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const isActive =
  item.href === "/dashboard"
    ? pathname === item.href
    : pathname?.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 10,
                textDecoration: "none",
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 14,
                fontWeight: 600,
                color: isActive ? "#FFFFFF" : "#4A4A45",
                background: isActive
                  ? "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)"
                  : "transparent",
                transition: "background 0.15s ease",
              }}
            >
              <Icon size={17} strokeWidth={2} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
