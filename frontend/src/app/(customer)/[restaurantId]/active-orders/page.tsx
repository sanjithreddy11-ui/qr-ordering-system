"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import BackgroundDecor from "@/components/customer/BackgroundDecor";
import OrderSummaryRow from "@/components/customer/OrderSummaryRow";
import { useSessionStore } from "@/store/session-store";
import { useBuildCustomerUrl } from "@/lib/customer-nav";
import { fetchOrdersBySession } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import type { Order } from "@/types/order";
import BackgroundDecor2 from "@/components/customer/BackgroundDecor2";
import { UtensilsCrossed } from "lucide-react";

export default function ActiveOrdersPage() {
  const router = useRouter();
  const buildCustomerUrl = useBuildCustomerUrl();
  const { sessionId } = useSessionStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    if (!sessionId) return;
    fetchOrdersBySession(sessionId)
      .then((data) => setOrders(data.active))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live updates: join this session's room so newly placed orders and
  // status changes from the kitchen show up here instantly.
  useEffect(() => {
    if (!sessionId) return;
    const socket = getSocket();
    socket.emit("join-session", sessionId);

    const upsert = (updated: Order) => {
      if (updated.sessionId !== sessionId) return;
      setOrders((prev) => {
        const isActive = ["pending", "preparing", "ready"].includes(updated.status);
        const withoutThis = prev.filter((o) => o.orderId !== updated.orderId);
        return isActive ? [updated, ...withoutThis] : withoutThis;
      });
    };

    socket.on("new-order", upsert);
    socket.on("order-status-updated", upsert);

    return () => {
      socket.emit("leave-session", sessionId);
      socket.off("new-order", upsert);
      socket.off("order-status-updated", upsert);
    };
  }, [sessionId]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-8">
      <BackgroundDecor2 />

      <div className="relative z-10 mx-auto max-w-[480px] px-4 pt-8">
        <h1 className="font-display mb-1 text-3xl font-semibold text-text-primary">Active Orders</h1>
        <p className="font-body mb-6 text-sm text-text-secondary">Orders from your current visit</p>

        {loading && <p className="font-body text-sm text-text-secondary">Loading…</p>}

        {!loading && orders.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-center">
            <div className="mb-3">
  <UtensilsCrossed
    size={56}
    className="mx-auto"
    style={{ color: "var(--gold-accent)" }}
  />
</div>
            <p className="font-body mb-6 text-sm text-text-secondary">No active orders right now.</p>
            <button
              onClick={() => router.push(buildCustomerUrl("/menu"))}
              className="font-body rounded-full px-6 py-3 text-sm font-semibold text-bg-primary shadow-lg"
              style={{ background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)" }}
            >
              Browse Menu
            </button>
          </motion.div>
        )}

        {orders.map((order) => (
          <OrderSummaryRow key={order.orderId} order={order} />
        ))}
      </div>
    </main>
  );
}
