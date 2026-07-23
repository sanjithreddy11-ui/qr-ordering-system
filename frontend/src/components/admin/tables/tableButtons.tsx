"use client";

import React from "react";
import { TABLE_BUTTON_COLORS } from "./tableStatus";

// Same prop shape as the shared PrimaryButton in components/admin/ui.tsx,
// but flat (no gradient) per the Table Management module's "professional
// POS" styling requirement. The shared PrimaryButton is used dashboard-wide
// (including Menu Management), so rather than changing its default look
// everywhere, this is a drop-in variant scoped to Table Management only.
export function TablePrimaryButton({
  children,
  onClick,
  disabled,
  type = "button",
}: {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "10px 18px",
        borderRadius: 10,
        border: "none",
        background: disabled ? "#A8B0A9" : TABLE_BUTTON_COLORS.primary,
        color: TABLE_BUTTON_COLORS.primaryText,
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 13,
        fontWeight: 700,
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}
