"use client";

import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader, Card, PrimaryButton, TextInput, TextArea, adminColors } from "@/components/admin/ui";
import { fetchRestaurantProfile, updateRestaurantProfile, RestaurantProfile } from "@/lib/admin-api";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants

export default function AdminSettingsPage() {
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRestaurantProfile(RESTAURANT_ID)
      .then(setProfile)
      .catch(() => setError("Couldn't load restaurant profile"))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!profile) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateRestaurantProfile(RESTAURANT_ID, {
        name: profile.name,
        logo: profile.logo,
        description: profile.description,
        address: profile.address,
        phone: profile.phone,
      });
      setProfile(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <PageHeader title="Restaurant Settings" description="This information appears on your customer-facing landing page" />

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && profile && (
        <Card style={{ maxWidth: 480 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <TextInput label="Restaurant Name" value={profile.name} onChange={(v) => setProfile({ ...profile, name: v })} />
            <TextArea label="Description" value={profile.description} onChange={(v) => setProfile({ ...profile, description: v })} />
            <TextInput label="Address" value={profile.address} onChange={(v) => setProfile({ ...profile, address: v })} />
            <TextInput label="Phone" value={profile.phone} onChange={(v) => setProfile({ ...profile, phone: v })} />
            <TextInput label="Logo path" value={profile.logo} onChange={(v) => setProfile({ ...profile, logo: v })} placeholder="/logo.png" />

            {error && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>}
            {saved && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.success }}>Saved!</div>}

            <PrimaryButton onClick={handleSave} disabled={saving}>
              <Save size={14} /> {saving ? "Saving…" : "Save Changes"}
            </PrimaryButton>
          </div>
        </Card>
      )}
    </div>
  );
}
