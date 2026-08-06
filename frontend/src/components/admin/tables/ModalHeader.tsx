"use client";

import React from "react";
import { X } from "lucide-react";
import { adminColors } from "@/components/admin/ui";

export default function ModalHeader({
  title,
  onClose,
  actions,
}: {
  title: string;
  onClose: () => void;
  // Optional extra controls rendered between the title and the close (X)
  // button — e.g. the Table Details Drawer's "Print KOT" button. Opt-in and
  // defaults to nothing, so every existing caller (ReservationForm, etc.)
  // renders exactly as before.
  actions?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        rowGap: 8,
        marginBottom: 18,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 17,
          fontWeight: 700,
          color: adminColors.text,
        }}
      >
        {title}
      </span>
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        {actions}
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 28,
            height: 28,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: adminColors.textSecondary,
            cursor: "pointer",
          }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}