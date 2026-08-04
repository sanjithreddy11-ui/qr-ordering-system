"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Search, Pencil, Trash2 } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput, TextArea, Select, Badge, Modal, adminColors } from "@/components/admin/ui";
import {
  fetchInvestmentExpenses,
  createInvestmentExpense,
  updateInvestmentExpense,
  deleteInvestmentExpense,
  uploadInvestmentInvoice,
  fetchInvestmentVendors,
  fetchExpenseCategories,
  InvestmentExpense,
  InvestmentVendor,
} from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";
const PAYMENT_METHODS = ["cash", "upi", "card", "bank_transfer", "cheque", "pending"];
const PAYMENT_STATUSES = ["paid", "pending", "partially_paid"];
const STATUS_COLOR: Record<string, string> = { paid: adminColors.success, pending: adminColors.warning, partially_paid: adminColors.warning };

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

const emptyForm = {
  date: new Date().toISOString().slice(0, 10),
  category: "",
  description: "",
  amount: "",
  vendorId: "",
  paymentMethod: "cash",
  paymentStatus: "paid",
  notes: "",
};

export default function ExpensesTab({ restaurantId }: { restaurantId: string }) {
  const [expenses, setExpenses] = useState<InvestmentExpense[]>([]);
  const [vendors, setVendors] = useState<InvestmentVendor[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<InvestmentExpense | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchInvestmentExpenses(restaurantId, { search: search || undefined, category: categoryFilter || undefined, limit: 100 })
      .then((res) => setExpenses(res.expenses))
      .catch(() => setExpenses([]))
      .finally(() => setLoading(false));
  }, [restaurantId, search, categoryFilter]);

  useEffect(() => {
    load();
  }, [load]);

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

  const openEdit = (e: InvestmentExpense) => {
    setEditing(e);
    setForm({
      date: e.date.slice(0, 10),
      category: e.category,
      description: e.description,
      amount: String(e.amount),
      vendorId: e.vendorId || "",
      paymentMethod: e.paymentMethod,
      paymentStatus: e.paymentStatus,
      notes: e.notes,
    });
    setInvoiceFile(null);
    setError(null);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.category || !form.amount) {
      setError("Category and amount are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let invoiceUrl = editing?.invoiceUrl || "";
      if (invoiceFile) invoiceUrl = await uploadInvestmentInvoice(invoiceFile);

      const payload = {
        restaurantId,
        date: form.date,
        category: form.category,
        description: form.description,
        amount: Number(form.amount),
        vendorId: form.vendorId || undefined,
        paymentMethod: form.paymentMethod as any,
        paymentStatus: form.paymentStatus as any,
        notes: form.notes,
        invoiceUrl,
      };

      if (editing) await updateInvestmentExpense(restaurantId, editing.id, payload);
      else await createInvestmentExpense(payload);

      setShowModal(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the expense");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (e: InvestmentExpense) => {
    if (!confirm(`Delete expense "${e.description || e.category}"?`)) return;
    await deleteInvestmentExpense(restaurantId, e.id);
    load();
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
              placeholder="Search description, vendor…"
              style={{ width: "100%", padding: "9px 12px 9px 32px", borderRadius: 8, border: `1px solid ${adminColors.border}`, fontFamily: bodyFont, fontSize: 13, outline: "none" }}
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
        </div>
        <PrimaryButton onClick={openAdd}>
          <Plus size={16} /> Add Expense
        </PrimaryButton>
      </div>

      <Card style={{ padding: 0, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: bodyFont, fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${adminColors.border}`, textAlign: "left" }}>
              {["Date", "Description", "Category", "Vendor", "Amount", "Status", ""].map((h) => (
                <th key={h} style={{ padding: "12px 14px", color: adminColors.textSecondary, fontSize: 11, textTransform: "uppercase" }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center", color: adminColors.textSecondary }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && expenses.length === 0 && (
              <tr>
                <td colSpan={7} style={{ padding: 20, textAlign: "center", color: adminColors.textSecondary }}>
                  No expenses yet.
                </td>
              </tr>
            )}
            {expenses.map((e) => (
              <tr key={e.id} style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                <td style={{ padding: "10px 14px" }}>{e.date.slice(0, 10)}</td>
                <td style={{ padding: "10px 14px", fontWeight: 600 }}>{e.description || "—"}</td>
                <td style={{ padding: "10px 14px" }}>{e.category}</td>
                <td style={{ padding: "10px 14px" }}>{e.vendorName || "—"}</td>
                <td style={{ padding: "10px 14px", fontWeight: 700 }}>{formatRupees(e.amount)}</td>
                <td style={{ padding: "10px 14px" }}>
                  <Badge color={STATUS_COLOR[e.paymentStatus] || adminColors.textSecondary}>{e.paymentStatus.replace("_", " ")}</Badge>
                </td>
                <td style={{ padding: "10px 14px" }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => openEdit(e)} style={{ border: "none", background: "none", cursor: "pointer" }}>
                      <Pencil size={15} color={adminColors.textSecondary} />
                    </button>
                    <button onClick={() => handleDelete(e)} style={{ border: "none", background: "none", cursor: "pointer" }}>
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
        <Modal title={editing ? "Edit Expense" : "Add Expense"} onClose={() => setShowModal(false)} maxWidth={560}>
          {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13 }}>{error}</p>}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <TextInput label="Date" type="date" value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
            <Select
              label="Category"
              value={form.category}
              onChange={(v) => setForm({ ...form, category: v })}
              options={[{ value: "", label: "Select category" }, ...categories.map((c) => ({ value: c, label: c }))]}
            />
            <TextInput label="Amount" type="number" value={form.amount} onChange={(v) => setForm({ ...form, amount: v })} />
            <Select
              label="Vendor"
              value={form.vendorId}
              onChange={(v) => setForm({ ...form, vendorId: v })}
              options={[{ value: "", label: "— No vendor —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
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
          <TextInput label="Description" value={form.description} onChange={(v) => setForm({ ...form, description: v })} />
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
              {saving ? "Saving…" : "Save Expense"}
            </PrimaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
