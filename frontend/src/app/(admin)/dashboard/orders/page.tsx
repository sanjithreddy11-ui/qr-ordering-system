"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Search, X, Clock, CheckCircle2 } from "lucide-react";
import { PageHeader, Card, SecondaryButton, Badge, Modal, adminColors } from "@/components/admin/ui";
import { fetchRecentOrders, RecentOrder } from "@/lib/admin-api";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "preparing", label: "Preparing" },
  { key: "ready", label: "Ready" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
];

const STATUS_COLOR: Record<string, string> = {
  pending: adminColors.warning,
  preparing: adminColors.warning,
  ready: adminColors.success,
  completed: adminColors.success,
  cancelled: adminColors.danger,
};

const textFieldStyle: React.CSSProperties = {
  padding: "9px 12px",
  borderRadius: 8,
  border: `1px solid ${adminColors.border}`,
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  outline: "none",
  background: "#fff",
};

function OrderTimeline({ order }: { order: RecentOrder }) {
  const history = order.statusHistory && order.statusHistory.length > 0
    ? order.statusHistory
    : [{ status: order.status, changedAt: order.placedAt }];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
      {history.map((entry, idx) => (
        <div key={idx} style={{ display: "flex", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: STATUS_COLOR[entry.status] ?? adminColors.textSecondary,
                flexShrink: 0,
                marginTop: 4,
              }}
            />
            {idx < history.length - 1 && <div style={{ width: 2, flex: 1, background: adminColors.border, minHeight: 20 }} />}
          </div>
          <div style={{ paddingBottom: 16 }}>
            <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text, textTransform: "capitalize" }}>
              {entry.status}
            </div>
            <div style={{ fontFamily: bodyFont, fontSize: 11, color: adminColors.textSecondary }}>
              {new Date(entry.changedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function OrderDetailsModal({ order, onClose }: { order: RecentOrder; onClose: () => void }) {
  return (
    <Modal title={`Order #${order.orderId}`} onClose={onClose}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Table
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 600, color: adminColors.text }}>
            {order.tableLabel ?? "—"} · {order.orderType === "dine-in" ? "Dine-in" : "Takeaway"}
          </div>
        </div>
        <div style={{ flex: "1 1 200px" }}>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Customer
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 14, fontWeight: 600, color: adminColors.text }}>
            {order.customerName || "Guest"} {order.customerPhone ? `· ${order.customerPhone}` : ""}
          </div>
        </div>
      </div>

      {order.specialInstructions && (
        <div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Special Instructions
          </div>
          <div style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.text }}>{order.specialInstructions}</div>
        </div>
      )}

      <div>
        <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
          Items
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {(order.items ?? []).map((line, idx) => (
            <div key={idx} style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 13 }}>
              <span style={{ color: adminColors.text }}>
                {line.quantity} × {line.item.name}
              </span>
              <span style={{ color: adminColors.textSecondary }}>₹ {line.item.price * line.quantity}</span>
            </div>
          ))}
        </div>
        <div style={{ borderTop: `1px solid ${adminColors.border}`, marginTop: 10, paddingTop: 10, display: "flex", flexDirection: "column", gap: 4 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
            <span>Subtotal</span>
            <span>₹ {order.subtotal ?? "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
            <span>Tax</span>
            <span>₹ {order.taxAmount ?? "—"}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontFamily: bodyFont, fontSize: 14, fontWeight: 800, color: adminColors.text }}>
            <span>Total</span>
            <span>₹ {order.totalAmount}</span>
          </div>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 10 }}>
          Order Timeline
        </div>
        <OrderTimeline order={order} />
      </div>

      <SecondaryButton onClick={onClose}>Close</SecondaryButton>
    </Modal>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchRecentOrders(RESTAURANT_ID, {
      status: statusTab || undefined,
      search: search || undefined,
      from: dateFrom ? new Date(dateFrom).toISOString() : undefined,
      to: dateTo ? new Date(`${dateTo}T23:59:59`).toISOString() : undefined,
      limit: 200,
    })
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [statusTab, search, dateFrom, dateTo]);

  useEffect(() => {
    const timeout = setTimeout(load, 250); // light debounce for the search box
    return () => clearTimeout(timeout);
  }, [load]);

  const clearFilters = () => {
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setStatusTab("");
  };

  const hasActiveFilters = search || dateFrom || dateTo || statusTab;

  return (
    <div>
      <PageHeader title="Orders" description="Search, filter, and track every order end-to-end" />

      {/* ---- Status tabs ---- */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusTab(tab.key)}
            style={{
              padding: "8px 14px",
              borderRadius: 10,
              border: `1px solid ${statusTab === tab.key ? "transparent" : adminColors.border}`,
              background: statusTab === tab.key ? adminColors.primary : "#FFFFFF",
              color: statusTab === tab.key ? "#FFFFFF" : adminColors.text,
              fontFamily: bodyFont,
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ---- Search & date range ---- */}
      <Card style={{ marginBottom: 20, padding: 14 }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px", minWidth: 180 }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: adminColors.textSecondary }} />
            <input
              placeholder="Search order ID, customer, table…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ ...textFieldStyle, width: "100%", paddingLeft: 30, boxSizing: "border-box" }}
            />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
            From
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={textFieldStyle} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: bodyFont, fontSize: 12, color: adminColors.textSecondary }}>
            To
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={textFieldStyle} />
          </label>
          {hasActiveFilters ? (
            <SecondaryButton onClick={clearFilters}>
              <X size={13} /> Clear
            </SecondaryButton>
          ) : null}
        </div>
      </Card>

      {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && orders.length === 0 && (
        <Card>
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No orders match these filters.
          </p>
        </Card>
      )}

      {!loading && orders.length > 0 && (
        <Card style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Order", "Table", "Type", "Status", "Amount", "Time", ""].map((h) => (
                  <th
                    key={h}
                    style={{
                      fontFamily: bodyFont,
                      fontSize: 11,
                      fontWeight: 700,
                      color: adminColors.textSecondary,
                      textTransform: "uppercase",
                      letterSpacing: "0.04em",
                      padding: "12px 16px",
                      borderBottom: `1px solid ${adminColors.border}`,
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.orderId}>
                  <td style={cellStyle}>#{o.orderId}</td>
                  <td style={cellStyle}>{o.tableLabel ?? "—"}</td>
                  <td style={cellStyle}>{o.orderType === "dine-in" ? "Dine-in" : "Takeaway"}</td>
                  <td style={cellStyle}>
                    <Badge color={STATUS_COLOR[o.status] ?? adminColors.textSecondary}>{o.status}</Badge>
                  </td>
                  <td style={cellStyle}>₹ {o.totalAmount}</td>
                  <td style={cellStyle}>
                    <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                    {new Date(o.placedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={cellStyle}>
                    <SecondaryButton onClick={() => setSelectedOrder(o)}>
                      <CheckCircle2 size={13} /> Details
                    </SecondaryButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />}
    </div>
  );
}

const cellStyle: React.CSSProperties = {
  fontFamily: bodyFont,
  fontSize: 13,
  color: adminColors.text,
  padding: "12px 16px",
  borderBottom: `1px solid ${adminColors.border}`,
};
