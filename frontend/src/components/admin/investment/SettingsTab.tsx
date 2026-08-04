"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, CheckCircle2, ShieldCheck } from "lucide-react";
import { Card, PrimaryButton, SecondaryButton, TextInput, Select, Badge, adminColors } from "@/components/admin/ui";
import {
  fetchExpenseCategories,
  createExpenseCategory,
  fetchRecurringExpenses,
  createRecurringExpense,
  deleteRecurringExpense,
  recordRecurringExpensePayment,
  fetchInvestmentVendors,
  RecurringExpense,
  InvestmentVendor,
} from "@/lib/admin-api";

const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";
const FREQUENCIES = ["weekly", "monthly", "yearly"];

function formatRupees(value: number) {
  return `₹ ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function isOverdue(dateStr: string) {
  return new Date(dateStr) < new Date(new Date().toDateString());
}

const emptyRecurringForm = {
  name: "",
  category: "",
  amount: "",
  frequency: "monthly",
  vendorId: "",
  nextDueDate: new Date().toISOString().slice(0, 10),
};

export default function SettingsTab({ restaurantId }: { restaurantId: string }) {
  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [recurring, setRecurring] = useState<RecurringExpense[]>([]);
  const [vendors, setVendors] = useState<InvestmentVendor[]>([]);
  const [recurringForm, setRecurringForm] = useState(emptyRecurringForm);
  const [error, setError] = useState<string | null>(null);

  const loadCategories = useCallback(() => {
    fetchExpenseCategories(restaurantId).then(setCategories).catch(() => setCategories([]));
  }, [restaurantId]);

  const loadRecurring = useCallback(() => {
    fetchRecurringExpenses(restaurantId).then(setRecurring).catch(() => setRecurring([]));
  }, [restaurantId]);

  useEffect(() => {
    loadCategories();
    loadRecurring();
    fetchInvestmentVendors(restaurantId).then(setVendors).catch(() => setVendors([]));
  }, [restaurantId, loadCategories, loadRecurring]);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) return;
    try {
      await createExpenseCategory(restaurantId, newCategory.trim());
      setNewCategory("");
      loadCategories();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add category");
    }
  };

  const handleAddRecurring = async () => {
    if (!recurringForm.name || !recurringForm.category || !recurringForm.amount) {
      setError("Name, category, and amount are required for a recurring expense");
      return;
    }
    try {
      await createRecurringExpense({
        restaurantId,
        name: recurringForm.name,
        category: recurringForm.category,
        amount: Number(recurringForm.amount),
        frequency: recurringForm.frequency as "weekly" | "monthly" | "yearly",
        vendorId: recurringForm.vendorId || undefined,
        nextDueDate: recurringForm.nextDueDate,
      });
      setRecurringForm(emptyRecurringForm);
      loadRecurring();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't add recurring expense");
    }
  };

  const handleRecordPayment = async (r: RecurringExpense) => {
    await recordRecurringExpensePayment(restaurantId, r.id);
    loadRecurring();
  };

  const handleDeleteRecurring = async (r: RecurringExpense) => {
    if (!confirm(`Stop recurring expense "${r.name}"?`)) return;
    await deleteRecurringExpense(restaurantId, r.id);
    loadRecurring();
  };

  return (
    <div>
      <Card style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 10 }}>
        <ShieldCheck size={18} color={adminColors.primary} />
        <span style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>
          Investment &amp; Expenses is visible to Owner/Admin accounts only — the same restriction the backend enforces on every request.
        </span>
      </Card>

      {error && <p style={{ color: adminColors.danger, fontFamily: bodyFont, fontSize: 13 }}>{error}</p>}

      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Expense Categories</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 14 }}>
          {categories.map((c) => (
            <Badge key={c} color={adminColors.primary}>
              {c}
            </Badge>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
          <TextInput label="New Category" value={newCategory} onChange={setNewCategory} placeholder="e.g. Delivery Fees" />
          <PrimaryButton onClick={handleAddCategory}>
            <Plus size={16} /> Add
          </PrimaryButton>
        </div>
      </Card>

      <Card>
        <div style={{ fontFamily: bodyFont, fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Recurring Expenses</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <TextInput label="Name" value={recurringForm.name} onChange={(v) => setRecurringForm({ ...recurringForm, name: v })} placeholder="Rent, Internet…" />
          <Select
            label="Category"
            value={recurringForm.category}
            onChange={(v) => setRecurringForm({ ...recurringForm, category: v })}
            options={[{ value: "", label: "Select category" }, ...categories.map((c) => ({ value: c, label: c }))]}
          />
          <TextInput label="Amount" type="number" value={recurringForm.amount} onChange={(v) => setRecurringForm({ ...recurringForm, amount: v })} />
          <Select
            label="Frequency"
            value={recurringForm.frequency}
            onChange={(v) => setRecurringForm({ ...recurringForm, frequency: v })}
            options={FREQUENCIES.map((f) => ({ value: f, label: f }))}
          />
          <Select
            label="Vendor"
            value={recurringForm.vendorId}
            onChange={(v) => setRecurringForm({ ...recurringForm, vendorId: v })}
            options={[{ value: "", label: "— No vendor —" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
          />
          <TextInput label="Next Due Date" type="date" value={recurringForm.nextDueDate} onChange={(v) => setRecurringForm({ ...recurringForm, nextDueDate: v })} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <PrimaryButton onClick={handleAddRecurring}>
            <Plus size={16} /> Add Recurring Expense
          </PrimaryButton>
        </div>

        <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.textSecondary, marginBottom: 8 }}>Upcoming Recurring Payments</div>
        {recurring.length === 0 && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No recurring expenses set up.</p>}
        {recurring.map((r) => (
          <div
            key={r.id}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "10px 0",
              borderBottom: `1px solid ${adminColors.border}`,
              fontFamily: bodyFont,
              fontSize: 13,
            }}
          >
            <div>
              <div style={{ fontWeight: 700 }}>
                {r.name} <span style={{ color: adminColors.textSecondary, fontWeight: 400 }}>({r.frequency})</span>
              </div>
              <div style={{ color: isOverdue(r.nextDueDate) ? adminColors.danger : adminColors.textSecondary }}>
                Due {r.nextDueDate.slice(0, 10)} {isOverdue(r.nextDueDate) && "· overdue"}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontWeight: 700 }}>{formatRupees(r.amount)}</span>
              <button onClick={() => handleRecordPayment(r)} title="Record payment" style={{ border: "none", background: "none", cursor: "pointer" }}>
                <CheckCircle2 size={18} color={adminColors.success} />
              </button>
              <button onClick={() => handleDeleteRecurring(r)} title="Stop recurring expense" style={{ border: "none", background: "none", cursor: "pointer" }}>
                <Trash2 size={16} color={adminColors.danger} />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
