"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2, Paperclip } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput, TextArea, Select, Badge, Modal, adminColors } from "@/components/admin/ui";
import {
  fetchInvestmentPurchases,
  createInvestmentPurchase,
  updateInvestmentPurchase,
  deleteInvestmentPurchase,
  uploadInvestmentInvoice,
  fetchInvestmentVendors,
  fetchExpenseCategories,
  InvestmentPurchase,
  InvestmentVendor,
} from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "cheque", "pending"];
const PAYMENT_STATUSES = ["paid", "pending", "partially_paid"];

const STATUS_COLOR: Record<string, string> = {
  paid: adminColors.success,
  pending: adminColors.warning,
  partially_paid: adminColors.warning,
};

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  purchaseDate: new Date().toISOString().slice(0, 10),
  invoiceNumber: "",
  invoiceDate: "",
  vendorId: "",
  category: "",
  productName: "",
  quantity: "1",
  unit: "pcs",
  rate: "",
  discount: "0",
  gstPercentage: "5",
  gstType: "intra_state" as "intra_state" | "inter_state",
  paymentMethod: "cash",
  paymentStatus: "paid",
  notes: "",
};

export default function PurchasesTab({ restaurantId }: { restaurantId: string }) {
  const [purchases, setPurchases] = useState<InvestmentPurchase[]>([]);
  const [vendors, setVendors] = useState<InvestmentVendor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InvestmentPurchase | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPurchases = useCallback(() => {
    setLoading(true);
    fetchInvestmentPurchases(restaurantId, {
      search: search || undefined,
      category: categoryFilter || undefined,
      paymentStatus: statusFilter || undefined,
      limit: 100,
    })
      .then((res) => setPurchases(res.purchases))
      .catch(() => setPurchases([]))
      .finally(() => setLoading(false));
  }, [restaurantId, search, categoryFilter, statusFilter]);

  useEffect(() => {
    loadPurchases();
  }, [loadPurchases]);

  useEffect(() => {
    fetchInvestmentVendors(restaurantId).then(setVendors).catch(() => setVendors([]));
    fetchExpenseCategories(restaurantId).then(setCategories).catch(() => setCategories([]));
  }, [restaurantId]);

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm);
    setInvoiceFile(null);
    setError(null);
    setShowModal(true);
  };

  const openEdit = (p: InvestmentPurchase) => {
    setEditing(p);
    setForm({
      purchaseDate: p.purchaseDate.slice(0, 10),
      invoiceNumber: p.invoiceNumber,
      invoiceDate: p.invoiceDate ? p.invoiceDate.slice(0, 10) : "",
      vendorId: p.vendorId || "",
      category: p.category,
      productName: p.productName,
      quantity: String(p.quantity),
      unit: p.unit,
      rate: String(p.rate),
      discount: String(p.discount),
      gstPercentage: String(p.gstPercentage),
      gstType: p.gstType,
      paymentMethod: p.paymentMethod,
      paymentStatus: p.paymentStatus,
      notes: p.notes,
    });
    setInvoiceFile(null);
    setError(null);
    setShowModal(true);
  };

  // Live calculation preview shown in the modal.
  const qty = Number(form.quantity) || 0;
  const rate = Number(form.rate) || 0;
  const discount = Number(form.discount) || 0;
  const gstPct = Number(form.gstPercentage) || 0;
  const subtotal = Math.max(0, qty * rate - discount);
  const gstAmount = Math.round(((subtotal * gstPct) / 100) * 100) / 100;
  const grandTotal = Math.round((subtotal + gstAmount) * 100) / 100;

  const handleSave = async () => {
    if (!form.category || !form.productName || !form.rate) {
      setError("Category, product name, and rate are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let invoiceUrl = editing?.invoiceUrl || "";
      if (invoiceFile) {
        invoiceUrl = await uploadInvestmentInvoice(invoiceFile);
      }

      const payload = {
        restaurantId,
        purchaseDate: form.purchaseDate,
        invoiceNumber: form.invoiceNumber,
        invoiceDate: form.invoiceDate || undefined,
        vendorId: form.vendorId || undefined,
        category: form.category,
        productName: form.productName,
        quantity: qty,
        unit: form.unit,
        rate,
        discount,
        gstPercentage: gstPct,
        gstType: form.gstType,
        paymentMethod: form.paymentMethod as any,
        paymentStatus: form.paymentStatus as any,
        notes: form.notes,
        invoiceUrl,
      };

      if (editing) {
        await updateInvestmentPurchase(restaurantId, editing.id, payload);
      } else {
        await createInvestmentPurchase(payload);
      }
      setShowModal(false);
      loadPurchases();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the purchase");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (p: InvestmentPurchase) => {
    if (!confirm(`Delete purchase "${p.productName}"?`)) return;
    await deleteInvestmentPurchase(restaurantId, p.id);
    loadPurchases();
  };

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", flex: 1 }}>
          <div style={{ position: "relative", minWidth: 220 }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: adminColors.textSecondary }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search product, vendor, invoice #…"
              style={{
                width: "100%",
                padding: "9px 12px 9px 32px",
                borderRadius: 8,
                border: `1px solid ${adminColors.border}`,
                fontFamily: bodyFont,
                fontSize: 13,
                outline: "none",
              }}
            />
          </div>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13 }}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            style={{ padding: "9px 12px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13 }}
          >
            <option value="">All payment status</option>
            {PAYMENT_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </div>
        <PrimaryButton onClick={openAdd}>
          <Plus size={16} /> Add Purchase
        </PrimaryButton>
      </div>

      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: bodyFont, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${adminColors.border}`, textAlign: "left" }}>
              {["Date", "Product", "Vendor", "Category", "Qty", "GST %", "Grand Total", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", color: adminColors.textSecondary, fontSize: 11, textTransform: "uppercase" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={9} style={{ padding: 20, textAlign: "center", color: adminColors.textSecondary }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && purchases.length === 0 && (
              <tr>
                <td colSpan={9} style={{ padding: 20, textAlign: "center", color: adminColors.textSecondary }}>
                  No purchases yet.
                </td>
              </tr>
            )}
            {purchases.map((p) => (
              <tr key={p.id} style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                <td style={{ padding: "10px 14px" }}>{p.purchaseDate.slice(0, 10)}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>
                  {p.productName}
                  {p.invoiceUrl && <Paperclip size={12} style={{ marginLeft: 6, color: adminColors.textSecondary }} />}
                </td>
                <td style={{ padding: "10px 14px" }}>{p.vendorName || "—"}</td>
                <td style={{ padding: "10px 14px" }}>{p.category}</td>
                <td style={{ padding: "10px 14px" }}>
                  {p.quantity} {p.unit}
                </td>
                <td style={{ padding: "10px 14px" }}>{p.gstPercentage}%</td>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>{formatRupees(p.grandTotal)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge color={STATUS_COLOR[p.paymentStatus] || adminColors.textSecondary}>{p.paymentStatus.replace("_", " ")}</Badge>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(p)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                      <Pencil size={15} color={adminColors.textSecondary} />
                    </button>
                    <button onClick={() => handleDelete(p)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                      <Trash2 size={15} color={adminColors.danger} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {showModal && (
        <Modal title={editing ? "Edit Purchase" : "Add Purchase"} onClose={() => setShowModal(false)} maxWidth={620}>
          {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TextInput label="Purchase Date" type="date" value={form.purchaseDate} onChange={(v) => setForm({ ...form, purchaseDate: v })} />
            <Select
              label="Vendor"
              value={form.vendorId}
              onChange={(v) => setForm({ ...form, vendorId: v })}
              options={[{ value: "", label: "— No vendor —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
            />
            <TextInput label="Invoice Number" value={form.invoiceNumber} onChange={(v) => setForm({ ...form, invoiceNumber: v })} />
            <TextInput label="Invoice Date" type="date" value={form.invoiceDate} onChange={(v) => setForm({ ...form, invoiceDate: v })} />
            <Select
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={[{ value: "", label: "Select category" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
            <TextInput label="Product Name" value={form.productName} onChange={(v) => setForm({ ...form, productName: v })} />
            <TextInput label="Quantity" type="number" value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} />
            <TextInput label="Unit" value={form.unit} onChange={(v) => setForm({ ...form, unit: v })} placeholder="kg, pcs, box…" />
            <TextInput label="Rate (per unit)" type="number" value={form.rate} onChange={(v) => setForm({ ...form, rate: v })} />
            <TextInput label="Discount (flat ₹)" type="number" value={form.discount} onChange={(v) => setForm({ ...form, discount: v })} />
            <TextInput label="GST %" type="number" value={form.gstPercentage} onChange={(v) => setForm({ ...form, gstPercentage: v })} />
            <Select
              label="GST Type"
              value={form.gstType}
              onChange={(v) => setForm({ ...form, gstType: v as "intra_state" | "inter_state" })}
              options={[
                { value: "intra_state", label: "Intra-state (CGST + SGST)" },
                { value: "inter_state", label: "Inter-state (IGST)" },
              ]}
            />
            <Select
              label="Payment Method"
              value={form.paymentMethod}
              onChange={(v) => setForm({ ...form, paymentMethod: v })}
              options={PAYMENT_METHODS.map((m) => ({ value: m, label: m.replace("_", " ") }))}
            />
            <Select
              label="Payment Status"
              value={form.paymentStatus}
              onChange={(v) => setForm({ ...form, paymentStatus: v })}
              options={PAYMENT_STATUSES.map((s) => ({ value: s, label: s.replace("_", " ") }))}
            />
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

          <Card style={{ background: adminColors.bg }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 13, marginBottom: 4 }}>
              <span>Subtotal</span>
              <span>{formatRupees(subtotal)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 13, marginBottom: 4 }}>
              <span>GST Amount</span>
              <span>{formatRupees(gstAmount)}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 15, fontWeight: 800 }}>
              <span>Grand Total</span>
              <span>{formatRupees(grandTotal)}</span>
            </div>
          </Card>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
            <SecondaryButton onClick={() => setShowModal(false)}>Cancel</SecondaryButton>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save Purchase"}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
