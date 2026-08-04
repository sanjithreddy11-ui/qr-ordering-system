"use client";

import React, { useEffect, useState } from "react";
import { Save, ToggleLeft, ToggleRight } from "lucide-react";
import { Card, PrimaryButton, TextInput, TextArea, Select, adminColors } from "@/components/admin/ui";
import { fetchGstSettings, updateGstSettings, GstSettings } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

export default function GstSettingsTab({ restaurantId }: { restaurantId: string }) {
  const [settings, setSettings] = useState<GstSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGstSettings(restaurantId)
      .then(setSettings)
      .catch(() => setError("Couldn't load GST settings"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateGstSettings(restaurantId, {
        businessName: settings.businessName,
        gstin: settings.gstin,
        businessAddress: settings.businessAddress,
        calculationMode: settings.calculationMode,
        defaultGstPercentage: settings.defaultGstPercentage,
        enabled: settings.enabled,
      });
      setSettings(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>;
  }
  if (!settings) {
    return (
      <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.danger }}>
        {error || "Couldn't load GST settings"}
      </p>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
      {/* ---- Enable / disable GST ---- */}
      <Card>
        <button
          type="button"
          onClick={() => setSettings({ ...settings, enabled: !settings.enabled })}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            border: "none",
            background: "transparent",
            cursor: "pointer",
            padding: 0,
            textAlign: "left",
          }}
        >
          <div>
            <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>
              GST Enabled
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
              {settings.enabled
                ? "GST is applied to every bill and shown on printed invoices."
                : "GST is switched off — bills and receipts show no tax at all."}
            </div>
          </div>
          {settings.enabled ? (
            <ToggleRight size={34} color={adminColors.primary} strokeWidth={1.5} />
          ) : (
            <ToggleLeft size={34} color={adminColors.textSecondary} strokeWidth={1.5} />
          )}
        </button>
      </Card>

      {/* ---- Business / statutory details ---- */}
      <Card>
        <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text, marginBottom: 14 }}>
          Business Details
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <TextInput
            label="Business Name"
            value={settings.businessName}
            onChange={(v) => setSettings({ ...settings, businessName: v })}
            placeholder="Shown on the printed invoice header"
          />
          <TextInput
            label="GSTIN"
            value={settings.gstin}
            onChange={(v) => setSettings({ ...settings, gstin: v.toUpperCase() })}
            placeholder="e.g. 27ABCDE1234F1Z5"
          />
          <TextArea
            label="Business Address"
            value={settings.businessAddress}
            onChange={(v) => setSettings({ ...settings, businessAddress: v })}
          />
        </div>
      </Card>

      {/* ---- Calculation behavior ---- */}
      <Card>
        <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text, marginBottom: 14 }}>
          GST Calculation
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <Select
            label="GST Calculation Mode"
            value={settings.calculationMode}
            onChange={(v) => setSettings({ ...settings, calculationMode: v as "inclusive" | "exclusive" })}
            options={[
              { value: "exclusive", label: "Exclusive — GST added on top of menu price" },
              { value: "inclusive", label: "Inclusive — GST already included in menu price" },
            ]}
          />
          <Select
            label="Default GST Percentage"
            value={String(settings.defaultGstPercentage)}
            onChange={(v) => setSettings({ ...settings, defaultGstPercentage: Number(v) })}
            options={settings.slabs.map((s) => ({ value: String(s), label: `${s}%` }))}
          />
          <p style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, margin: 0 }}>
            Applied to any menu item that doesn&apos;t have its own GST Slab set in Menu Management.
            Manage the available slabs (5%, 12%, 18%, 28%, etc.) in the GST Slabs tab.
          </p>
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <PrimaryButton onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save Settings"}
        </PrimaryButton>
        {saved && (
          <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.success }}>
            Saved
          </span>
        )}
        {error && (
          <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.danger }}>{error}</span>
        )}
      </div>
    </div>
  );
}
