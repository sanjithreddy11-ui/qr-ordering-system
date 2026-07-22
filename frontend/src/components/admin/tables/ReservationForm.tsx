"use client";

import React, { useState } from "react";
import { Modal, TextInput, TextArea, PrimaryButton, SecondaryButton, adminColors } from "@/components/admin/ui";
import { createReservation, type TableGridItem } from "@/lib/admin-api";

export default function ReservationForm({
  restaurantId,
  table,
  onClose,
  onCreated,
}: {
  restaurantId: string;
  table: TableGridItem;
  onClose: () => void;
  onCreated: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [customerName, setCustomerName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [reservationDate, setReservationDate] = useState(today);
  const [reservationTime, setReservationTime] = useState("19:00");
  const [guestCount, setGuestCount] = useState(String(table.capacity || 2));
  const [expectedDuration, setExpectedDuration] = useState("60");
  const [specialNotes, setSpecialNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!customerName.trim() || !phoneNumber.trim()) {
      setError("Customer name and phone number are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createReservation({
        restaurantId,
        tableId: table._id,
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
    <Modal title={`Reserve ${table.label}`} onClose={onClose}>
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
        <p style={{ color: adminColors.danger, fontSize: 12, fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", margin: 0 }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
        <PrimaryButton onClick={handleSubmit} disabled={saving}>
          {saving ? "Saving…" : "Reserve Table"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}
