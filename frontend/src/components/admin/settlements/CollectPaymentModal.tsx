"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Wallet,
  Smartphone,
  CreditCard,
  Landmark,
  Clock3,
  X,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";
import { Modal, TextArea, Select, adminColors } from "@/components/admin/ui";
import {
  fetchSettlement,
  collectSettlement,
  fetchAdminStaff,
  type Settlement,
  type SettlementItem,
  type SettlementPaymentMethod,
  type SettlementPaymentEntry,
  type AdminStaff,
} from "@/lib/admin-api";
import { TablePrimaryButton } from "@/components/admin/tables/tableButtons";

const RESTAURANT_ID = "maxibrew";
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function formatCurrency(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

const METHODS: { key: SettlementPaymentMethod; label: string; icon: React.ElementType }[] = [
  { key: "cash", label: "Cash", icon: Wallet },
  { key: "upi", label: "UPI", icon: Smartphone },
  { key: "card", label: "Card", icon: CreditCard },
  { key: "bank_transfer", label: "Bank Transfer", icon: Landmark },
  { key: "credit", label: "Credit (Pay Later)", icon: Clock3 },
];

// Split Payments: one row of local state per payment method — whether the
// cashier has enabled it in the breakdown, and the raw text they've typed
// into its amount field (kept as a string so a half-typed "20" isn't
// clobbered by number parsing on every keystroke).
type MethodState = { enabled: boolean; amount: string };
type MethodStateMap = Record<SettlementPaymentMethod, MethodState>;

const EMPTY_STATE: MethodStateMap = {
  cash: { enabled: false, amount: "" },
  upi: { enabled: false, amount: "" },
  card: { enabled: false, amount: "" },
  bank_transfer: { enabled: false, amount: "" },
  credit: { enabled: false, amount: "" },
};

// Sanitize free-text amount input: digits + at most one decimal point,
// at most 2 decimal places.
function sanitizeAmountInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  const head = cleaned.slice(0, firstDot + 1);
  const tail = cleaned.slice(firstDot + 1).replace(/\./g, "").slice(0, 2);
  return head + tail;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export default function CollectPaymentModal({
  settlementId,
  onClose,
  onCollected,
}: {
  settlementId: string;
  onClose: () => void;
  onCollected: () => void;
}) {
  const [settlement, setSettlement] = useState<Settlement | null>(null);
  const [items, setItems] = useState<SettlementItem[]>([]);
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Split Payments: Payment Breakdown state.
  const [methods, setMethods] = useState<MethodStateMap>(EMPTY_STATE);

  const [receivedBy, setReceivedBy] = useState("");
  const [remarks, setRemarks] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [{ settlement: s, items: itemLines }, staffList] = await Promise.all([
          fetchSettlement(settlementId),
          fetchAdminStaff(RESTAURANT_ID).catch(() => []),
        ]);
        setSettlement(s);
        setItems(itemLines);
        setStaff(staffList);
        // Default: a single Cash line pre-filled with the full bill —
        // the common case — cashier can add/adjust methods from there.
        setMethods({
          ...EMPTY_STATE,
          cash: { enabled: true, amount: String(Math.round(s.grandTotal)) },
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load settlement");
      } finally {
        setLoading(false);
      }
    })();
  }, [settlementId]);

  const enabledKeys = useMemo(
    () => METHODS.map((m) => m.key).filter((k) => methods[k].enabled),
    [methods]
  );

  const entries: { key: SettlementPaymentMethod; label: string; amount: number; raw: string }[] = useMemo(
    () =>
      METHODS.filter((m) => methods[m.key].enabled).map((m) => {
        const raw = methods[m.key].amount;
        const parsed = parseFloat(raw);
        return { key: m.key, label: m.label, amount: Number.isFinite(parsed) ? parsed : 0, raw };
      }),
    [methods]
  );

  // Every rupee figure on this screen (Grand Total, item prices, etc.) is
  // shown rounded to whole rupees via formatCurrency. settlement.grandTotal
  // itself can carry paise-level fractions from tax math (e.g. 544.45), so
  // balancing against the raw value could show "₹0 remaining" on screen
  // while still failing a strict decimal-equality check underneath. Round
  // once here so what the cashier sees is exactly what gets validated.
  const grandTotal = settlement ? Math.round(settlement.grandTotal) : 0;
  const totalReceived = round2(entries.reduce((sum, e) => sum + (e.amount > 0 ? e.amount : 0), 0));
  const remaining = round2(grandTotal - totalReceived);
  const balanced = Math.abs(remaining) < 0.005;

  const hasCredit = entries.some((e) => e.key === "credit");

  // Live validation — data-integrity checks only (a blank field, a
  // negative amount). The settlement can ALWAYS be completed regardless of
  // how totalReceived compares to grandTotal — full, partial, zero, and
  // over payment are all allowed, so there's no "must balance" check here
  // anymore.
  const validationError = useMemo(() => {
    for (const e of entries) {
      if (e.raw.trim() === "") return `Enter an amount for ${e.label}`;
      if (e.amount < 0) return "Negative amounts are not allowed";
    }
    return null;
  }, [entries]);

  const canComplete = !!settlement && !busy && !validationError;

  function toggleMethod(key: SettlementPaymentMethod) {
    setMethods((prev) => {
      const currentlyEnabled = METHODS.map((m) => m.key).filter((k) => prev[k].enabled);
      const isEnabled = prev[key].enabled;
      // Can't drop below one enabled method.
      if (isEnabled && currentlyEnabled.length === 1) return prev;

      if (isEnabled) {
        return { ...prev, [key]: { enabled: false, amount: "" } };
      }

      // Enabling: pre-fill with whatever's left of the bill, so the
      // common 2-way split just needs the cashier to confirm/adjust.
      const receivedSoFar = currentlyEnabled.reduce((sum, k) => {
        const v = parseFloat(prev[k].amount);
        return sum + (Number.isFinite(v) && v > 0 ? v : 0);
      }, 0);
      const suggestion = settlement ? Math.max(round2(Math.round(settlement.grandTotal) - receivedSoFar), 0) : 0;
      return { ...prev, [key]: { enabled: true, amount: suggestion > 0 ? String(suggestion) : "" } };
    });
  }

  function setAmount(key: SettlementPaymentMethod, raw: string) {
    setMethods((prev) => ({ ...prev, [key]: { ...prev[key], amount: sanitizeAmountInput(raw) } }));
  }

  const handleComplete = async () => {
    if (!settlement || !canComplete) return;
    setError(null);
    setBusy(true);
    try {
      const paymentMethods: SettlementPaymentEntry[] = entries.map((e) => ({
        method: e.key,
        amount: round2(e.amount),
      }));
      await collectSettlement(settlement.settlementId, {
        paymentMethods,
        receivedBy: receivedBy || undefined,
        remarks: remarks.trim() || undefined,
        dueDate: hasCredit && dueDate ? dueDate : undefined,
      });
      onCollected();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not complete settlement");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Collect Payment" onClose={onClose} maxWidth={480}>
      {loading && <p style={{ ...text(13), color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && settlement && (
        <>
          <Section>
            <Row label="Bill Number" value={settlement.billNumber} bold />
            <Row label="Customer Name" value={settlement.customerName || "Walk-in"} />
            <Row label="Phone Number" value={settlement.phoneNumber || "—"} />
            <Row label="Table Number" value={settlement.tableLabel} />
          </Section>

          {items.length > 0 && (
            <Section title="Ordered Items">
              {items.map((it) => (
                <div key={`${it.name}-${it.price}`} style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ ...text(12), color: adminColors.text }}>
                    {it.quantity} × {it.name}
                  </span>
                  <span style={{ ...text(12, 700) }}>{formatCurrency(it.price * it.quantity)}</span>
                </div>
              ))}
            </Section>
          )}

          <Section>
            <Row label="Bill Amount" value={formatCurrency(settlement.subtotal)} />
            <Row label="Tax" value={formatCurrency(settlement.tax)} />
            <div style={{ borderTop: `1px solid ${adminColors.border}`, margin: "2px 0" }} />
            <Row label="Grand Total" value={formatCurrency(settlement.grandTotal)} bold />
          </Section>

          {/* ---- Payment Breakdown (Split Payments) ---- */}
          <div>
            <FieldLabel>Payment Breakdown</FieldLabel>
            <div
              style={{
                marginTop: 6,
                border: `1px solid ${adminColors.border}`,
                borderRadius: 10,
                overflow: "hidden",
              }}
            >
              {METHODS.map((m, idx) => {
                const Icon = m.icon;
                const state = methods[m.key];
                const isLastEnabled = state.enabled && enabledKeys.length === 1;
                return (
                  <div
                    key={m.key}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: idx < METHODS.length - 1 ? `1px solid ${adminColors.border}` : "none",
                      background: state.enabled ? `${adminColors.primary}0D` : "#FFFFFF",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={state.enabled}
                      onChange={() => toggleMethod(m.key)}
                      disabled={isLastEnabled}
                      style={{ width: 16, height: 16, cursor: isLastEnabled ? "not-allowed" : "pointer", accentColor: adminColors.primary }}
                    />
                    <Icon size={16} color={state.enabled ? adminColors.primary : adminColors.textSecondary} />
                    <span
                      style={{
                        ...text(13, state.enabled ? 700 : 600),
                        color: state.enabled ? adminColors.text : adminColors.textSecondary,
                        flex: 1,
                      }}
                    >
                      {m.label}
                    </span>

                    {state.enabled && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <span style={{ ...text(13, 700), color: adminColors.textSecondary }}>₹</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={state.amount}
                          onChange={(e) => setAmount(m.key, e.target.value)}
                          placeholder="0"
                          style={{
                            width: 84,
                            padding: "6px 8px",
                            borderRadius: 8,
                            border: `1px solid ${adminColors.border}`,
                            fontFamily: bodyFont,
                            fontSize: 13,
                            fontWeight: 700,
                            color: adminColors.text,
                            textAlign: "right",
                            outline: "none",
                          }}
                        />
                        {!isLastEnabled && (
                          <button
                            type="button"
                            onClick={() => toggleMethod(m.key)}
                            title={`Remove ${m.label}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: 24,
                              height: 24,
                              borderRadius: 6,
                              border: "none",
                              background: "transparent",
                              color: adminColors.textSecondary,
                              cursor: "pointer",
                            }}
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ---- Live calculation summary ----
              Informational only — the settlement can always be completed
              regardless of what Remaining shows. This is never a blocking
              error, just a heads-up for the cashier. */}
          <Section>
            <Row label="Grand Total" value={formatCurrency(grandTotal)} bold />
            <Row label="Total Received" value={formatCurrency(totalReceived)} />
            <Row
              label="Remaining"
              value={formatCurrency(Math.abs(remaining))}
              bold
              valueColor={balanced ? adminColors.success : remaining > 0 ? adminColors.warning : adminColors.primary}
            />
            <div style={{ borderTop: `1px solid ${adminColors.border}`, margin: "2px 0" }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {balanced ? (
                <>
                  <CheckCircle2 size={15} color={adminColors.success} />
                  <span style={{ ...text(12, 700), color: adminColors.success }}>Fully paid</span>
                </>
              ) : remaining > 0 ? (
                <>
                  <AlertTriangle size={15} color={adminColors.warning} />
                  <span style={{ ...text(12, 700), color: adminColors.warning }}>
                    ⚠ Customer still owes {formatCurrency(remaining)}
                  </span>
                </>
              ) : (
                <>
                  <AlertTriangle size={15} color={adminColors.primary} />
                  <span style={{ ...text(12, 700), color: adminColors.primary }}>
                    Overpaid by {formatCurrency(Math.abs(remaining))}
                  </span>
                </>
              )}
            </div>
            <p style={{ ...text(11), color: adminColors.textSecondary, margin: 0 }}>
              You can complete this settlement regardless of the amount received.
            </p>
          </Section>

          {hasCredit && (
            <>
              <Section title="Credit Details">
                <Row
                  label="Credit (Pay Later) Amount"
                  value={formatCurrency(entries.find((e) => e.key === "credit")?.amount ?? 0)}
                  bold
                />
                <Row label="Payment Status" value="Pending Credit" />
              </Section>
              <TextInputRow label="Due Date" value={dueDate} onChange={setDueDate} type="date" />
            </>
          )}

          <Select
            label="Received By"
            value={receivedBy}
            onChange={setReceivedBy}
            options={[{ value: "", label: "Select staff…" }, ...staff.map((s) => ({ value: s.name, label: s.name }))]}
          />

          <TextArea label="Remarks" value={remarks} onChange={setRemarks} />

          <Row label="Settlement Time" value={new Date().toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })} />

          {(error || validationError) && (
            <p style={{ ...text(12), color: adminColors.danger, margin: 0 }}>{error || validationError}</p>
          )}

          <TablePrimaryButton onClick={handleComplete} disabled={!canComplete}>
            {busy ? "Completing…" : "Complete Settlement"}
          </TablePrimaryButton>
        </>
      )}
    </Modal>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        border: `1px solid ${adminColors.border}`,
        borderRadius: 10,
        padding: "10px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      {title && (
        <span style={{ ...text(12, 700), color: adminColors.text, textTransform: "uppercase", letterSpacing: "0.02em" }}>
          {title}
        </span>
      )}
      {children}
    </div>
  );
}

function Row({ label, value, bold, valueColor }: { label: string; value: string; bold?: boolean; valueColor?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
      <span style={{ ...text(12), color: adminColors.textSecondary }}>{label}</span>
      <span style={{ ...text(12, bold ? 800 : 600), color: valueColor ?? adminColors.text, textAlign: "right" }}>{value}</span>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        fontFamily: bodyFont,
        fontSize: 12,
        fontWeight: 700,
        color: adminColors.textSecondary,
        textTransform: "uppercase",
        letterSpacing: "0.04em",
      }}
    >
      {children}
    </span>
  );
}

function TextInputRow({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        style={{
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          fontFamily: bodyFont,
          fontSize: 14,
          color: adminColors.text,
          outline: "none",
        }}
      />
    </label>
  );
}

function text(size: number, weight = 400): React.CSSProperties {
  return { fontFamily: bodyFont, fontSize: size, fontWeight: weight };
}
