"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Power } from "lucide-react";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  Select,
  Badge,
  Modal,
  adminColors,
} from "@/components/admin/ui";
import {
  fetchAdminStaff,
  createAdminStaff,
  updateAdminStaff,
  deleteAdminStaff,
  AdminStaff,
} from "@/lib/admin-api";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants

const ROLE_COLOR: Record<string, string> = {
  admin: adminColors.primary,
  kitchen: adminColors.warning,
  waiter: adminColors.textSecondary,
};

const emptyForm = { name: "", role: "waiter", email: "", phone: "", password: "" };

export default function AdminStaffPage() {
  const [staff, setStaff] = useState<AdminStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminStaff(RESTAURANT_ID)
      .then(setStaff)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const handleCreate = async () => {
    setSaving(true);
    setError(null);
    try {
      if (!form.name || !form.email || !form.password) {
        throw new Error("Name, email, and password are required");
      }
      await createAdminStaff({
        restaurantId: RESTAURANT_ID,
        name: form.name.trim(),
        role: form.role,
        email: form.email.trim(),
        phone: form.phone.trim(),
        password: form.password,
      });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (member: AdminStaff) => {
    await updateAdminStaff(member.id, { isActive: !member.isActive });
    load();
  };

  const handleDelete = async (member: AdminStaff) => {
    if (!confirm(`Remove "${member.name}"?`)) return;
    await deleteAdminStaff(member.id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Staff"
        description="Manage team member records. Note: this does not yet control who can log in anywhere — no login system is wired up."
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus size={15} /> Add Staff
          </PrimaryButton>
        }
      />

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && staff.length === 0 && (
        <Card>
          <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No staff members yet.
          </p>
        </Card>
      )}

      {staff.length > 0 && (
        <Card style={{ padding: 0 }}>
          {staff.map((member, idx) => (
            <div
              key={member.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderBottom: idx < staff.length - 1 ? `1px solid ${adminColors.border}` : "none",
                opacity: member.isActive ? 1 : 0.5,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 14, fontWeight: 700, color: adminColors.text }}>
                    {member.name}
                  </span>
                  <Badge color={ROLE_COLOR[member.role] ?? adminColors.textSecondary}>{member.role}</Badge>
                  {!member.isActive && <Badge color={adminColors.textSecondary}>Inactive</Badge>}
                </div>
                <div style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
                  {member.email} {member.phone && `· ${member.phone}`}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <SecondaryButton onClick={() => handleToggleActive(member)}>
                  <Power size={13} />
                </SecondaryButton>
                <SecondaryButton danger onClick={() => handleDelete(member)}>
                  <Trash2 size={13} />
                </SecondaryButton>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm && (
        <Modal title="Add Staff Member" onClose={() => setShowForm(false)}>
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <Select
            label="Role"
            value={form.role}
            onChange={(v) => setForm((f) => ({ ...f, role: v }))}
            options={[
              { value: "admin", label: "Admin" },
              { value: "kitchen", label: "Kitchen" },
              { value: "waiter", label: "Waiter" },
            ]}
          />
          <TextInput label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <TextInput label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <TextInput
            label="Password (min. 6 characters)"
            type="password"
            value={form.password}
            onChange={(v) => setForm((f) => ({ ...f, password: v }))}
          />
          <p style={{ fontSize: 11, color: adminColors.textSecondary, margin: 0 }}>
            This password is stored securely, but nothing currently checks it at login — there's no login page yet.
          </p>

          {error && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <PrimaryButton onClick={handleCreate} disabled={saving}>
              {saving ? "Adding…" : "Add Staff"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
