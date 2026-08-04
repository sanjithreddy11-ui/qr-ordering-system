"use client";

import React, { useState } from "react";
import { Printer, RefreshCcw, CheckCircle2, XCircle, Loader2, ChefHat, Receipt, Volume2 } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, adminColors } from "@/components/admin/ui";
import { usePrinterStore, PrinterError, type PrinterRole } from "@/store/printer-store";
import { playOrderAlertSound, unlockOrderAlertAudio } from "@/lib/printer/orderAlertSound";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const STATUS_META: Record<string, { label: string; color: string }> = {
  idle: { label: "Not connected", color: adminColors.textSecondary },
  connecting: { label: "Connecting…", color: adminColors.warning },
  connected: { label: "Connected", color: adminColors.success },
  error: { label: "Connection error", color: adminColors.danger },
};

/** One printer-role selector (Kitchen or Counter) with its own test-print button. */
function PrinterRoleRow({
  role,
  icon,
  label,
  hint,
  value,
  onChange,
}: {
  role: PrinterRole;
  icon: React.ReactNode;
  label: string;
  hint: string;
  value: string | null;
  onChange: (name: string | null) => void;
}) {
  const { status, availablePrinters, testPrint } = usePrinterStore();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      await testPrint(role, 80);
      setResult({ ok: true, message: `Test slip sent to ${value ?? "the Windows default printer"}.` });
    } catch (err) {
      const message = err instanceof PrinterError ? err.message : "Test print failed.";
      setResult({ ok: false, message });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontFamily: bodyFont,
          fontSize: 12,
          fontWeight: 700,
          color: adminColors.textSecondary,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {icon} {label}
      </span>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          style={{
            flex: "1 1 220px",
            padding: "10px 12px",
            borderRadius: 8,
            border: `1px solid ${adminColors.border}`,
            fontFamily: bodyFont,
            fontSize: 13,
            color: adminColors.text,
            background: "#FFFFFF",
          }}
        >
          <option value="">Windows default printer</option>
          {availablePrinters.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
        <PrimaryButton onClick={handleTest} disabled={testing || status !== "connected"}>
          {testing ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
          {testing ? "Printing…" : "Test"}
        </PrimaryButton>
      </div>
      <span style={{ fontFamily: bodyFont, fontSize: 11, color: adminColors.textSecondary }}>{hint}</span>
      {result && (
        <span
          style={{
            fontFamily: bodyFont,
            fontSize: 11,
            fontWeight: 600,
            color: result.ok ? adminColors.success : adminColors.danger,
          }}
        >
          {result.message}
        </span>
      )}
    </div>
  );
}

export default function PrinterSettingsCard() {
  const {
    status,
    errorMessage,
    kitchenPrinter,
    counterPrinter,
    autoPrintKot,
    orderAlertSoundEnabled,
    connect,
    refreshPrinters,
    setKitchenPrinter,
    setCounterPrinter,
    setAutoPrintKot,
    setOrderAlertSoundEnabled,
  } = usePrinterStore();

  const meta = STATUS_META[status] ?? STATUS_META.idle;

  return (
    <Card style={{ maxWidth: 480 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Printer size={16} color={adminColors.text} />
          <span style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: adminColors.text }}>
            Thermal Printers (QZ Tray)
          </span>
        </div>
        <StatusPill label={meta.label} color={meta.color} spinning={status === "connecting"} />
      </div>

      {status === "error" && errorMessage && (
        <p style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.danger, margin: "0 0 12px" }}>
          {errorMessage}
        </p>
      )}

      <PrinterRoleRow
        role="kitchen"
        icon={<ChefHat size={12} />}
        label="Kitchen Printer"
        hint="Both printers receive every Kitchen Order Ticket (KOT) automatically."
        value={kitchenPrinter}
        onChange={setKitchenPrinter}
      />

      <PrinterRoleRow
        role="counter"
        icon={<Receipt size={12} />}
        label="Counter Printer"
        hint="Also the only printer used for customer bills/receipts."
        value={counterPrinter}
        onChange={setCounterPrinter}
      />

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          fontFamily: bodyFont,
          fontSize: 13,
          color: adminColors.text,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={autoPrintKot}
          onChange={(e) => setAutoPrintKot(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span>
          <strong>Auto Print KOT</strong>
          <br />
          <span style={{ fontSize: 11, color: adminColors.textSecondary }}>
            Print automatically the instant a new order comes in — no clicks needed.
          </span>
        </span>
      </label>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderRadius: 8,
          border: `1px solid ${adminColors.border}`,
          fontFamily: bodyFont,
          fontSize: 13,
          color: adminColors.text,
          marginBottom: 14,
          cursor: "pointer",
        }}
      >
        <input
          type="checkbox"
          checked={orderAlertSoundEnabled}
          onChange={(e) => setOrderAlertSoundEnabled(e.target.checked)}
          style={{ width: 16, height: 16 }}
        />
        <span style={{ flex: 1 }}>
          <strong>New Order Alert Sound</strong>
          <br />
          <span style={{ fontSize: 11, color: adminColors.textSecondary }}>
            Plays a loud alarm on this dashboard the instant a customer places an order — independent of Auto
            Print KOT above. Browsers require one click/keypress on this page before any sound can play.
          </span>
        </span>
      </label>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
        <SecondaryButton
          onClick={() => {
            // Clicking this button IS the user gesture, so it doubles as
            // the unlock — staff don't need a separate "enable sound"
            // step, the first Test click just works.
            unlockOrderAlertAudio();
            playOrderAlertSound();
          }}
        >
          <Volume2 size={14} /> Test Sound
        </SecondaryButton>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SecondaryButton onClick={() => (status === "connected" ? refreshPrinters() : connect())}>
          <RefreshCcw size={14} /> {status === "connected" ? "Refresh Printers" : "Connect"}
        </SecondaryButton>
      </div>

      <p style={{ fontFamily: bodyFont, fontSize: 11, color: adminColors.textSecondary, marginTop: 14, lineHeight: 1.5 }}>
        Requires the QZ Tray desktop app running on this PC. The first connection may show a one-time
        &ldquo;allow this website?&rdquo; prompt from QZ Tray — click Allow. Choose the Kitchen and Counter
        printers above once; they&rsquo;re remembered on this PC.
      </p>
    </Card>
  );
}

function StatusPill({ label, color, spinning }: { label: string; color: string; spinning?: boolean }) {
  const Icon = spinning ? Loader2 : color === adminColors.success ? CheckCircle2 : color === adminColors.danger ? XCircle : CheckCircle2;
  return (
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 5,
        padding: "4px 10px",
        borderRadius: 999,
        background: `${color}1A`,
        color,
        fontFamily: bodyFont,
        fontSize: 11,
        fontWeight: 700,
      }}
    >
      <Icon size={12} className={spinning ? "animate-spin" : undefined} />
      {label}
    </span>
  );
}
