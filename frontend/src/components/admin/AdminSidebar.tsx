"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  Receipt,
  BarChart3,
  Users,
  Star,
  Tag,
  Settings,
  UserCog,
  LogOut,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed },
  { label: "Tables & QR", href: "/dashboard/tables", icon: QrCode },
  { label: "Orders", href: "/dashboard/orders", icon: Receipt },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Reviews", href: "/dashboard/reviews", icon: Star },
  { label: "Offers", href: "/dashboard/offers", icon: Tag },
  { label: "Staff", href: "/dashboard/staff", icon: UserCog },
];
export default function AdminSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { staff, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

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

      <div
        style={{
          marginTop: 24,
          paddingTop: 16,
          borderTop: "1px solid #EAEAE5",
        }}
      >
        {staff && (
          <div
            style={{
              padding: "0 8px 10px",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 12,
              color: "#4A4A45",
            }}
          >
            <div style={{ fontWeight: 700 }}>{staff.name}</div>
            <div style={{ color: "#999", textTransform: "capitalize" }}>{staff.role}</div>
          </div>
        )}
        <button
          onClick={handleLogout}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            width: "100%",
            padding: "10px 12px",
            borderRadius: 10,
            border: "none",
            background: "transparent",
            cursor: "pointer",
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 14,
            fontWeight: 600,
            color: "#C24C2E",
          }}
        >
          <LogOut size={17} strokeWidth={2} />
          Log out
        </button>
      </div>
    </aside>
  );
}
