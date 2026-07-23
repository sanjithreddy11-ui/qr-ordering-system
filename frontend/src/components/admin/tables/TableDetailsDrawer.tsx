"use client";

import React, { useEffect, useState } from "react";
import { Modal, SecondaryButton, Badge, adminColors } from "@/components/admin/ui";
import {
  fetchTableDetails,
  markTableBilling,
  closeTableSession,
  markTableAvailable,
  markTableOutOfService,
  cancelReservation,
  checkInReservation,
  markReservationNoShow,
  fetchSessionOrders,
  type TableGridItem,
  type RecentOrder,
} from "@/lib/admin-api";
import { statusMeta, formatCurrency, formatDuration, formatTime } from "./tableStatus";
import { TablePrimaryButton } from "./tableButtons";
import ModalHeader from "./ModalHeader";

export default function TableDetailsDrawer({
  tableId,
  onClose,
  onChanged,
}: {
  tableId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [table, setTable] = useState<TableGridItem | null>(null);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const { table: t, activeSession, activeReservation } = await fetchTableDetails(tableId);
      const full: TableGridItem = { ...(t as TableGridItem), activeSession, activeReservation };
      setTable(full);
      if (activeSession) {
        const { orders: sessionOrders } = await fetchSessionOrders(activeSession.sessionId);
        setOrders(sessionOrders);
      } else {
        setOrders([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load table");
    } finally {
      setLoading(false);
    }
  }, [tableId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await load();
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !table) {
    return (
      <Modal title="Table" onClose={onClose}>
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
          Loading…
        </p>
      </Modal>
    );
  }

  const meta = statusMeta(table.status);
  const session = table.activeSession;
  const reservation = table.activeReservation;

  return (
    <Modal title={table.label} titleNode={<ModalHeader title={table.label} onClose={onClose} />} onClose={onClose}>
      <Badge color={meta.color}>
        <span
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: meta.color,
          }}
        />
        {meta.label}
      </Badge>

      {/* Occupied / Billing: session details */}
      {session && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <DetailRow label="Customer Name" value={session.customerName || "Walk-in"} />
          <DetailRow label="Phone Number" value={session.phoneNumber || "—"} />
          <DetailRow label="Occupied Time" value={formatTime(table.occupiedAt)} />
          <DetailRow label="Session Duration" value={formatDuration(table.occupiedAt)} />
          <DetailRow label="Current Bill" value={formatCurrency(session.currentBill)} />
          <DetailRow label="Orders" value={String(orders.length)} />
          {orders.length > 0 && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 4 }}>
              {orders.map((o) => (
                <div
                  key={o.orderId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    fontSize: 12,
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    color: adminColors.textSecondary,
                    border: `1px solid ${adminColors.border}`,
                    borderRadius: 8,
                    padding: "6px 10px",
                  }}
                >
                  <span>
                    #{o.orderId.slice(-6)} · {o.status}
                  </span>
                  <span style={{ color: adminColors.text, fontWeight: 600 }}>{formatCurrency(o.totalAmount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Reserved: reservation details */}
      {reservation && !session && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <DetailRow label="Customer Name" value={reservation.customerName} />
          <DetailRow label="Phone Number" value={reservation.phoneNumber} />
          <DetailRow label="Reservation" value={`${reservation.reservationDate} · ${reservation.reservationTime}`} />
          <DetailRow label="Guests" value={String(reservation.guestCount)} />
          <DetailRow label="Expected Duration" value={`${reservation.expectedDuration} min`} />
          {reservation.specialNotes && <DetailRow label="Notes" value={reservation.specialNotes} />}
        </div>
      )}

      {table.status === "available" && (
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
          This table is free. Customers can order by scanning its QR code, or use the &quot;+ Reserve Table&quot; button above to book it for a phone/walk-in reservation.
        </p>
      )}

      {error && (
        <p style={{ color: adminColors.danger, fontSize: 12, fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", margin: 0 }}>
          {error}
        </p>
      )}

      {/* Actions, per current status */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 4 }}>
        {table.status === "available" && (
          <SecondaryButton onClick={() => run(() => markTableOutOfService(table._id))}>
            Mark Out of Service
          </SecondaryButton>
        )}

        {table.status === "reserved" && reservation && (
          <>
            <TablePrimaryButton onClick={() => run(() => checkInReservation(reservation.reservationId))} disabled={busy}>
              Check In
            </TablePrimaryButton>
            <SecondaryButton onClick={() => run(() => markReservationNoShow(reservation.reservationId))}>
              No Show
            </SecondaryButton>
            <SecondaryButton danger onClick={() => run(() => cancelReservation(reservation.reservationId))}>
              Cancel Reservation
            </SecondaryButton>
          </>
        )}

        {table.status === "occupied" && (
          <TablePrimaryButton onClick={() => run(() => markTableBilling(table._id))} disabled={busy}>
            Move to Billing
          </TablePrimaryButton>
        )}

        {table.status === "billing" && (
          <TablePrimaryButton onClick={() => run(() => closeTableSession(table._id))} disabled={busy}>
            Close Session
          </TablePrimaryButton>
        )}

        {table.status === "cleaning" && (
          <TablePrimaryButton onClick={() => run(() => markTableAvailable(table._id))} disabled={busy}>
            Mark Available
          </TablePrimaryButton>
        )}

        {table.status === "out_of_service" && (
          <TablePrimaryButton onClick={() => run(() => markTableAvailable(table._id))} disabled={busy}>
            Mark Available
          </TablePrimaryButton>
        )}

        {table.status !== "out_of_service" && table.status !== "available" && table.status !== "reserved" && (
          <SecondaryButton onClick={() => run(() => markTableOutOfService(table._id))}>
            Mark Out of Service
          </SecondaryButton>
        )}
      </div>
    </Modal>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span
        style={{
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 12,
          color: adminColors.textSecondary,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          fontSize: 12,
          fontWeight: 600,
          color: adminColors.text,
          textAlign: "right",
        }}
      >
        {value}
      </span>
    </div>
  );
}
