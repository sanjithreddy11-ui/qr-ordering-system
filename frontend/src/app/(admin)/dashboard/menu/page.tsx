"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, EyeOff, Eye } from "lucide-react";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  TextArea,
  Select,
  Badge,
  Modal,
  adminColors,
} from "@/components/admin/ui";
import {
  fetchAdminMenuItems,
  createAdminMenuItem,
  updateAdminMenuItem,
  deleteAdminMenuItem,
  AdminMenuItem,
} from "@/lib/admin-api";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants

const emptyForm = {
  id: "",
  categoryId: "",
  categoryTitle: "",
  categorySortOrder: "0",
  name: "",
  description: "",
  price: "",
  diet: "veg" as "veg" | "non-veg",
  image: "",
  sortOrder: "0",
};

export default function AdminMenuPage() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminMenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminMenuItems(RESTAURANT_ID)
      .then(setItems)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowForm(true);
  };

  const openEdit = (item: AdminMenuItem) => {
    setEditing(item);
    setForm({
      id: item.id,
      categoryId: item.categoryId,
      categoryTitle: item.categoryTitle,
      categorySortOrder: String(item.categorySortOrder),
      name: item.name,
      description: item.description,
      price: String(item.price),
      diet: item.diet,
      image: item.image,
      sortOrder: String(item.sortOrder),
    });
    setError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        restaurantId: RESTAURANT_ID,
        id: form.id.trim(),
        categoryId: form.categoryId.trim(),
        categoryTitle: form.categoryTitle.trim(),
        categorySortOrder: Number(form.categorySortOrder) || 0,
        name: form.name.trim(),
        description: form.description.trim(),
        price: Number(form.price),
        diet: form.diet,
        image: form.image.trim(),
        sortOrder: Number(form.sortOrder) || 0,
      };

      if (!payload.id || !payload.categoryId || !payload.categoryTitle || !payload.name || !payload.price) {
        throw new Error("Item ID, category, name, and price are required");
      }

      if (editing) {
        await updateAdminMenuItem(RESTAURANT_ID, editing.id, payload);
      } else {
        await createAdminMenuItem(payload);
      }
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAvailability = async (item: AdminMenuItem) => {
    await updateAdminMenuItem(RESTAURANT_ID, item.id, { isAvailable: !item.isAvailable });
    load();
  };

  const handleDelete = async (item: AdminMenuItem) => {
    if (!confirm(`Delete "${item.name}"? This can't be undone.`)) return;
    await deleteAdminMenuItem(RESTAURANT_ID, item.id);
    load();
  };

  // Group by category for display, respecting categorySortOrder (already
  // sorted server-side, but grouping here for the section headers).
  const grouped = items.reduce<Record<string, AdminMenuItem[]>>((acc, item) => {
    acc[item.categoryTitle] = acc[item.categoryTitle] ?? [];
    acc[item.categoryTitle].push(item);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Add, edit, or hide items from the live customer menu"
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus size={15} /> Add Item
          </PrimaryButton>
        }
      />

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <Card>
          <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No menu items yet. Add your first one.
          </p>
        </Card>
      )}

      {Object.entries(grouped).map(([categoryTitle, categoryItems]) => (
        <div key={categoryTitle} style={{ marginBottom: 24 }}>
          <div
            style={{
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              fontWeight: 700,
              color: adminColors.text,
              marginBottom: 10,
            }}
          >
            {categoryTitle}
          </div>
          <Card style={{ padding: 0 }}>
            {categoryItems.map((item, idx) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 14,
                  padding: "14px 16px",
                  borderBottom: idx < categoryItems.length - 1 ? `1px solid ${adminColors.border}` : "none",
                  opacity: item.isAvailable ? 1 : 0.5,
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
                      {item.name}
                    </span>
                    <Badge color={item.diet === "veg" ? adminColors.success : adminColors.danger}>
                      {item.diet}
                    </Badge>
                    {!item.isAvailable && <Badge color={adminColors.textSecondary}>Hidden</Badge>}
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                      fontSize: 12,
                      color: adminColors.textSecondary,
                      marginTop: 2,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.description}
                  </div>
                </div>

                <div
                  style={{
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: adminColors.text,
                    flexShrink: 0,
                  }}
                >
                  ₹ {item.price}
                </div>

                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  <SecondaryButton onClick={() => handleToggleAvailability(item)}>
                    {item.isAvailable ? <EyeOff size={13} /> : <Eye size={13} />}
                  </SecondaryButton>
                  <SecondaryButton onClick={() => openEdit(item)}>
                    <Pencil size={13} />
                  </SecondaryButton>
                  <SecondaryButton danger onClick={() => handleDelete(item)}>
                    <Trash2 size={13} />
                  </SecondaryButton>
                </div>
              </div>
            ))}
          </Card>
        </div>
      ))}

      {showForm && (
        <Modal title={editing ? "Edit Item" : "Add Item"} onClose={() => setShowForm(false)}>
          <TextInput
            label="Item ID (unique, no spaces)"
            value={form.id}
            onChange={(v) => setForm((f) => ({ ...f, id: v }))}
            placeholder="e.g. chicken-popcorn"
          />
          {editing && (
            <p style={{ fontSize: 11, color: adminColors.textSecondary, margin: "-8px 0 0" }}>
              Item ID can't be changed after creation.
            </p>
          )}
          <TextInput label="Name" value={form.name} onChange={(v) => setForm((f) => ({ ...f, name: v }))} />
          <TextArea
            label="Description"
            value={form.description}
            onChange={(v) => setForm((f) => ({ ...f, description: v }))}
          />
          <TextInput
            label="Price (₹)"
            type="number"
            value={form.price}
            onChange={(v) => setForm((f) => ({ ...f, price: v }))}
          />
          <Select
            label="Diet"
            value={form.diet}
            onChange={(v) => setForm((f) => ({ ...f, diet: v as "veg" | "non-veg" }))}
            options={[
              { value: "veg", label: "Veg" },
              { value: "non-veg", label: "Non-Veg" },
            ]}
          />
          <TextInput
            label="Category ID"
            value={form.categoryId}
            onChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}
            placeholder="e.g. starters"
          />
          <TextInput
            label="Category Display Name"
            value={form.categoryTitle}
            onChange={(v) => setForm((f) => ({ ...f, categoryTitle: v }))}
            placeholder="e.g. Starters"
          />
          <TextInput
            label="Category Order (0 = first)"
            type="number"
            value={form.categorySortOrder}
            onChange={(v) => setForm((f) => ({ ...f, categorySortOrder: v }))}
          />
          <TextInput
            label="Image path"
            value={form.image}
            onChange={(v) => setForm((f) => ({ ...f, image: v }))}
            placeholder="/fooditems/example.png"
          />

          {error && (
            <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Item"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
