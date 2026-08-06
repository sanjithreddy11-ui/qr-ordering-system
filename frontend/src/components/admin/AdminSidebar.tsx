"use client";

import React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  UtensilsCrossed,
  Package,
  PiggyBank,
  QrCode,
  Receipt,
  BarChart3,
  Users,
  Star,
  UserCog,
  LogOut,
  X,
  CreditCard,
  Wallet,
  Settings,
  Tag,
  Percent,
} from "lucide-react";
import { useAuthStore } from "@/store/auth-store";

const NAV_ITEMS = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Menu", href: "/dashboard/menu", icon: UtensilsCrossed },
  { label: "Tables & QR", href: "/dashboard/tables", icon: QrCode },
  { label: "Orders", href: "/dashboard/orders", icon: Receipt },
  { label: "GST Management", href: "/dashboard/gst", icon: Percent },
  { label: "Settlements", href: "/dashboard/settlements", icon: Wallet },
  { label: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { label: "Customers", href: "/dashboard/customers", icon: Users },
  { label: "Offers & Discounts", href: "/dashboard/offers", icon: Tag },
  { label: "Staff", href: "/dashboard/staff", icon: UserCog },
  { label: "Settings", href: "/dashboard/settings", icon: Settings },
];

interface AdminSidebarProps {
  // Only meaningful below the md breakpoint — desktop always renders the
  // sidebar inline regardless of these props (see the md: classes below).
  open?: boolean;
  onClose?: () => void;
}

export default function AdminSidebar({ open = false, onClose }: AdminSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { staff, logout } = useAuthStore();

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <>
      {/* Backdrop — mobile only, only shows while the drawer is open */}
      {open && (
        <div
          onClick={onClose}
          className="md:hidden"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.4)",
            zIndex: 40,
          }}
        />
      )}

      {/* Desktop (md+): normal sticky in-flow sidebar, exactly as before.
          Mobile (<md): fixed-position slide-in drawer, off-canvas by
          default and toggled via translate-x based on `open`. Position is
          controlled entirely through these Tailwind classes (never via
          inline style) so the responsive variants actually apply — an
          inline `position`/`transform` would win over className at every
          breakpoint and break the mobile behavior. */}
      <aside
        className={`fixed md:sticky top-0 md:top-0 left-0 z-50 md:z-auto transition-transform duration-200 ease-out md:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{
          width: 240,
          flexShrink: 0,
          background: "#FFFFFF",
          borderRight: "1px solid #EAEAE5",
          minHeight: "100vh",
          maxHeight: "100vh",
          overflowY: "auto",
          padding: "24px 16px",
        }}
      >
        {/* Close button — mobile drawer only */}
        <button
          onClick={onClose}
          aria-label="Close menu"
          className="md:hidden"
          style={{
            position: "absolute",
            top: 16,
            right: 16,
            width: 32,
            height: 32,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: "1px solid #EAEAE5",
            background: "#FFFFFF",
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>

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
                onClick={onClose}
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
    </>
  );
}