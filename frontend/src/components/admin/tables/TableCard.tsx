"use client";

import React, { useEffect, useState } from "react";
import { Users, ClipboardList, Trash2 } from "lucide-react";
import { adminColors, Modal } from "@/components/admin/ui";
import { deleteAdminTable, type TableGridItem } from "@/lib/admin-api";
import { statusMeta, formatCurrency, formatDuration, TABLE_BUTTON_COLORS } from "./tableStatus";

export default function TableCard({
  table,
  onClick,
  onDeleted,
}: {
  table: TableGridItem;
  onClick: () => void;
  onDeleted: () => void;
}) {
  const meta = statusMeta(table.status);
  // Re-render every 30s so "Session Duration" keeps ticking without a refetch.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (table.status !== "occupied" && table.status !== "billing") return;
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [table.status]);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const handleDelete = async () => {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAdminTable(table._id);
      setConfirmingDelete(false);
      onDeleted();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete table");
    } finally {
      setDeleting(false);
    }
  };

  const session = table.activeSession;
  const reservation = table.activeReservation;

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onClick()}
        style={{
          position: "relative",
          textAlign: "left",
          background: "#FFFFFF",
          border: `1px solid ${adminColors.border}`,
          borderTop: `3px solid ${meta.color}`,
          borderRadius: 14,
          padding: 14,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          aspectRatio: "1 / 1",
          overflow: "hidden",
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          opacity: table.isActive === false ? 0.5 : 1,
          transition: "transform 120ms ease, box-shadow 120ms ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = "translateY(-2px)";
          e.currentTarget.style.boxShadow = "0 6px 16px rgba(0,0,0,0.08)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.03)";
        }}
      >
        <button
          type="button"
          aria-label={`Delete ${table.label}`}
          onClick={(e) => {
            e.stopPropagation();
            setDeleteError(null);
            setConfirmingDelete(true);
          }}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 24,
            height: 24,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: adminColors.textSecondary,
            cursor: "pointer",
          }}
        >
          <Trash2 size={13} />
        </button>

        {/* Table Number */}
        <span
          style={{
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 17,
            fontWeight: 800,
            color: adminColors.text,
            fontVariantNumeric: "tabular-nums",
            paddingRight: 20,
          }}
        >
          {table.label}
        </span>

        {/* Status + small indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <StatusDot color={meta.color} />
          <span
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              fontWeight: 700,
              color: meta.color,
            }}
          >
            {meta.label}
          </span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 4 }}>
          {(table.status === "occupied" || table.status === "billing") && (
            <>
              <BigStat value={formatCurrency(session?.currentBill ?? 0)} />
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <SmallStat icon={<ClipboardList size={12} />}>
                  {session?.orderIds.length ?? 0} Order{(session?.orderIds.length ?? 0) === 1 ? "" : "s"}
                </SmallStat>
                <SmallStat>{formatDuration(table.occupiedAt)}</SmallStat>
              </div>
              {session?.customerName && (
                <div
                  style={{
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 11,
                    color: adminColors.textSecondary,
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {session.customerName}
                </div>
              )}
            </>
          )}

          {table.status === "reserved" && reservation && (
            <>
              <div
                style={{
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                  fontSize: 12,
                  fontWeight: 700,
                  color: adminColors.text,
                }}
              >
                {reservation.customerName}
              </div>
              <SmallStat icon={<Users size={12} />}>
                {reservation.guestCount} · {reservation.reservationTime}
              </SmallStat>
            </>
          )}

          {(table.status === "available" || table.status === "cleaning" || table.status === "out_of_service") && (
            <SmallStat icon={<Users size={12} />}>Seats {table.capacity}</SmallStat>
          )}
        </div>
      </div>

      {confirmingDelete && (
        <Modal
          title={`Delete ${table.label}?`}
          onClose={() => (!deleting ? setConfirmingDelete(false) : undefined)}
          closeOnOverlayClick={!deleting}
        >
          <p
            style={{
              margin: 0,
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              color: adminColors.textSecondary,
            }}
          >
            This permanently removes the table and its QR code. This can&apos;t be undone.
          </p>
          {deleteError && (
            <p
              style={{
                margin: 0,
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 12,
                color: TABLE_BUTTON_COLORS.danger,
              }}
            >
              {deleteError}
            </p>
          )}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              disabled={deleting}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: `1px solid ${TABLE_BUTTON_COLORS.secondaryBorder}`,
                background: "#FFFFFF",
                color: TABLE_BUTTON_COLORS.secondaryText,
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 13,
                fontWeight: 600,
                cursor: deleting ? "not-allowed" : "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              style={{
                padding: "8px 14px",
                borderRadius: 10,
                border: "none",
                background: TABLE_BUTTON_COLORS.danger,
                color: "#FFFFFF",
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 13,
                fontWeight: 700,
                cursor: deleting ? "not-allowed" : "pointer",
                opacity: deleting ? 0.7 : 1,
              }}
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

function StatusDot({ color }: { color: string }) {
  return (
    <span
      style={{
        display: "inline-block",
        width: 6,
        height: 6,
        borderRadius: "50%",
        background: color,
      }}
    />
  );
}

function BigStat({ value }: { value: string }) {
  return (
    <span
      style={{
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 20,
        fontWeight: 800,
        color: adminColors.text,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </span>
  );
}

function SmallStat({ children, icon }: { children: React.ReactNode; icon?: React.ReactNode }) {
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 12,
        fontWeight: 600,
        color: adminColors.textSecondary,
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {icon}
      {children}
    </span>
  );
}
