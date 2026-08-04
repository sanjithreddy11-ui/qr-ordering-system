"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Phone, Mail, MapPin } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput, TextArea, Badge, Modal, adminColors } from "@/components/admin/ui";
import {
  fetchInvestmentVendors,
  fetchInvestmentVendorDetail,
  createInvestmentVendor,
  updateInvestmentVendor,
  deleteInvestmentVendor,
  InvestmentVendor,
  InvestmentPurchase,
  InvestmentExpense,
} from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const emptyForm = { name: "", gstNumber: "", phone: "", email: "", address: "", categories: "", notes: "" };

export default function VendorsTab({ restaurantId }: { restaurantId: string }) {
  const [vendors, setVendors] = useState<InvestmentVendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InvestmentVendor | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [detailVendor, setDetailVendor] = useState<InvestmentVendor | null>(null);
  const [detailPurchases, setDetailPurchases] = useState<InvestmentPurchase[]>([]);
  const [detailExpenses, setDetailExpenses] = useState<InvestmentExpense[]>([]);

  const load = useCallback(() => {
    setLoading(true);
    fetchInvestmentVendors(restaurantId, search || undefined)
      .then(setVendors)
      .catch(() => setVendors([]))
      .finally(() => setLoading(false));
  }, [restaurantId, search]);

  useEffect(() => {
    load();
  }, [load]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (v: InvestmentVendor) => {
    setEditing(v);
    setForm({
      name: v.name,
      gstNumber: v.gstNumber,
      phone: v.phone,
      email: v.email,
      address: v.address,
      categories: v.categories.join(", "),
      notes: v.notes,
    });
    setError(null);
    setShowModal(true);
  };

  const openDetail = async (v: InvestmentVendor) => {
    setDetailVendor(v);
    const res = await fetchInvestmentVendorDetail(restaurantId, v.id).catch(() => null);
    if (res) {
      setDetailVendor(res.vendor);
      setDetailPurchases(res.purchases);
      setDetailExpenses(res.expenses);
    }
  };

  const handleSave = async () => {
    if (!form.name) {
      setError("Vendor name is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        restaurantId,
        name: form.name,
        gstNumber: form.gstNumber,
        phone: form.phone,
        email: form.email,
        address: form.address,
        categories: form.categories
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean),
        notes: form.notes,
      };
      if (editing) await updateInvestmentVendor(restaurantId, editing.id, payload);
      else await createInvestmentVendor(payload);

      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the vendor");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (v: InvestmentVendor) => {
    if (!confirm(`Delete vendor "${v.name}"?`)) return;
    await deleteInvestmentVendor(restaurantId, v.id);
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
            placeholder="Search vendors…"
            style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13, outline: "none" }}
          />
        </div>
        <PrimaryButton onClick={openAdd}>
          <Plus size={16} /> Add Vendor
        </PrimaryButton>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        {loading && <p style={{ fontFamily: bodyFont, color: adminColors.textSecondary }}>Loading…</p>}
        {!loading && vendors.length === 0 && <p style={{ fontFamily: bodyFont, color: adminColors.textSecondary }}>No vendors added yet.</p>}
        {vendors.map((v) => (
          <Card key={v.id}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ cursor: "pointer" }} onClick={() => openDetail(v)}>
                <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, color: adminColors.text }}>{v.name}</div>
                {v.gstNumber && <div style={{ fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>GSTIN: {v.gstNumber}</div>}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => openEdit(v)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                  <Pencil size={14} color={adminColors.textSecondary} />
                </button>
                <button onClick={() => handleDelete(v)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                  <Trash2 size={14} color={adminColors.danger} />
                </button>
              </div>
            </div>
            <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 4, fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
              {v.phone && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Phone size={12} /> {v.phone}</span>}
              {v.email && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><Mail size={12} /> {v.email}</span>}
              {v.address && <span style={{ display: "flex", alignItems: "center", gap: 6 }}><MapPin size={12} /> {v.address}</span>}
            </div>
            {v.categories.length > 0 && (
              <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 6 }}>
                {v.categories.map((c) => (
                  <Badge key={c} color={adminColors.primary}>
                    {c}
                  </Badge>
                ))}
              </div>
            )}
            <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 13 }}>
              <span>Purchased: {formatRupees(v.totalPurchased ?? 0)}</span>
              <span style={{ color: (v.outstandingBalance ?? 0) > 0 ? adminColors.danger : adminColors.success, fontWeight: 700 }}>
                Outstanding: {formatRupees(v.outstandingBalance ?? 0)}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {showModal && (
        <Modal title={editing ? "Edit Vendor" : "Add Vendor"} onClose={() => setShowModal(false)} maxWidth={520}>
          {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13 }}>{error}</p>}
          <TextInput label="Vendor Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TextInput label="GST Number" value={form.gstNumber} onChange={(v) => setForm({ ...form, gstNumber: v })} />
            <TextInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
            <TextInput label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
            <TextInput label="Categories (comma-separated)" value={form.categories} onChange={(v) => setForm({ ...form, categories: v })} placeholder="Raw Materials, Packaging" />
          </div>
          <TextArea label="Address" value={form.address} onChange={(v) => setForm({ ...form, address: v })} />
          <TextArea label="Notes" value={form.notes} onChange={(v) => setForm({ ...form, notes: v })} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Vendor"}
            </PrimaryButton>
          </div>
        </Modal>
      )}

      {detailVendor && (
        <Modal title={`${detailVendor.name} — History`} onClose={() => setDetailVendor(null)} maxWidth={680}>
          <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Purchases</div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {detailPurchases.length === 0 && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No purchases yet.</p>}
            {detailPurchases.map((p) => (
              <div key={p.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13 }}>
                <span>
                  {p.purchaseDate.slice(0, 10)} — {p.productName}
                </span>
                <span style={{ fontWeight: 700 }}>{formatRupees(p.grandTotal)}</span>
              </div>
            ))}
          </div>

          <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, marginTop: 12, marginBottom: 4 }}>Expenses</div>
          <div style={{ maxHeight: 200, overflowY: "auto" }}>
            {detailExpenses.length === 0 && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No expenses yet.</p>}
            {detailExpenses.map((e) => (
              <div key={e.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13 }}>
                <span>
                  {e.date.slice(0, 10)} — {e.description || e.category}
                </span>
                <span style={{ fontWeight: 700 }}>{formatRupees(e.amount)}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, fontFamily: bodyFont, fontSize: 14, fontWeight: 800 }}>
            <span>Outstanding Balance</span>
            <span>{formatRupees(detailVendor.outstandingBalance ?? 0)}</span>
          </div>
        </Modal>
      )}
    </div>
  );
}
