"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Users, UserPlus, Repeat, X, Clock } from "lucide-react";
import { PageHeader, Card, SecondaryButton, Modal, Badge, adminColors } from "@/components/admin/ui";
import {
  fetchTopCustomers,
  fetchCustomerStats,
  fetchCustomerOrderHistory,
  TopCustomer,
  CustomerStats,
  RecentOrder,
} from "@/lib/admin-api";

const RESTAURANT_ID = "maxibrew"; // TODO: make dynamic if you support multiple restaurants
const bodyFont = "var(--font-body, 'Inter', system-ui, sans-serif)";
const RANK_MEDALS = ["🥇", "🥈", "🥉"];

const STATUS_COLOR: Record<string, string> = {
  pending: adminColors.warning,
  preparing: adminColors.warning,
  ready: adminColors.success,
  completed: adminColors.success,
  cancelled: adminColors.danger,
};

function StatBlock({ icon: Icon, value, label, color }: { icon: React.ElementType; value: number; label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Icon size={18} color={color} />
      <div>
        <div style={{ fontFamily: bodyFont, fontSize: 18, fontWeight: 800, color: adminColors.text }}>{value}</div>
        <div style={{ fontFamily: bodyFont, fontSize: 11, color: adminColors.textSecondary }}>{label}</div>
      </div>
    </div>
  );
}

function CustomerHistoryModal({ customer, onClose }: { customer: TopCustomer; onClose: () => void }) {
  const [orders, setOrders] = useState<RecentOrder[] | null>(null);

  useEffect(() => {
    fetchCustomerOrderHistory(RESTAURANT_ID, customer.phone)
      .then((data) => setOrders(data.orders))
      .catch(() => setOrders([]));
  }, [customer.phone]);

  return (
    <Modal title={`${customer.name} — Order History`} onClose={onClose}>
      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>Total Spent</div>
          <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 800, color: adminColors.text }}>₹ {customer.totalSpent.toLocaleString("en-IN")}</div>
        </div>
        <div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>Total Orders</div>
          <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 800, color: adminColors.text }}>{customer.totalOrders}</div>
        </div>
        <div>
          <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase" }}>Avg. Order</div>
          <div style={{ fontFamily: bodyFont, fontSize: 16, fontWeight: 800, color: adminColors.text }}>₹ {customer.averageOrderValue}</div>
        </div>
      </div>

      <div>
        <div style={{ fontFamily: bodyFont, fontSize: 11, fontWeight: 700, color: adminColors.textSecondary, textTransform: "uppercase", marginBottom: 10 }}>
          Recent Orders
        </div>
        {orders === null ? (
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>
        ) : orders.length === 0 ? (
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>No orders found.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {orders.map((o) => (
              <div key={o.orderId} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                <div>
                  <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text }}>#{o.orderId}</div>
                  <div style={{ fontFamily: bodyFont, fontSize: 11, color: adminColors.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
                    <Clock size={11} /> {new Date(o.placedAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}
                  </div>
                </div>
                <Badge color={STATUS_COLOR[o.status] ?? adminColors.textSecondary}>{o.status}</Badge>
                <div style={{ fontFamily: bodyFont, fontSize: 13, fontWeight: 700, color: adminColors.text }}>₹ {o.totalAmount}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <SecondaryButton onClick={onClose}>
        <X size={13} /> Close
      </SecondaryButton>
    </Modal>
  );
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<TopCustomer[]>([]);
  const [stats, setStats] = useState<CustomerStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<TopCustomer | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([fetchTopCustomers(RESTAURANT_ID, 100), fetchCustomerStats(RESTAURANT_ID)])
      .then(([c, s]) => {
        setCustomers(c);
        setStats(s);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div>
      <PageHeader title="Customers" description="Who's ordering, how often, and how much they spend" />

      {/* ---- Customer Analytics ---- */}
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: "flex", gap: 28, flexWrap: "wrap" }}>
          <StatBlock icon={Users} value={stats?.totalCustomers ?? 0} label="Total Customers" color={adminColors.primary} />
          <StatBlock icon={UserPlus} value={stats?.newCustomers ?? 0} label="New (30 days)" color={adminColors.success} />
          <StatBlock icon={Repeat} value={stats?.repeatCustomers ?? 0} label="Repeat Customers" color={adminColors.warning} />
        </div>
      </Card>

      {loading && <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary }}>Loading…</p>}

      {!loading && customers.length === 0 && (
        <Card>
          <p style={{ fontFamily: bodyFont, fontSize: 13, color: adminColors.textSecondary, margin: 0 }}>
            No customer data yet — customers who share their name & phone at checkout will appear here.
          </p>
        </Card>
      )}

      {!loading && customers.length > 0 && (
        <Card style={{ padding: 0 }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left" }}>
                {["Rank", "Customer", "Phone", "Orders", "Avg. Order", "Last Visit", "Total Spent", ""].map((h) => (
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
              {customers.map((c, idx) => (
                <tr key={c.id}>
                  <td style={cellStyle}>{RANK_MEDALS[idx] ?? `#${idx + 1}`}</td>
                  <td style={{ ...cellStyle, fontWeight: 700 }}>{c.name}</td>
                  <td style={cellStyle}>{c.phone}</td>
                  <td style={cellStyle}>{c.totalOrders}</td>
                  <td style={cellStyle}>₹ {c.averageOrderValue}</td>
                  <td style={cellStyle}>{new Date(c.lastVisit).toLocaleDateString()}</td>
                  <td style={{ ...cellStyle, fontWeight: 800, color: adminColors.primary }}>₹ {c.totalSpent.toLocaleString("en-IN")}</td>
                  <td style={cellStyle}>
                    <SecondaryButton onClick={() => setSelected(c)}>History</SecondaryButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {selected && <CustomerHistoryModal customer={selected} onClose={() => setSelected(null)} />}
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
