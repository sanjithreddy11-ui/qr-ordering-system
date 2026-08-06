"use client";

import React, { useMemo, useState } from "react";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { Modal, Select, SecondaryButton, adminColors } from "@/components/admin/ui";
import { transferTableSession, type TableGridItem } from "@/lib/admin-api";
import { TablePrimaryButton } from "./tableButtons";
import { TABLE_BUTTON_COLORS } from "./tableStatus";
import ModalHeader from "./ModalHeader";

// A "Reserved" table can still receive a transfer as long as its
// reservation hasn't actually started yet (Step 2 of the spec) — mirrors
// the same check made server-side in
// controllers/tableStatusController.js:transferTable.
function reservationHasStarted(table: TableGridItem): boolean {
  const r = table.activeReservation;
  if (!r) return true;
  const startsAt = new Date(`${r.reservationDate}T${r.reservationTime}`);
  if (Number.isNaN(startsAt.getTime())) return true;
  return startsAt.getTime() <= Date.now();
}

// Only tables the "Move To" dropdown is allowed to list: Available, or
// Reserved-but-not-yet-started. Never Occupied / Billing / Awaiting
// Payment / Cleaning / Out of Service.
function isTransferEligible(table: TableGridItem): boolean {
  if (table.status === "available") return true;
  if (table.status === "reserved") return !reservationHasStarted(table);
  return false;
}

export default function TransferTableModal({
  table,
  tables,
  onClose,
  onTransferred,
  onDone,
}: {
  /** The occupied table the "Shift Table" action was opened from. */
  table: TableGridItem;
  /** Full table grid, used to compute the list of eligible destinations. */
  tables: TableGridItem[];
  /** Cancel / X — dismisses the modal without any drawer-level side effect. */
  onClose: () => void;
  /** Fired the instant the transfer succeeds, so the Table Grid/drawer behind this modal can refresh immediately (not gated on the user clicking "Done"). */
  onTransferred: () => void;
  /** "Done" on the success screen — the customer isn't at `table` anymore, so this is also the caller's cue to close the Table Details drawer itself. */
  onDone: () => void;
}) {
  const eligibleTables = useMemo(
    () => tables.filter((t) => t._id !== table._id && isTransferEligible(t)),
    [tables, table._id]
  );

  const [destinationTableId, setDestinationTableId] = useState(eligibleTables[0]?._id ?? "");
  const [step, setStep] = useState<"select" | "confirm" | "success">("select");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  const destinationTable = eligibleTables.find((t) => t._id === destinationTableId) || null;

  // The X button / Escape key needs to behave differently once the
  // transfer has actually happened: before success, it's a plain cancel;
  // after success, `table` (the drawer this modal was opened from) no
  // longer has an active session, so dismissing needs to close the drawer
  // too — same as clicking "Done".
  const handleDismiss = step === "success" ? onDone : onClose;

  const handleContinue = () => {
    if (!destinationTableId) {
      setError("Choose a table to move this session to");
      return;
    }
    setError(null);
    setStep("confirm");
  };

  const handleConfirm = async () => {
    if (!destinationTableId) return;
    setBusy(true);
    setError(null);
    try {
      const result = await transferTableSession(table._id, destinationTableId);
      setSuccessMessage(result.message);
      setStep("success");
      onTransferred();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not transfer this session");
      setStep("select");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Transfer Dining Session"
      titleNode={<ModalHeader title="Transfer Dining Session" onClose={handleDismiss} />}
      onClose={handleDismiss}
      closeOnOverlayClick={false}
    >
      {step === "select" && (
        <>
          <ReadOnlyRow label="Current Table" value={table.label} />

          {eligibleTables.length === 0 ? (
            <p style={{ margin: 0, ...bodyText(13), color: adminColors.textSecondary }}>
              No tables are currently available to transfer to.
            </p>
          ) : (
            <Select
              label="Move To"
              value={destinationTableId}
              onChange={setDestinationTableId}
              options={eligibleTables.map((t) => ({
                value: t._id,
                label: t.status === "reserved" ? `${t.label} · Seats ${t.capacity} (Reserved later)` : `${t.label} · Seats ${t.capacity}`,
              }))}
            />
          )}

          {error && <ErrorText>{error}</ErrorText>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <SecondaryButton onClick={onClose}>Cancel</SecondaryButton>
            <TablePrimaryButton onClick={handleContinue} disabled={eligibleTables.length === 0}>
              Transfer
            </TablePrimaryButton>
          </div>
        </>
      )}

      {step === "confirm" && destinationTable && (
        <>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
              padding: "14px 10px",
              borderRadius: 10,
              border: `1px solid ${adminColors.border}`,
              background: adminColors.bg,
            }}
          >
            <span style={{ ...bodyText(15, 800), color: adminColors.text }}>{table.label}</span>
            <ArrowRight size={16} color={adminColors.textSecondary} />
            <span style={{ ...bodyText(15, 800), color: adminColors.text }}>{destinationTable.label}</span>
          </div>

          <p style={{ margin: 0, ...bodyText(13), color: adminColors.textSecondary }}>
            Move customer from {table.label} to {destinationTable.label}? All active orders, billing information,
            discounts, KOT history, and the dining session will continue on the new table.
          </p>

          {error && <ErrorText>{error}</ErrorText>}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
            <SecondaryButton onClick={() => setStep("select")} disabled={busy}>
              Cancel
            </SecondaryButton>
            <TablePrimaryButton onClick={handleConfirm} disabled={busy}>
              {busy ? "Transferring…" : "Transfer"}
            </TablePrimaryButton>
          </div>
        </>
      )}

      {step === "success" && (
        <>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, padding: "10px 0" }}>
            <CheckCircle2 size={32} color={adminColors.success} />
            <p style={{ margin: 0, textAlign: "center", ...bodyText(13, 600), color: adminColors.text }}>
              {successMessage}
            </p>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 4 }}>
            <TablePrimaryButton onClick={onDone}>Done</TablePrimaryButton>
          </div>
        </>
      )}
    </Modal>
  );
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span
        style={{
          ...bodyText(12, 700),
          color: adminColors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </span>
      <div
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          background: adminColors.bg,
          ...bodyText(14, 700),
          color: adminColors.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function ErrorText({ children }: { children: React.ReactNode }) {
  return <p style={{ margin: 0, ...bodyText(12, 600), color: TABLE_BUTTON_COLORS.danger }}>{children}</p>;
}

function bodyText(size: number, weight = 400): React.CSSProperties {
  return {
    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
    fontSize: size,
    fontWeight: weight,
  };
}
