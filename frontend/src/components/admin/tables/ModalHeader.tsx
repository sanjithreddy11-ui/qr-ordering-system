"use client";

import React from "react";
import { X } from "lucide-react";
import { adminColors } from "@/components/admin/ui";

export default function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
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
  );
}
