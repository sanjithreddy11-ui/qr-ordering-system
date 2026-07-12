"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BackgroundDecor from "@/components/customer/BackgroundDecor";
import OrderSummaryRow from "@/components/customer/OrderSummaryRow";
import { useSessionStore } from "@/store/session-store";
import { fetchOrdersBySession } from "@/lib/api";
import type { Order } from "@/types/order";
import BackgroundDecor2 from "@/components/customer/BackgroundDecor2";
import { Receipt } from "lucide-react";

export default function PastOrdersPage() {
  const { sessionId } = useSessionStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    fetchOrdersBySession(sessionId)
      .then((data) => setOrders(data.past))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [sessionId]);

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-8">
      <BackgroundDecor2 />

      <div className="relative z-10 mx-auto max-w-[480px] px-4 pt-8">
        <h1 className="font-display mb-1 text-3xl font-semibold text-text-primary">Past Orders</h1>
        <p className="font-body mb-6 text-sm text-text-secondary">Completed orders from your current visit</p>

        {loading && <p className="font-body text-sm text-text-secondary">Loading…</p>}

        {!loading && orders.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center py-16 text-center">
           <div className="mb-3">
  <Receipt
    size={56}
    className="mx-auto"
    style={{ color: "var(--gold-accent)" }}
  />
</div>
            <p className="font-body text-sm text-text-secondary">No past orders yet.</p>
          </motion.div>
        )}

        {orders.map((order) => (
          <OrderSummaryRow key={order.orderId} order={order} />
        ))}
      </div>
    </main>
  );
}
