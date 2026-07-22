"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, adminColors } from "@/components/admin/ui";
import { fetchReservations, checkInReservation, markReservationNoShow, cancelReservation, type ReservationData } from "@/lib/admin-api";

type RangeKey = "today" | "tomorrow" | "week" | "month";

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function rangeFor(key: RangeKey): { from: string; to: string } {
  const now = new Date();
  if (key === "today") {
    const d = isoDate(now);
    return { from: d, to: d };
  }
  if (key === "tomorrow") {
    const t = new Date(now);
    t.setDate(t.getDate() + 1);
    const d = isoDate(t);
    return { from: d, to: d };
  }
  if (key === "week") {
    const end = new Date(now);
    end.setDate(end.getDate() + 7);
    return { from: isoDate(now), to: isoDate(end) };
  }
  const end = new Date(now);
  end.setMonth(end.getMonth() + 1);
  return { from: isoDate(now), to: isoDate(end) };
}

export default function ReservationCalendar({
  restaurantId,
  tableLabelById,
  onChanged,
}: {
  restaurantId: string;
  tableLabelById: Map<string, string>;
  onChanged: () => void;
}) {
  const [range, setRange] = useState<RangeKey>("today");
  const [reservations, setReservations] = useState<ReservationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { from, to } = rangeFor(range);
      const data = await fetchReservations(restaurantId, { from, to });
      setReservations(data.filter((r) => !["cancelled", "no_show", "completed"].includes(r.status)));
    } finally {
      setLoading(false);
    }
  }, [restaurantId, range]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (reservationId: string, action: () => Promise<unknown>) => {
    setBusyId(reservationId);
    try {
      await action();
      await load();
      onChanged();
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card>
      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {(["today", "tomorrow", "week", "month"] as RangeKey[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            style={{
              padding: "6px 14px",
              borderRadius: 999,
              border: `1px solid ${range === r ? adminColors.primary : adminColors.border}`,
              background: range === r ? adminColors.primary : "#FFFFFF",
              color: range === r ? "#FFFFFF" : adminColors.text,
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 12,
              fontWeight: 700,
              textTransform: "capitalize",
              cursor: "pointer",
            }}
          >
            {r}
          </button>
        ))}
      </div>

      {loading && (
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
          Loading…
        </p>
      )}

      {!loading && reservations.length === 0 && (
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
          No reservations in this range.
        </p>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {reservations.map((r) => (
          <div
            key={r.reservationId}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              padding: "10px 14px",
              borderRadius: 12,
              border: `1px solid ${adminColors.border}`,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, fontWeight: 700, color: adminColors.text }}>
                {r.customerName} · {tableLabelById.get(r.tableId) ?? "Table"}
              </div>
              <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 12, color: adminColors.textSecondary }}>
                {r.reservationDate} · {r.reservationTime} · {r.guestCount} guests · {r.status}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              {r.status !== "checked_in" && (
                <>
                  <ActionBtn label="Check In" busy={busyId === r.reservationId} onClick={() => act(r.reservationId, () => checkInReservation(r.reservationId))} />
                  <ActionBtn label="No Show" busy={busyId === r.reservationId} onClick={() => act(r.reservationId, () => markReservationNoShow(r.reservationId))} />
                  <ActionBtn label="Cancel" danger busy={busyId === r.reservationId} onClick={() => act(r.reservationId, () => cancelReservation(r.reservationId))} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ActionBtn({ label, onClick, busy, danger }: { label: string; onClick: () => void; busy: boolean; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      style={{
        padding: "5px 10px",
        borderRadius: 8,
        border: `1px solid ${danger ? adminColors.danger : adminColors.border}`,
        background: "#FFFFFF",
        color: danger ? adminColors.danger : adminColors.text,
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        fontSize: 11,
        fontWeight: 700,
        cursor: busy ? "not-allowed" : "pointer",
        opacity: busy ? 0.6 : 1,
      }}
    >
      {label}
    </button>
  );
}
