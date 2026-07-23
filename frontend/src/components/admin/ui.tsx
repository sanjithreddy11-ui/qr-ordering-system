"use client";

import React from "react";

export const adminColors = {
  primary: "#3A4C3B",
  primaryDark: "#263429",
  text: "#1C1C1C",
  textSecondary: "#6B6B63",
  border: "#EAEAE5",
  bg: "#F7F6F2",
  danger: "#C24C2E",
  success: "#2E7D4F",
  warning: "#C9971F",
};

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        marginBottom: 28,
      }}
    >
      <div>
        <h1
          style={{
            fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
            fontSize: 30,
            fontWeight: 700,
            color: adminColors.text,
            margin: 0,
          }}
        >
          {title}
        </h1>
        {description && (
          <p
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              color: adminColors.textSecondary,
              margin: "4px 0 0",
            }}
          >
            {description}
          </p>
        )}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{
        background: "#FFFFFF",
        border: `1px solid ${adminColors.border}`,
        borderRadius: 16,
        padding: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function PrimaryButton({
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
        background: disabled
          ? "#A8B0A9"
          : `linear-gradient(135deg, ${adminColors.primary} 0%, ${adminColors.primaryDark} 100%)`,
        color: "#FFFFFF",
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

export function SecondaryButton({
  children,
  onClick,
  danger,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "8px 14px",
        borderRadius: 10,
        border: `1px solid ${danger ? adminColors.danger : adminColors.border}`,
        background: "#FFFFFF",
        color: danger ? adminColors.danger : adminColors.text,
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 13,
        fontWeight: 600,
        cursor: "pointer",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </button>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 12,
          fontWeight: 700,
          color: adminColors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 14,
          color: adminColors.text,
          outline: "none",
        }}
      />
    </label>
  );
}

export function TextArea({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 12,
          fontWeight: 700,
          color: adminColors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 14,
          color: adminColors.text,
          outline: "none",
          resize: "vertical",
        }}
      />
    </label>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 12,
          fontWeight: 700,
          color: adminColors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 14,
          color: adminColors.text,
          outline: "none",
          background: "#fff",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Badge({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 4,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 700,
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        background: `${color}1A`,
        color,
      }}
    >
      {children}
    </span>
  );
}

// Simple modal overlay - used by every "add/edit X" form across admin pages.
// New props are opt-in and default to the exact previous behavior, so every
// existing caller (Menu, Staff, etc.) renders identically to before.
export function Modal({
  title,
  titleNode,
  onClose,
  children,
  closeOnOverlayClick = true,
}: {
  title: string;
  // Escape hatch for callers that need a custom header (e.g. a clean-font
  // title + close button) instead of the default decorative title text.
  titleNode?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  closeOnOverlayClick?: boolean;
}) {
  // Escape-to-close: a safe, universal modal convention. Added for every
  // caller since it can only ever add capability, never change how an
  // existing modal currently behaves.
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div
      onClick={closeOnOverlayClick ? onClose : undefined}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(28,28,28,0.4)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: 20,
          padding: 24,
          width: "100%",
          maxWidth: 440,
          maxHeight: "85vh",
          overflowY: "auto",
          boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
        }}
      >
        {titleNode ?? (
          <div
            style={{
              fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
              fontSize: 20,
              fontWeight: 700,
              color: adminColors.text,
              marginBottom: 18,
            }}
          >
            {title}
          </div>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>{children}</div>
      </div>
    </div>
  );
}
