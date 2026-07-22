"use client";

import React, { useEffect, useState } from "react";
import { Users, ClipboardList } from "lucide-react";
import { adminColors } from "@/components/admin/ui";
import type { TableGridItem } from "@/lib/admin-api";
import { statusMeta, formatCurrency, formatDuration } from "./tableStatus";

export default function TableCard({
  table,
  onClick,
}: {
  table: TableGridItem;
  onClick: () => void;
}) {
  const meta = statusMeta(table.status);
  // Re-render every 30s so "Session Duration" keeps ticking without a refetch.
  const [, forceTick] = useState(0);
  useEffect(() => {
    if (table.status !== "occupied" && table.status !== "billing") return;
    const id = setInterval(() => forceTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [table.status]);

  const session = table.activeSession;
  const reservation = table.activeReservation;

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: "left",
        background: "#FFFFFF",
        border: `1px solid ${adminColors.border}`,
        borderRadius: 16,
        padding: 16,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        boxShadow: "0 1px 3px rgba(0,0,0,0.03)",
        opacity: table.isActive === false ? 0.5 : 1,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span
          style={{
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            fontSize: 15,
            fontWeight: 700,
            color: adminColors.text,
          }}
        >
          {table.label}
        </span>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "3px 10px",
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            background: `${meta.color}1A`,
            color: meta.color,
          }}
        >
          {meta.dot} {meta.label}
        </span>
      </div>

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
          {session?.customerName && (
            <Row label="Customer" value={session.customerName} />
          )}
          <Row label="Occupied since" value={table.occupiedAt ? new Date(table.occupiedAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "—"} />
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
            <ClipboardList size={13} /> {session?.orderIds.length ?? 0} order{(session?.orderIds.length ?? 0) === 1 ? "" : "s"}
          </div>
        </div>
      ) : table.status === "reserved" && reservation ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <Row label="Customer" value={reservation.customerName} />
          <Row label="Time" value={`${reservation.reservationDate} · ${reservation.reservationTime}`} />
          <Row label="Guests" value={String(reservation.guestCount)} />
        </div>
      ) : null}
    </button>
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
      <span style={{ color: adminColors.text, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
