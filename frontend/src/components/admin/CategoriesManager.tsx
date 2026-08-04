"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Card,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  Modal,
  Badge,
  adminColors,
} from "@/components/admin/ui";
import {
  fetchAdminCategories,
  createAdminCategory,
  updateAdminCategory,
  deleteAdminCategory,
  AdminCategory,
} from "@/lib/admin-api";

const emptyForm = { categoryId: "", title: "", sortOrder: "0" };

// Reusable category CRUD block — embedded as the "Categories" tab on the
// Menu page (see app/(admin)/dashboard/menu/page.tsx). Extracted into its
// own component so it isn't duplicated if another page ever needs it.
export default function CategoriesManager({
  restaurantId,
  onChange,
}: {
  restaurantId: string;
  onChange?: () => void; // called after any create/update/delete, so the parent (e.g. Menu Items tab) can refresh its category list
}) {
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminCategory | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminCategories(restaurantId)
      .then(setCategories)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (category: AdminCategory) => {
    setEditing(category);
    setForm({
      categoryId: category.categoryId,
      title: category.title,
      sortOrder: String(category.sortOrder),
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const categoryId = form.categoryId.trim();
      const title = form.title.trim();
      const sortOrder = Number(form.sortOrder) || 0;

      if (!categoryId || !title) {
        throw new Error("Category ID and title are required");
      }

      if (editing) {
        await updateAdminCategory(restaurantId, editing.categoryId, { title, sortOrder });
      } else {
        await createAdminCategory({ restaurantId, categoryId, title, sortOrder });
      }
      setShowForm(false);
      load();
      onChange?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (category: AdminCategory) => {
    if (!confirm(`Delete "${category.title}"? This can't be undone.`)) return;
    try {
      await deleteAdminCategory(restaurantId, category.categoryId);
      load();
      onChange?.();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Couldn't delete this category");
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <PrimaryButton onClick={openCreate}>
          <Plus size={15} /> Add Category
        </PrimaryButton>
      </div>

      {loading && (
        <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
          Loading…
        </p>
      )}

      {!loading && categories.length === 0 && (
        <Card>
          <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No categories yet. Add your first one.
          </p>
        </Card>
      )}

      {categories.length > 0 && (
        <Card style={{ padding: 0 }}>
          {categories.map((category, idx) => (
            <div
              key={category.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "14px 16px",
                borderBottom: idx < categories.length - 1 ? `1px solid ${adminColors.border}` : "none",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span
                    style={{
                      fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                      fontSize: 14,
                      fontWeight: 700,
                      color: adminColors.text,
                    }}
                  >
                    {category.title}
                  </span>
                  <Badge color={adminColors.textSecondary}>{category.itemCount} items</Badge>
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 12,
                    color: adminColors.textSecondary,
                    marginTop: 2,
                  }}
                >
                  ID: {category.categoryId} · Order: {category.sortOrder}
                </div>
              </div>

              <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                <SecondaryButton onClick={() => openEdit(category)}>
                  <Pencil size={13} />
                </SecondaryButton>
                <SecondaryButton danger onClick={() => handleDelete(category)}>
                  <Trash2 size={13} />
                </SecondaryButton>
              </div>
            </div>
          ))}
        </Card>
      )}

      {showForm && (
        <Modal title={editing ? "Edit Category" : "Add Category"} onClose={() => setShowForm(false)}>
          <TextInput
            label="Category ID (unique, no spaces)"
            value={form.categoryId}
            onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            placeholder="e.g. desserts"
          />
          {editing && (
            <p style={{ fontSize: 11, color: adminColors.textSecondary, margin: "-8px 0 0" }}>
              Category ID can&apos;t be changed after creation.
            </p>
          )}
          <TextInput
            label="Display Name"
            value={form.title}
            onChange={(v) => setForm((f) => ({ ...f, title: v }))}
            placeholder="e.g. Desserts"
          />
          <TextInput
            label="Sort Order (0 = first)"
            type="number"
            value={form.sortOrder}
            onChange={(v) => setForm((f) => ({ ...f, sortOrder: v }))}
          />

          {error && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Category"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
