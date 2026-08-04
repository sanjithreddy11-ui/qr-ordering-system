"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Pencil, Trash2, Power, Tag } from "lucide-react";
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
  fetchAdminOffers,
  createAdminOffer,
  updateAdminOffer,
  deleteAdminOffer,
  Offer,
} from "@/lib/admin-api";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

function formatCurrency(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function discountValueLabel(offer: Pick<Offer, "discountType" | "discountValue">): string {
  return offer.discountType === "flat" ? `₹${offer.discountValue} Off` : `${offer.discountValue}% Off`;
}

type OfferForm = {
  name: string;
  discountType: "flat" | "percentage";
  discountValue: string;
  minOrderAmount: string;
};

const emptyForm: OfferForm = { name: "", discountType: "flat", discountValue: "", minOrderAmount: "" };

export default function AdminOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showForm, setShowForm] = useState(false);
  const [editingOffer, setEditingOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState<OfferForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminOffers(RESTAURANT_ID)
      .then(setOffers)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load offers"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingOffer(null);
    setForm(emptyForm);
    setFormError(null);
    setShowForm(true);
  };

  const openEdit = (offer: Offer) => {
    setEditingOffer(offer);
    setForm({
      name: offer.name,
      discountType: offer.discountType,
      discountValue: String(offer.discountValue),
      minOrderAmount: offer.minOrderAmount ? String(offer.minOrderAmount) : "",
    });
    setFormError(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    setFormError(null);

    const name = form.name.trim();
    const discountValue = Number(form.discountValue);
    const minOrderAmount = form.minOrderAmount ? Number(form.minOrderAmount) : 0;

    if (!name) {
      setFormError("Offer name is required");
      return;
    }
    if (!form.discountValue || Number.isNaN(discountValue) || discountValue <= 0) {
      setFormError("Enter a valid discount value greater than 0");
      return;
    }
    if (form.discountType === "percentage" && discountValue > 100) {
      setFormError("A percentage discount cannot exceed 100");
      return;
    }
    if (form.minOrderAmount && (Number.isNaN(minOrderAmount) || minOrderAmount < 0)) {
      setFormError("Minimum order amount must be a non-negative number");
      return;
    }

    setSaving(true);
    try {
      if (editingOffer) {
        await updateAdminOffer(editingOffer.id, {
          name,
          discountType: form.discountType,
          discountValue,
          minOrderAmount,
        });
      } else {
        await createAdminOffer({
          restaurantId: RESTAURANT_ID,
          name,
          discountType: form.discountType,
          discountValue,
          minOrderAmount,
        });
      }
      setShowForm(false);
      load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (offer: Offer) => {
    await updateAdminOffer(offer.id, { isActive: !offer.isActive });
    load();
  };

  const handleDelete = async (offer: Offer) => {
    if (!confirm(`Delete "${offer.name}"? This cannot be undone.`)) return;
    await deleteAdminOffer(offer.id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Offers & Discounts"
        description="Create and manage restaurant offers. Applied manually by staff during billing (Tables & QR → Billing)."
        action={
          <PrimaryButton onClick={openCreate}>
            <Plus size={15} /> Create Offer
          </PrimaryButton>
        }
      />

      {loading && (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>
      )}

      {error && (
        <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.danger }}>{error}</p>
      )}

      {!loading && offers.length === 0 && (
        <Card style={{ textAlign: "center", padding: "48px 24px" }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 16,
              background: `${adminColors.primary}12`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
            }}
          >
            <Tag size={26} color={adminColors.primary} />
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 700, color: adminColors.text, marginBottom: 6 }}>
            No offers yet
          </div>
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, maxWidth: 420, margin: "0 auto" }}>
            Create a Flat or Percentage discount offer — it&apos;ll show up here and become available to apply during billing.
          </p>
        </Card>
      )}

      {!loading && offers.length > 0 && (
        <Card style={{ padding: 0, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: bodyFont }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${adminColors.border}` }}>
                {["Offer Name", "Discount Type", "Discount Value", "Min. Order Amount", "Status", "Created", "Actions"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Actions" ? "right" : "left",
                      padding: "12px 16px",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      color: adminColors.textSecondary,
                      whiteSpace: "nowrap",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {offers.map((offer, idx) => (
                <tr
                  key={offer.id}
                  style={{
                    borderBottom: idx < offers.length - 1 ? `1px solid ${adminColors.border}` : "none",
                    opacity: offer.isActive ? 1 : 0.55,
                  }}
                >
                  <td style={{ padding: "12px 16px", fontSize: 13, fontWeight: 700, color: adminColors.text, whiteSpace: "nowrap" }}>
                    {offer.name}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: adminColors.text, textTransform: "capitalize" }}>
                    {offer.discountType}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: adminColors.text, whiteSpace: "nowrap" }}>
                    {discountValueLabel(offer)}
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: adminColors.text }}>
                    {offer.minOrderAmount ? formatCurrency(offer.minOrderAmount) : "—"}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <Badge color={offer.isActive ? adminColors.success : adminColors.textSecondary}>
                      {offer.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: adminColors.textSecondary, whiteSpace: "nowrap" }}>
                    {formatDate(offer.createdAt)}
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <SecondaryButton onClick={() => handleToggleActive(offer)}>
                        <Power size={13} /> {offer.isActive ? "Disable" : "Enable"}
                      </SecondaryButton>
                      <SecondaryButton onClick={() => openEdit(offer)}>
                        <Pencil size={13} />
                      </SecondaryButton>
                      <SecondaryButton danger onClick={() => handleDelete(offer)}>
                        <Trash2 size={13} />
                      </SecondaryButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {showForm && (
        <Modal title={editingOffer ? "Edit Offer" : "Create Offer"} onClose={() => setShowForm(false)}>
          <TextInput
            label="Offer Name"
            value={form.name}
            onChange={(v) => setForm((f) => ({ ...f, name: v }))}
            placeholder="e.g. Weekend Special"
          />
          <Select
            label="Discount Type"
            value={form.discountType}
            onChange={(v) => setForm((f) => ({ ...f, discountType: v as "flat" | "percentage" }))}
            options={[
              { value: "flat", label: "Flat (₹ Off)" },
              { value: "percentage", label: "Percentage (% Off)" },
            ]}
          />
          <TextInput
            label={form.discountType === "flat" ? "Discount Value (₹)" : "Discount Value (%)"}
            type="number"
            value={form.discountValue}
            onChange={(v) => setForm((f) => ({ ...f, discountValue: v }))}
            placeholder={form.discountType === "flat" ? "e.g. 100" : "e.g. 10"}
          />
          <TextInput
            label="Minimum Order Amount (Optional)"
            type="number"
            value={form.minOrderAmount}
            onChange={(v) => setForm((f) => ({ ...f, minOrderAmount: v }))}
            placeholder="e.g. 500"
          />

          {formError && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{formError}</div>}

          <div style={{ display: "flex", gap: 8 }}>
            <PrimaryButton onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : editingOffer ? "Save Changes" : "Create Offer"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
