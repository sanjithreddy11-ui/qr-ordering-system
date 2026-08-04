"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput, TextArea, Modal, adminColors } from "@/components/admin/ui";
import { fetchSuppliers, createSupplier, updateSupplier, deleteSupplier, Supplier } from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";
const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

// Supplier CRUD block — embedded as the "Suppliers" tab on the Stock
// Management page (see app/(admin)/dashboard/stock/page.tsx). Mirrors
// CategoriesManager's shape so it's a familiar pattern within this codebase.
export default function SuppliersManager({ restaurantId }: { restaurantId: string }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchSuppliers(restaurantId)
      .then(setSuppliers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    queueMicrotask(load);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (supplier: Supplier) => {
    setEditing(supplier);
    setForm({
      name: supplier.name,
      phone: supplier.phone,
      email: supplier.email,
      address: supplier.address,
      notes: supplier.notes,
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const name = form.name.trim();
      if (!name) throw new Error("Supplier name is required");

      const payload = {
        name,
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        notes: form.notes.trim(),
      };

      if (editing) {
        await updateSupplier(restaurantId, editing.id, payload);
      } else {
        await createSupplier({ restaurantId, ...payload });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (supplier: Supplier) => {
    if (!confirm(`Delete "${supplier.name}"? This can't be undone.`)) return;
    try {
      await deleteSupplier(restaurantId, supplier.id);
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete this supplier");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <PrimaryButton onClick={openCreate}>
          <Plus size={15} /> Add Supplier
        </PrimaryButton>
      </div>

      {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && suppliers.length === 0 && (
        <Card>
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No suppliers yet. Add your first one.
          </p>
        </Card>
      )}

      {suppliers.length > 0 && (
        <Card style={{ padding: 0 }}>
          {suppliers.map((supplier, idx) => (
            <div
              key={supplier.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderBottom: idx < suppliers.length - 1 ? `1px solid ${adminColors.border}` : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 700, color: adminColors.text }}>
                  {supplier.name}
                </div>
                <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary, marginTop: 2 }}>
                  {[supplier.phone, supplier.email, supplier.address].filter(Boolean).join(" · ") || "No contact details"}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <SecondaryButton onClick={() => openEdit(supplier)}>
                  <Pencil size={13} />
                </SecondaryButton>
                <SecondaryButton danger onClick={() => handleDelete(supplier)}>
                  <Trash2 size={13} />
                </SecondaryButton>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm && (
        <Modal title={editing ? "Edit Supplier" : "Add Supplier"} onClose={() => setShowForm(false)}>
          <TextInput label="Supplier Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <TextInput label="Phone" value={form.phone} onChange={(v) => setForm((f) => ({ ...f, phone: v }))} />
          <TextInput label="Email" type="email" value={form.email} onChange={(v) => setForm((f) => ({ ...f, email: v }))} />
          <TextInput label="Address" value={form.address} onChange={(v) => setForm((f) => ({ ...f, address: v }))} />
          <TextArea label="Notes" value={form.notes} onChange={(v) => setForm((f) => ({ ...f, notes: v }))} />

          {error && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Supplier"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
