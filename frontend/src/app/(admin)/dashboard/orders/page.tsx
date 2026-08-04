"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Search, X, Clock, CheckCircle2, XCircle, Printer, Loader2, Trash2, AlertTriangle } from "lucide-react";
import { PageHeader, Card, SecondaryButton, PrimaryButton, Modal, adminColors } from "@/components/admin/ui";
import {
  fetchRecentOrders,
  fetchRestaurantProfile,
  deleteAdminOrder,
  updateOrderItemStatus,
  orderItemLineKey,
  RecentOrder,
  RestaurantProfile,
} from "@/lib/admin-api";
import { usePrinterStore, PrinterError } from "@/store/printer-store";
import { useAuthStore } from "@/store/auth-store";

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

// Item-Level Order Management: small inline Complete/Cancel action, styled
// to sit under one ordered item rather than as a page-level button. Shows
// a spinner in place of its own icon while its request is in flight, and
// disables both of a row's buttons together so the same item can't be
// double-submitted.
function ItemActionButton({
  variant,
  onClick,
  loading,
  disabled,
}: {
  variant: "complete" | "cancel";
  onClick: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const isComplete = variant === "complete";
  const color = isComplete ? adminColors.success : adminColors.danger;
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 4,
        padding: "4px 10px",
        borderRadius: 8,
        border: `1px solid ${color}`,
        background: disabled ? "#F2F2EE" : "#FFFFFF",
        color: disabled ? adminColors.textSecondary : color,
        fontFamily: bodyFont,
        fontSize: 11,
        fontWeight: 700,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        opacity: disabled ? 0.6 : 1,
      }}
    >
      {loading ? (
        <Loader2 size={11} className="animate-spin" />
      ) : isComplete ? (
        <CheckCircle2 size={11} />
      ) : (
        <XCircle size={11} />
      )}
      {isComplete ? "Complete" : "Cancel"}
    </button>
  );
}

// Small status pill shown next to each ordered item — same color mapping
// as the order-level STATUS_COLOR above, so an item's "Completed"/
// "Cancelled" badge always reads consistently with the order's own status
// elsewhere on this page.
function ItemStatusBadge({ status }: { status: string }) {
  return (
    <span
      style={{
        fontFamily: bodyFont,
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.03em",
        color: STATUS_COLOR[status] ?? adminColors.textSecondary,
        background: `${STATUS_COLOR[status] ?? adminColors.textSecondary}1A`,
        borderRadius: 6,
        padding: "2px 6px",
        whiteSpace: "nowrap",
      }}
    >
      {status}
    </span>
  );
}

