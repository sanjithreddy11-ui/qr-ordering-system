"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput, TextArea, Select, Modal, adminColors } from "@/components/admin/ui";
import {
  fetchInvestmentAssets,
  createInvestmentAsset,
  updateInvestmentAsset,
  deleteInvestmentAsset,
  uploadInvestmentInvoice,
  fetchInvestmentVendors,
  InvestmentAsset,
  InvestmentVendor,
} from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  name: "",
  category: "Equipment",
  purchaseDate: new Date().toISOString().slice(0, 10),
  purchaseCost: "",
  vendorId: "",
  warranty: "",
  expectedLifeYears: "",
  currentValue: "",
  notes: "",
};

export default function AssetsTab({ restaurantId }: { restaurantId: string }) {
  const [assets, setAssets] = useState<InvestmentAsset[]>([]);
  const [vendors, setVendors] = useState<InvestmentVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InvestmentAsset | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchInvestmentAssets(restaurantId, { search: search || undefined })
      .then(setAssets)
      .catch(() => setAssets([]))
      .finally(() => setLoading(false));
  }, [restaurantId, search]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetchInvestmentVendors(restaurantId).then(setVendors).catch(() => setVendors([]));
  }, [restaurantId]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setInvoiceFile(null);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (a: InvestmentAsset) => {
    setEditing(a);
    setForm({
      name: a.name,
      category: a.category,
      purchaseDate: a.purchaseDate.slice(0, 10),
      purchaseCost: String(a.purchaseCost),
      vendorId: a.vendorId || "",
      warranty: a.warranty,
      expectedLifeYears: String(a.expectedLifeYears || ""),
      currentValue: String(a.currentValue || ""),
      notes: a.notes,
    });
    setInvoiceFile(null);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.purchaseCost) {
      setError("Asset name and purchase cost are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let invoiceUrl = editing?.invoiceUrl || "";
      if (invoiceFile) invoiceUrl = await uploadInvestmentInvoice(invoiceFile);

      const payload = {
        restaurantId,
        name: form.name,
        category: form.category,
        purchaseDate: form.purchaseDate,
        purchaseCost: Number(form.purchaseCost),
        vendorId: form.vendorId || undefined,
        warranty: form.warranty,
        expectedLifeYears: Number(form.expectedLifeYears) || 0,
        currentValue: form.currentValue ? Number(form.currentValue) : Number(form.purchaseCost),
        notes: form.notes,
        invoiceUrl,
      };

      if (editing) await updateInvestmentAsset(restaurantId, editing.id, payload);
      else await createInvestmentAsset(payload);

      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the asset");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (a: InvestmentAsset) => {
    if (!confirm(`Delete asset "${a.name}"?`)) return;
    await deleteInvestmentAsset(restaurantId, a.id);
    load();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ position: "relative", minWidth: 220 }}>
          <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: adminColors.textSecondary }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search assets…"
            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13, outline: "none" }}
          />
        </div>
        <PrimaryButton onClick={openAdd}>
          <Plus size={16} /> Add Asset
        </PrimaryButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
        {loading && <p style={{ fontFamily: bodyFont, color: adminColors.textSecondary }}>Loading…</p>}
        {!loading && assets.length === 0 && <p style={{ fontFamily: bodyFont, color: adminColors.textSecondary }}>No assets recorded yet.</p>}
        {assets.map((a) => (
          <Card key={a.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: adminColors.text }}>{a.name}</div>
                <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>{a.category}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(a)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                  <Pencil size={14} color={adminColors.textSecondary} />
                </button>
                <button onClick={() => handleDelete(a)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                  <Trash2 size={14} color={adminColors.danger} />
                </button>
              </div>
            </div>
            <div style={{ marginTop: 10, fontFamily: bodyFont, fontSize: 13, color: adminColors.text, display: "grid", gap: 4 }}>
              <div>Purchased: {a.purchaseDate.slice(0, 10)}</div>
              <div>Cost: {formatRupees(a.purchaseCost)}</div>
              <div>Current Value: {formatRupees(a.currentValue)}</div>
              {a.warranty && <div>Warranty: {a.warranty}</div>}
              {a.vendorName && <div>Supplier: {a.vendorName}</div>}
            </div>
          </Card>
        ))}
      </div>

      {showModal && (
        <Modal title={editing ? "Edit Asset" : "Add Asset"} onClose={() => setShowModal(false)} maxWidth={560}>
          {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TextInput label="Asset Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} placeholder="Coffee Machine, Grinder…" />
            <TextInput label="Category" value={form.category} onChange={(v) => setForm({ ...form, category: v })} />
            <TextInput label="Purchase Date" type="date" value={form.purchaseDate} onChange={(v) => setForm({ ...form, purchaseDate: v })} />
            <TextInput label="Purchase Cost" type="number" value={form.purchaseCost} onChange={(v) => setForm({ ...form, purchaseCost: v })} />
            <Select
              label="Supplier"
              value={form.vendorId}
              onChange={(v) => setForm({ ...form, vendorId: v })}
              options={[{ value: "", label: "— No supplier —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
            />
            <TextInput label="Warranty" value={form.warranty} onChange={(v) => setForm({ ...form, warranty: v })} placeholder="e.g. 2 years" />
            <TextInput label="Expected Life (years)" type="number" value={form.expectedLifeYears} onChange={(v) => setForm({ ...form, expectedLifeYears: v })} />
            <TextInput label="Current Value" type="number" value={form.currentValue} onChange={(v) => setForm({ ...form, currentValue: v })} placeholder="Defaults to purchase cost" />
          </div>
          <TextArea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />

          <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <span style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>
              Invoice Upload (PDF/PNG/JPEG)
            </span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)} />
            {editing?.invoiceUrl && !invoiceFile && (
              <a href={editing.invoiceUrl} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: adminColors.primary }}>
                View current invoice
              </a>
            )}
          </label>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Asset"}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
