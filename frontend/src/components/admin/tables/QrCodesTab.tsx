"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, Download, Power } from "lucide-react";
import {
  PageHeader,
  Card,
  PrimaryButton,
  SecondaryButton,
  TextInput,
  Badge,
  Modal,
  adminColors,
} from "@/components/admin/ui";
import {
  fetchAdminTables,
  createAdminTable,
  updateAdminTable,
  deleteAdminTable,
  AdminTable,
} from "@/lib/admin-api";

// Free QR image generator — renders a scannable QR code for any URL with
// no extra npm dependency or backend work. Fine for a demo; if you outgrow
// reliance on a third-party service, swap this for a self-hosted QR
// library (e.g. `qrcode` on the backend) later.
function qrImageUrl(targetUrl: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(targetUrl)}`;
}

// Original QR management page (unchanged logic), now used as the "QR Codes"
// tab inside the Table Management dashboard. RESTAURANT_ID is passed in as
// a prop instead of a hardcoded module constant so it stays a single source
// of truth with the rest of the tables dashboard.
export default function QrCodesTab({ RESTAURANT_ID }: { RESTAURANT_ID: string }) {
  const [tables, setTables] = useState<AdminTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminTables(RESTAURANT_ID)
      .then(setTables)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleCreate = async () => {
    if (!label.trim()) {
      setError("Table label is required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createAdminTable(RESTAURANT_ID, label.trim());
      setShowForm(false);
      setLabel("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (table: AdminTable) => {
    await updateAdminTable(table._id, { isActive: !table.isActive });
    load();
  };

  const handleDelete = async (table: AdminTable) => {
    if (!confirm(`Delete "${table.label}"? Its QR code will stop working immediately.`)) return;
    await deleteAdminTable(table._id);
    load();
  };

  return (
    <div>
      <PageHeader
        title="Tables & QR Codes"
        description="Each table gets its own permanent QR code — print and place one per table"
        action={
          <PrimaryButton onClick={() => setShowForm(true)}>
            <Plus size={15} /> Add Table
          </PrimaryButton>
        }
      />

      {loading && <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && tables.length === 0 && (
        <Card>
          <p style={{ fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)", fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No tables yet. Add your first one.
          </p>
        </Card>
      )}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          gap: 16,
        }}
      >
        {tables.map((table) => {
          const url = origin ? `${origin}/${RESTAURANT_ID}?table=${table.token}` : "";
          return (
            <Card key={table._id} style={{ opacity: table.isActive ? 1 : 0.5 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <span
                  style={{
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 14,
                    fontWeight: 700,
                    color: adminColors.text,
                  }}
                >
                  {table.label}
                </span>
                {!table.isActive && <Badge color={adminColors.textSecondary}>Inactive</Badge>}
              </div>

              {url && (
                <div style={{ display: "flex", justifyContent: "center", marginBottom: 10 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={qrImageUrl(url)} alt={`QR code for ${table.label}`} width={160} height={160} />
                </div>
              )}

              <div
                style={{
                  fontFamily: "monospace",
                  fontSize: 10,
                  color: adminColors.textSecondary,
                  wordBreak: "break-all",
                  textAlign: "center",
                  marginBottom: 12,
                }}
              >
                {table.token}
              </div>

              <div style={{ display: "flex", gap: 6 }}>
                <a
                  href={qrImageUrl(url)}
                  download={`${table.label.replace(/\s+/g, "-")}-qr.png`}
                  style={{ flex: 1 }}
                >
                  <SecondaryButton>
                    <Download size={13} /> Download
                  </SecondaryButton>
                </a>
                <SecondaryButton onClick={() => handleToggleActive(table)}>
                  <Power size={13} />
                </SecondaryButton>
                <SecondaryButton danger onClick={() => handleDelete(table)}>
                  <Trash2 size={13} />
                </SecondaryButton>
              </div>
            </Card>
          );
        })}
      </div>

      {showForm && (
        <Modal title="Add Table" onClose={() => setShowForm(false)}>
          <TextInput label="Table Label" value={label} onChange={setLabel} placeholder="e.g. Table 11" />
          {error && <div style={{ fontSize: 12, fontWeight: 600, color: adminColors.danger }}>{error}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <PrimaryButton onClick={handleCreate} disabled={saving}>
              {saving ? "Adding…" : "Add Table"}
            </PrimaryButton>
            <SecondaryButton onClick={() => setShowForm(false)}>Cancel</SecondaryButton>
          </div>
        </Modal>
      )}
    </div>
  );
}