function OrderDetailsModal({
  order: initialOrder,
  restaurant,
  canDeleteOrder,
  onClose,
  onOrderUpdated,
  onRequestDelete,
}: {
  order: RecentOrder;
  restaurant: RestaurantProfile | null;
  // Permanent Order Deletion is now accessed from inside this modal instead
  // of the Orders table row — kept as an admin-only emergency override, and
  // only while the order as a whole hasn't already been fully resolved.
  canDeleteOrder: boolean;
  onClose: () => void;
  // Bubbles the freshly-recomputed order (new item statuses + totals) back
  // up to the Orders table so the list/filters/status tab stay in sync
  // without needing a full re-fetch.
  onOrderUpdated: (order: RecentOrder) => void;
  onRequestDelete: () => void;
}) {
  const printOrder = usePrinterStore((s) => s.printOrder);
  const [printing, setPrinting] = useState(false);
  const [printResult, setPrintResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Item-Level Order Management: the modal keeps its own copy of the order
  // so Complete/Cancel can update items/status/totals in place immediately
  // after each PATCH response, without closing the modal.
  const [order, setOrder] = useState(initialOrder);
  const [itemActionLoading, setItemActionLoading] = useState<Record<string, boolean>>({});
  const [itemActionError, setItemActionError] = useState<string | null>(null);

  useEffect(() => {
    setOrder(initialOrder);
  }, [initialOrder]);

  const handlePrintBill = async () => {
    setPrinting(true);
    setPrintResult(null);
    try {
      await printOrder(
        order,
        restaurant
          ? { name: restaurant.name, address: restaurant.address, phone: restaurant.phone }
          : null,
        80
      );
      setPrintResult({ ok: true, message: "Bill sent to the thermal printer." });
    } catch (err) {
      setPrintResult({
        ok: false,
        message: err instanceof PrinterError ? err.message : "Could not print the bill.",
      });
    } finally {
      setPrinting(false);
    }
  };

  // Item-Level Order Management: Complete or Cancel exactly one ordered
  // item. Only that item's row shows a loading spinner while in flight;
  // every other item stays fully interactive. The order returned by the
  // backend already has its status/subtotal/taxAmount/totalAmount/GST
  // figures recomputed from all items — just swap it in.
  const handleItemAction = async (lineKey: string, status: "completed" | "cancelled") => {
    setItemActionError(null);
    setItemActionLoading((prev) => ({ ...prev, [lineKey]: true }));
    try {
      const updated = await updateOrderItemStatus(order.orderId, lineKey, status);
      setOrder(updated);
      onOrderUpdated(updated);
    } catch (err) {
      setItemActionError(err instanceof Error ? err.message : "Could not update this item.");
    } finally {
      setItemActionLoading((prev) => ({ ...prev, [lineKey]: false }));
    }
  };

  // Once the order as a whole is fully resolved, item actions no longer
  // make sense (there's nothing left to complete or cancel).
  const orderFinalized = order.status === "completed" || order.status === "cancelled";

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
        <div style={{ flex: "1 1 120px" }}>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
            Order Status
          </div>
          <ItemStatusBadge status={order.status} />
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
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {(order.items ?? []).map((line, idx) => {
            const lineKey = orderItemLineKey(line, idx);
            const itemStatus = line.status ?? "pending";
            const itemFinalized = itemStatus === "completed" || itemStatus === "cancelled";
            const loading = !!itemActionLoading[lineKey];
            return (
              <div
                key={lineKey}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  paddingBottom: 8,
                  borderBottom: `1px solid ${adminColors.border}`,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, fontFamily: bodyFont, fontSize: 13 }}>
                  <span style={{ color: adminColors.text, opacity: itemStatus === "cancelled" ? 0.5 : 1, textDecoration: itemStatus === "cancelled" ? "line-through" : "none" }}>
                    {line.quantity} × {line.item.name}
                    {line.notes ? <span style={{ color: adminColors.textSecondary }}> ({line.notes})</span> : null}
                  </span>
                  <span style={{ color: adminColors.textSecondary, flexShrink: 0 }}>₹ {line.item.price * line.quantity}</span>
                </div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <ItemStatusBadge status={itemStatus} />
                  {!orderFinalized && !itemFinalized && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <ItemActionButton
                        variant="complete"
                        loading={loading}
                        disabled={loading}
                        onClick={() => handleItemAction(lineKey, "completed")}
                      />
                      <ItemActionButton
                        variant="cancel"
                        loading={loading}
                        disabled={loading}
                        onClick={() => handleItemAction(lineKey, "cancelled")}
                      />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {itemActionError && (
          <p style={{ fontFamily: bodyFont, fontSize: 12, fontWeight: 600, color: adminColors.danger, margin: "8px 0 0" }}>
            {itemActionError}
          </p>
        )}
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
      {printResult && (
        <p
          style={{
            fontFamily: bodyFont,
            fontSize: 12,
            fontWeight: 600,
            color: printResult.ok ? adminColors.success : adminColors.danger,
            margin: 0,
          }}
        >
          {printResult.message}
        </p>
      )}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {order.status === "completed" && (
          <PrimaryButton onClick={handlePrintBill} disabled={printing}>
            {printing ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
            {printing ? "Printing…" : "Print Bill"}
          </PrimaryButton>
        )}
        <SecondaryButton onClick={onClose}>Close</SecondaryButton>
        {/* Emergency override, per the standard workflow above: staff manage
            items individually day-to-day; this stays available to admins
            only, and only while the order isn't already fully resolved. */}
        {canDeleteOrder && (
          <SecondaryButton danger onClick={onRequestDelete}>
            <Trash2 size={13} /> Delete Order
          </SecondaryButton>
        )}
      </div>
    </Modal>
  );
}

// Permanent Order Deletion — confirmation dialog. Distinct from order
// cancellation: this is a hard, unrecoverable delete, so it gets its own
// explicit "type this out" style confirmation copy rather than a generic
// window.confirm().
function DeleteOrderModal({
  order,
  deleting,
  onCancel,
  onConfirm,
}: {
  order: RecentOrder;
  deleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal title="Delete Order" onClose={deleting ? () => {} : onCancel} closeOnOverlayClick={!deleting}>
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div
          style={{
            flexShrink: 0,
            width: 36,
            height: 36,
            borderRadius: "50%",
            background: `${adminColors.danger}1A`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <AlertTriangle size={18} color={adminColors.danger} />
        </div>
        <div style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.text, lineHeight: 1.6 }}>
          <p style={{ margin: 0, fontWeight: 700 }}>
            Are you sure you want to permanently delete order #{order.orderId}?
          </p>
          <p style={{ margin: "6px 0 0" }}>This action cannot be undone.</p>
          <p style={{ margin: "6px 0 0", color: adminColors.textSecondary }}>
            The order will be permanently removed from the database and will no longer appear in Orders,
            Analytics, Revenue, Reports, Settlements, or any other records.
          </p>
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
        <SecondaryButton onClick={onCancel}>Cancel</SecondaryButton>
        <PrimaryButton danger onClick={onConfirm} disabled={deleting}>
          {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          {deleting ? "Deleting…" : "Delete Permanently"}
        </PrimaryButton>
      </div>
    </Modal>
  );
}

export default function AdminOrdersPage() {
  const staffRole = useAuthStore((s) => s.staff?.role);
  const [orders, setOrders] = useState<RecentOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedOrder, setSelectedOrder] = useState<RecentOrder | null>(null);
  const [restaurant, setRestaurant] = useState<RestaurantProfile | null>(null);

  // ---- Permanent Order Deletion ----
  const [orderToDelete, setOrderToDelete] = useState<RecentOrder | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ ok: boolean; message: string } | null>(null);
  const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = (t: { ok: boolean; message: string }) => {
    setToast(t);
    if (toastTimeout.current) clearTimeout(toastTimeout.current);
    toastTimeout.current = setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    fetchRestaurantProfile(RESTAURANT_ID)
      .then(setRestaurant)
      .catch(() => {});
  }, []);

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

  // Item-Level Order Management: keeps the Orders table (and the currently
  // open Order Details modal) in sync the moment an item is completed or
  // cancelled, without waiting on the next poll/re-fetch — the same
  // pattern the rest of this page already uses for Delete.
  const handleOrderUpdated = (updated: RecentOrder) => {
    setOrders((prev) => prev.map((o) => (o.orderId === updated.orderId ? updated : o)));
    setSelectedOrder((prev) => (prev?.orderId === updated.orderId ? updated : prev));
  };

  // Permanent Order Deletion — NOT cancellation. Hard-deletes the order on
  // the backend (see lib/admin-api.ts:deleteAdminOrder), then removes it
  // from the table immediately and re-fetches so every filter/count stays
  // accurate. Analytics/Revenue/Dashboard/Settlements all read live off the
  // Orders collection elsewhere in the app, so they pick up the deletion
  // automatically the next time those pages load.
  const handleConfirmDelete = async () => {
    if (!orderToDelete) return;
    setDeleting(true);
    try {
      await deleteAdminOrder(orderToDelete.orderId);
      setOrders((prev) => prev.filter((o) => o.orderId !== orderToDelete.orderId));
      if (selectedOrder?.orderId === orderToDelete.orderId) setSelectedOrder(null);
      setOrderToDelete(null);
      showToast({ ok: true, message: "Order deleted successfully." });
      load();
    } catch (err) {
      showToast({ ok: false, message: err instanceof Error ? err.message : "Could not delete the order." });
    } finally {
      setDeleting(false);
    }
  };

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
          <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Order", "Table", "Type", "Amount", "Time", ""].map((h) => (
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
                  <td style={cellStyle}>₹ {o.totalAmount}</td>
                  <td style={cellStyle}>
                    <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                    {new Date(o.placedAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}
                  </td>
                  <td style={cellStyle}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <SecondaryButton onClick={() => setSelectedOrder(o)}>
                        <CheckCircle2 size={13} /> Details
                      </SecondaryButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </Card>
      )}

      {selectedOrder && (
        <OrderDetailsModal
          order={selectedOrder}
          restaurant={restaurant}
          // Emergency override only — day-to-day, staff resolve orders item
          // by item. Admin-only, and only while the order hasn't already
          // been fully completed or cancelled on its own.
          canDeleteOrder={staffRole === "admin" && selectedOrder.status !== "completed" && selectedOrder.status !== "cancelled"}
          onClose={() => setSelectedOrder(null)}
          onOrderUpdated={handleOrderUpdated}
          onRequestDelete={() => {
            setOrderToDelete(selectedOrder);
            setSelectedOrder(null);
          }}
        />
      )}

      {orderToDelete && (
        <DeleteOrderModal
          order={orderToDelete}
          deleting={deleting}
          onCancel={() => setOrderToDelete(null)}
          onConfirm={handleConfirmDelete}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 20,
            right: 20,
            zIndex: 1100,
            maxWidth: 340,
            padding: "10px 14px",
            borderRadius: 10,
            background: toast.ok ? "#EAF5EE" : "#FCEFE9",
            border: `1px solid ${toast.ok ? "#B9DEC5" : "#E9C6B4"}`,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            fontFamily: bodyFont,
            fontSize: 12,
            fontWeight: 600,
            color: toast.ok ? adminColors.success : adminColors.danger,
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
          }}
        >
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            aria-label="Dismiss"
            style={{ background: "transparent", border: "none", cursor: "pointer", color: "inherit", display: "flex", flexShrink: 0 }}
          >
            <X size={13} />
          </button>
        </div>
      )}
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