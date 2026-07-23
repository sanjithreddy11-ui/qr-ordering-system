"use client";

import React, { useEffect, useState } from "react";
import { Users, ClipboardList, Trash2 } from "lucide-react";
import { adminColors, Badge, Modal } from "@/components/admin/ui";
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
          borderRadius: 12,
          padding: 16,
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
          opacity: table.isActive === false ? 0.5 : 1,
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
            top: 10,
            right: 10,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 26,
            height: 26,
            borderRadius: 8,
            border: "none",
            background: "transparent",
            color: adminColors.textSecondary,
            cursor: "pointer",
          }}
        >
          <Trash2 size={14} />
        </button>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: 24 }}>
          <span
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 15,
              fontWeight: 700,
              color: adminColors.text,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {table.label}
          </span>
        </div>

        <Badge color={meta.color}>
          <StatusDot color={meta.color} />
          {meta.label}
        </Badge>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 12,
            color: adminColors.textSecondary,
          }}
        >
          <Users size={13} /> Seats {table.capacity}
        </div>

        {table.status === "occupied" || table.status === "billing" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {session?.customerName && <Row label="Customer" value={session.customerName} />}
            <Row
              label="Occupied since"
              value={
                table.occupiedAt
                  ? new Date(table.occupiedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
                  : "—"
              }
            />
            <Row label="Duration" value={formatDuration(table.occupiedAt)} />
            <Row label="Bill" value={formatCurrency(session?.currentBill ?? 0)} />
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 4,
                fontSize: 12,
                color: adminColors.textSecondary,
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              }}
            >
              <ClipboardList size={13} /> {session?.orderIds.length ?? 0} order
              {(session?.orderIds.length ?? 0) === 1 ? "" : "s"}
            </div>
          </div>
        ) : table.status === "reserved" && reservation ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <Row label="Customer" value={reservation.customerName} />
            <Row label="Time" value={`${reservation.reservationDate} · ${reservation.reservationTime}`} />
            <Row label="Guests" value={String(reservation.guestCount)} />
          </div>
        ) : null}
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 12,
        color: adminColors.textSecondary,
      }}
    >
      <span>{label}</span>
      <span style={{ color: adminColors.text, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}
