"use client";

import React, { useEffect, useState } from "react";
import { Plus, Trash2, Save } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, Badge, adminColors } from "@/components/admin/ui";
import { fetchGstSettings, updateGstSettings, GstSettings } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

export default function GstSlabsTab({ restaurantId }: { restaurantId: string }) {
  const [settings, setSettings] = useState<GstSettings | null>(null);
  const [slabs, setSlabs] = useState<number[]>([]);
  const [newSlab, setNewSlab] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchGstSettings(restaurantId)
      .then((s) => {
        setSettings(s);
        setSlabs(s.slabs);
      })
      .catch(() => setError("Couldn't load GST slabs"))
      .finally(() => setLoading(false));
  }, [restaurantId]);

  const addSlab = () => {
    const value = Number(newSlab);
    if (!newSlab || Number.isNaN(value) || value < 0 || value > 100) {
      setError("Enter a valid percentage between 0 and 100");
      return;
    }
    if (slabs.includes(value)) {
      setError("That slab already exists");
      return;
    }
    setError(null);
    setSlabs([...slabs, value].sort((a, b) => a - b));
    setNewSlab("");
  };

  const removeSlab = (value: number) => {
    if (settings && value === settings.defaultGstPercentage) {
      setError("Can't remove the slab currently set as the Default GST % — change the default first in GST Settings.");
      return;
    }
    setError(null);
    setSlabs(slabs.filter((s) => s !== value));
  };

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateGstSettings(restaurantId, { slabs });
      setSettings(updated);
      setSlabs(updated.slabs);
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

  return (
    <div style={{ maxWidth: 640 }}>
      <Card>
        <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text, marginBottom: 4 }}>
          GST Slabs
        </div>
        <p style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, marginTop: 0, marginBottom: 16 }}>
          Every percentage a menu item can be billed at (Menu Management → item → GST Slab). Common slabs
          are 5%, 12%, 18%, and 28%.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {slabs.length === 0 && (
            <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
              No slabs configured yet.
            </span>
          )}
          {slabs.map((s) => (
            <div
              key={s}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 8px 8px 14px",
                borderRadius: 999,
                border: `1px solid ${adminColors.border}`,
                background: "#FFFFFF",
              }}
            >
              <span style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text }}>
                {s}%
              </span>
              {settings && s === settings.defaultGstPercentage && <Badge color={adminColors.primary}>Default</Badge>}
              <button
                type="button"
                onClick={() => removeSlab(s)}
                aria-label={`Remove ${s}% slab`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 22,
                  height: 22,
                  borderRadius: "50%",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: adminColors.textSecondary,
                }}
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1, maxWidth: 160 }}>
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
              New Slab (%)
            </span>
            <input
              type="number"
              value={newSlab}
              onChange={(e) => setNewSlab(e.target.value)}
              placeholder="e.g. 12"
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
          <SecondaryButton onClick={addSlab}>
            <Plus size={14} /> Add Slab
          </SecondaryButton>
        </div>
      </Card>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 16 }}>
        <PrimaryButton onClick={handleSave} disabled={saving}>
          <Save size={15} /> {saving ? "Saving…" : "Save Slabs"}
        </PrimaryButton>
        {saved && (
          <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.success }}>
            Saved
          </span>
        )}
        {error && <span style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.danger }}>{error}</span>}
      </div>
    </div>
  );
}
