"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { Flame, Clock, UtensilsCrossed, ShoppingBag, Wifi, WifiOff } from "lucide-react";
import { getSocket } from "@/lib/socket";
import { fetchOrdersForRestaurant, updateOrderStatus } from "@/lib/api";
import type { Order, OrderStatus } from "@/types/order";

const RESTAURANT_ID = "lifafa"; // TODO: make dynamic if you support multiple restaurants

const COLUMNS: { status: OrderStatus; title: string; accent: string }[] = [
  { status: "pending", title: "New Orders", accent: "#C24C2E" },
  { status: "preparing", title: "Preparing", accent: "#C9971F" },
  { status: "ready", title: "Ready to Serve", accent: "#2E7D4F" },
];

const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  pending: "preparing",
  preparing: "ready",
  ready: "completed",
};

const NEXT_LABEL: Partial<Record<OrderStatus, string>> = {
  pending: "Start Preparing",
  preparing: "Mark Ready",
  ready: "Complete Order",
};

function elapsedMinutes(placedAt: string, now: number) {
  return Math.floor((now - new Date(placedAt).getTime()) / 60000);
}

function OrderCard({
  order,
  now,
  isNew,
  onAdvance,
}: {
  order: Order;
  now: number;
  isNew: boolean;
  onAdvance: (order: Order) => void;
}) {
  const mins = elapsedMinutes(order.placedAt, now);
  const overdue = mins >= order.estimatedMinutes;
  const nextStatus = NEXT_STATUS[order.status];

  return (
    <div
      style={{
        background: "#1E2420",
        border: overdue ? "1.5px solid #C24C2E" : "1.5px solid #333B34",
        borderRadius: 14,
        padding: "14px 16px",
        marginBottom: 12,
        animation: isNew ? "kd-flash 1.4s ease-in-out 2" : undefined,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
        <div>
          <div style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 15, color: "#F4F1EA" }}>
            {order.tableLabel ?? `Table token: ${order.tableToken.slice(0, 8)}`}
          </div>
          <div style={{ fontFamily: "Inter, sans-serif", fontSize: 11, color: "#8A9088", marginTop: 2 }}>
            #{order.orderId}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "4px 8px",
            borderRadius: 999,
            background: overdue ? "rgba(194,76,46,0.18)" : "rgba(255,255,255,0.06)",
            color: overdue ? "#E28A6F" : "#B8BDB5",
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
          }}
        >
          <Clock size={12} />
          {mins}m
        </div>
      </div>

      <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            fontSize: 11,
            fontWeight: 700,
            fontFamily: "Inter, sans-serif",
            color: "#B8BDB5",
            background: "rgba(255,255,255,0.06)",
            padding: "3px 8px",
            borderRadius: 999,
          }}
        >
          {order.orderType === "dine-in" ? <UtensilsCrossed size={11} /> : <ShoppingBag size={11} />}
          {order.orderType === "dine-in" ? "Dine-in" : "Takeaway"}
        </span>
      </div>

      <div style={{ borderTop: "1px solid #333B34", paddingTop: 10, marginBottom: 10 }}>
        {order.items.map((entry, i) => (
          <div
            key={i}
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "Inter, sans-serif",
              fontSize: 13,
              color: "#E5E7E1",
              marginBottom: 4,
            }}
          >
            <span>
              <strong style={{ color: "#F4F1EA" }}>{entry.quantity}×</strong> {entry.item.name}
            </span>
          </div>
        ))}
      </div>

      {order.specialInstructions && (
        <div
          style={{
            background: "rgba(201,151,31,0.14)",
            border: "1px solid rgba(201,151,31,0.3)",
            borderRadius: 8,
            padding: "8px 10px",
            marginBottom: 10,
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            color: "#E3C878",
          }}
        >
          {order.specialInstructions}
        </div>
      )}

      {nextStatus && (
        <button
          onClick={() => onAdvance(order)}
          style={{
            width: "100%",
            padding: "11px 0",
            borderRadius: 10,
            border: "none",
            background: COLUMNS.find((c) => c.status === order.status)?.accent ?? "#3A4C3B",
            color: "#fff",
            fontFamily: "Inter, sans-serif",
            fontWeight: 800,
            fontSize: 13,
            letterSpacing: "0.02em",
            cursor: "pointer",
          }}
        >
          {NEXT_LABEL[order.status]} →
        </button>
      )}
    </div>
  );
}

