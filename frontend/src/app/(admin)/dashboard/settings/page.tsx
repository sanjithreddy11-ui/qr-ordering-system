"use client";

import React, { useEffect, useState } from "react";
import { Save } from "lucide-react";
import { PageHeader, Card, PrimaryButton, TextInput, TextArea, adminColors } from "@/components/admin/ui";
import { fetchRestaurantProfile, updateRestaurantProfile, RestaurantProfile } from "@/lib/admin-api";
import PrinterSettingsCard from "@/components/admin/printer/PrinterSettingsCard";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants

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
      <PageHeader title="Settings"  />

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}


      <div style={{ marginTop: 24 }}>
        <PrinterSettingsCard />
      </div>
    </div>
  );
}
