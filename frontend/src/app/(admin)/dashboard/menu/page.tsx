"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, EyeOff, Eye, Search, Upload, Loader2 } from "lucide-react";
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
  uploadAdminImage,
  fetchAdminCategories,
  AdminMenuItem,
  AdminCategory,
} from "@/lib/admin-api";
import CategoriesManager from "@/components/admin/CategoriesManager";
import { API_BASE_URL } from "@/lib/config";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants
const PAGE_SIZE = 12;

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
  prepTimeMinutes: "10",
};

function resolveImageSrc(image: string) {
  if (!image) return "";
  if (image.startsWith("http") || image.startsWith("/uploads")) {
    return image.startsWith("/uploads") ? `${API_BASE_URL}${image}` : image;
  }
  return image; // static paths like /fooditems/example.png, served by the frontend itself
}

export default function AdminMenuPage() {
  const [items, setItems] = useState<AdminMenuItem[]>([]);
  const [categories, setCategories] = useState<AdminCategory[]>([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<AdminMenuItem | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"items" | "categories">("items");

  // Filters
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [dietFilter, setDietFilter] = useState<"" | "veg" | "non-veg">("");
  const [availabilityFilter, setAvailabilityFilter] = useState<"" | "available" | "out-of-stock">("");
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminMenuItems(RESTAURANT_ID, {
      search: search || undefined,
      categoryId: categoryFilter || undefined,
      diet: dietFilter || undefined,
      availability: availabilityFilter || undefined,
      page,
      limit: PAGE_SIZE,
    })
      .then((data) => {
        setItems(data.items);
        setPagination({ page: data.pagination.page, totalPages: data.pagination.totalPages, total: data.pagination.total });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [search, categoryFilter, dietFilter, availabilityFilter, page]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCategories = useCallback(() => {
    fetchAdminCategories(RESTAURANT_ID).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Reset to page 1 whenever a filter changes
  useEffect(() => {
    setPage(1);
  }, [search, categoryFilter, dietFilter, availabilityFilter]);

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
      prepTimeMinutes: String(item.prepTimeMinutes ?? 10),
    });
    setError(null);
    setShowForm(true);
  };

  const handleUploadImage = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const url = await uploadAdminImage(file);
      setForm((f) => ({ ...f, image: url }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Image upload failed");
    } finally {
      setUploading(false);
    }
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
        prepTimeMinutes: Number(form.prepTimeMinutes) || 10,
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

  const textFieldStyle: React.CSSProperties = {
    padding: "9px 12px",
    borderRadius: 8,
    border: `1px solid ${adminColors.border}`,
    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
    fontSize: 13,
    color: adminColors.text,
    outline: "none",
    background: "#fff",
  };

  return (
    <div>
      <PageHeader
        title="Menu"
        description="Manage items, categories, pricing, and availability for the live customer menu"
        action={
          activeTab === "items" ? (
            <PrimaryButton onClick={openCreate}>
              <Plus size={15} /> Add Item
            </PrimaryButton>
          ) : undefined
        }
      />

      {/* ---- Tabs ---- */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: `1px solid ${adminColors.border}` }}>
        {(
          [
            { key: "items", label: "Menu Items" },
            { key: "categories", label: "Categories" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              padding: "10px 16px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              fontSize: 13,
              fontWeight: 700,
              color: activeTab === tab.key ? adminColors.primary : adminColors.textSecondary,
              borderBottom: `2px solid ${activeTab === tab.key ? adminColors.primary : "transparent"}`,
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "categories" && (
        <CategoriesManager restaurantId={RESTAURANT_ID} onChange={loadCategories} />
      )}

      {activeTab === "items" && (
        <>
      {/* ---- Search & Filters ---- */}
      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: adminColors.textSecondary }} />
            <input
              placeholder="Search menu items…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...textFieldStyle, width: "100%", paddingLeft: 30, boxSizing: "border-box" }}
            />
          </div>

          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} style={textFieldStyle}>
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.categoryId} value={c.categoryId}>
                {c.title}
              </option>
            ))}
          </select>

          <select value={dietFilter} onChange={(e) => setDietFilter(e.target.value as "" | "veg" | "non-veg")} style={textFieldStyle}>
            <option value="">Veg &amp; Non-Veg</option>
            <option value="veg">Veg only</option>
            <option value="non-veg">Non-Veg only</option>
          </select>

          <select
            value={availabilityFilter}
            onChange={(e) => setAvailabilityFilter(e.target.value as "" | "available" | "out-of-stock")}
            style={textFieldStyle}
          >
            <option value="">Available &amp; Out of Stock</option>
            <option value="available">Available only</option>
            <option value="out-of-stock">Out of Stock only</option>
          </select>
        </div>
      </Card>

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && items.length === 0 && (
        <Card>
          <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No menu items match these filters.
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
                {item.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={resolveImageSrc(item.image)}
                    alt={item.name}
                    style={{ width: 44, height: 44, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: adminColors.bg }}
                  />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 10, background: adminColors.bg, flexShrink: 0 }} />
                )}

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
                    {item.description} {item.prepTimeMinutes ? `· ${item.prepTimeMinutes} min prep` : ""}
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

      {/* ---- Pagination ---- */}
      {!loading && pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 8 }}>
          <SecondaryButton onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</SecondaryButton>
          <span style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>
            Page {pagination.page} of {pagination.totalPages} ({pagination.total} items)
          </span>
          <SecondaryButton onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}>Next</SecondaryButton>
        </div>
      )}
        </>
      )}

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
              Item ID can&apos;t be changed after creation.
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
          <TextInput
            label="Preparation Time (minutes)"
            type="number"
            value={form.prepTimeMinutes}
            onChange={(v) => setForm((f) => ({ ...f, prepTimeMinutes: v }))}
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

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span
              style={{
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                fontSize: 12,
                fontWeight: 700,
                color: adminColors.textSecondary,
                textTransform: "uppercase",
                letterSpacing: "0.04em",
              }}
            >
              Image
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {form.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={resolveImageSrc(form.image)}
                  alt="Preview"
                  style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", background: adminColors.bg }}
                />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 8, background: adminColors.bg }} />
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUploadImage(file);
                }}
              />
              <SecondaryButton onClick={() => fileInputRef.current?.click()}>
                {uploading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                {uploading ? "Uploading…" : "Upload Image"}
              </SecondaryButton>
            </div>
          </label>

          {error && (
            <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <PrimaryButton onClick={handleSave} disabled={saving || uploading}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Add Item"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
