"use client";

import React, { useState } from "react";
import { Modal, TextInput, TextArea, Select, SecondaryButton, adminColors } from "@/components/admin/ui";
import { createReservation, type TableGridItem } from "@/lib/admin-api";
import { TablePrimaryButton } from "./tableButtons";
import { TABLE_BUTTON_COLORS } from "./tableStatus";
import ModalHeader from "./ModalHeader";

export default function ReservationForm({
  restaurantId,
  availableTables,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  availableTables: TableGridItem[];
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  // Fully local state — deliberately isolated from any other component
  // (e.g. the grid's search box) so typing here can never leak elsewhere.
  const [tableId, setTableId] = useState(availableTables[0]?._id ?? "");
  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reservationDate, setReservationDate] = useState(today);
  const [reservationTime, setReservationTime] = useState("19:00");
  const [guestCount, setGuestCount] = useState("2");
  const [expectedDuration, setExpectedDuration] = useState("60");
  const [specialNotes, setSpecialNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!tableId) {
      setError("Choose a table to reserve");
      return;
    }
    if (!customerName.trim() || !phoneNumber.trim()) {
      setError("Customer name and phone number are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createReservation({
        restaurantId,
        tableId,
        customerName: customerName.trim(),
        phoneNumber: phoneNumber.trim(),
        guestCount: Number(guestCount) || 1,
        reservationDate,
        reservationTime,
        expectedDuration: Number(expectedDuration) || 60,
        specialNotes: specialNotes.trim(),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Reserve Table"
      titleNode={<ModalHeader title="Reserve Table" onClose={onClose} />}
      onClose={onClose}
      closeOnOverlayClick={false}
    >
      {availableTables.length === 0 ? (
        <p style={{ margin: 0, fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
          No tables are currently available to reserve.
        </p>
      ) : (
        <Select
          label="Table"
          value={tableId}
          onChange={setTableId}
          options={availableTables.map((t) => ({ value: t._id, label: `${t.label} · Seats ${t.capacity}` }))}
        />
      )}

      <TextInput label="Customer Name" value={customerName} onChange={setCustomerName} placeholder="Full name" />
      <TextInput label="Phone Number" value={phoneNumber} onChange={setPhoneNumber} placeholder="+91 90000 00000" />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <TextInput label="Date" type="date" value={reservationDate} onChange={setReservationDate} />
        <TextInput label="Time" type="time" value={reservationTime} onChange={setReservationTime} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <TextInput label="Guest Count" type="number" value={guestCount} onChange={setGuestCount} />
        <TextInput label="Expected Duration (min)" type="number" value={expectedDuration} onChange={setExpectedDuration} />
      </div>
      <TextArea label="Special Notes (Optional)" value={specialNotes} onChange={setSpecialNotes} />

      {error && (
        <p style={{ color: TABLE_BUTTON_COLORS.danger, fontSize: 12, fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <TablePrimaryButton onClick={handleSubmit} disabled={saving || availableTables.length === 0}>
          {saving ? "Saving…" : "Reserve Table"}
        </TablePrimaryButton>
      </div>
    </Modal>
  );
}