export default function KitchenDashboardPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [connected, setConnected] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const newOrderIds = useRef<Set<string>>(new Set());
  const [, forceRender] = useState(0);

  const loadOrders = useCallback(async () => {
    try {
      const data = await fetchOrdersForRestaurant(
        RESTAURANT_ID,
        "pending,preparing,ready"
      );
      setOrders(data);
    } catch {
      // Backend not reachable yet — board just stays empty until it is.
    }
  }, []);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  useEffect(() => {
    const socket = getSocket();
    socket.emit("join-kitchen", RESTAURANT_ID);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    const onNewOrder = (order: Order) => {
      newOrderIds.current.add(order.orderId);
      setOrders((prev) => [order, ...prev]);
      setTimeout(() => {
        newOrderIds.current.delete(order.orderId);
        forceRender((n) => n + 1);
      }, 3000);
    };

    const onStatusUpdate = (updated: Order) => {
      setOrders((prev) =>
        updated.status === "completed" || updated.status === "cancelled"
          ? prev.filter((o) => o.orderId !== updated.orderId)
          : prev.map((o) => (o.orderId === updated.orderId ? updated : o))
      );
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("new-order", onNewOrder);
    socket.on("order-status-updated", onStatusUpdate);
    setConnected(socket.connected);

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("new-order", onNewOrder);
      socket.off("order-status-updated", onStatusUpdate);
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(id);
  }, []);

  const handleAdvance = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next) return;
    // Optimistic update so it feels instant on a busy pass.
    setOrders((prev) =>
      next === "completed"
        ? prev.filter((o) => o.orderId !== order.orderId)
        : prev.map((o) => (o.orderId === order.orderId ? { ...o, status: next } : o))
    );
    try {
      await updateOrderStatus(order.orderId, next);
    } catch {
      loadOrders(); // reconcile with server if the update failed
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#141815" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
        @keyframes kd-flash {
          0%, 100% { box-shadow: 0 0 0 0 rgba(194,76,46,0); }
          50% { box-shadow: 0 0 0 4px rgba(194,76,46,0.5); }
        }
        * { box-sizing: border-box; }
      `}</style>

      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 28px",
          borderBottom: "1px solid #2A2F2A",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Flame size={24} color="#C9971F" />
          <h1 style={{ fontFamily: "Inter, sans-serif", fontWeight: 800, fontSize: 20, color: "#F4F1EA", margin: 0 }}>
            Kitchen Dashboard
          </h1>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontFamily: "Inter, sans-serif",
            fontSize: 12,
            fontWeight: 700,
            color: connected ? "#6FCF97" : "#E28A6F",
          }}
        >
          {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {connected ? "Live" : "Reconnecting…"}
        </div>
      </header>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          gap: 20,
          padding: "24px 28px",
          alignItems: "start",
        }}
      >
        {COLUMNS.map((col) => {
          const columnOrders = orders
            .filter((o) => o.status === col.status)
            .sort((a, b) => new Date(a.placedAt).getTime() - new Date(b.placedAt).getTime());

          return (
            <div key={col.status}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 14,
                  paddingBottom: 10,
                  borderBottom: `2px solid ${col.accent}`,
                }}
              >
                <span style={{ width: 8, height: 8, borderRadius: 999, background: col.accent }} />
                <h2
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontWeight: 800,
                    fontSize: 14,
                    letterSpacing: "0.03em",
                    textTransform: "uppercase",
                    color: "#F4F1EA",
                    margin: 0,
                  }}
                >
                  {col.title}
                </h2>
                <span
                  style={{
                    marginLeft: "auto",
                    fontFamily: "Inter, sans-serif",
                    fontSize: 12,
                    fontWeight: 700,
                    color: "#8A9088",
                  }}
                >
                  {columnOrders.length}
                </span>
              </div>

              {columnOrders.length === 0 ? (
                <div
                  style={{
                    fontFamily: "Inter, sans-serif",
                    fontSize: 13,
                    color: "#5A605A",
                    padding: "24px 0",
                    textAlign: "center",
                  }}
                >
                  No orders
                </div>
              ) : (
                columnOrders.map((order) => (
                  <OrderCard
                    key={order.orderId}
                    order={order}
                    now={now}
                    isNew={newOrderIds.current.has(order.orderId)}
                    onAdvance={handleAdvance}
                  />
                ))
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
