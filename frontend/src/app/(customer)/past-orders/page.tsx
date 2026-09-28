"use client";

import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import BackgroundDecor from "@/components/customer/BackgroundDecor";
import OrderSummaryRow from "@/components/customer/OrderSummaryRow";
import { useSessionStore } from "@/store/session-store";
import { fetchOrdersBySession, fetchCustomerOrderHistory, ApiRequestError } from "@/lib/api";
import { useVisitAuthStore } from "@/store/visit-auth-store";
import type { Order } from "@/types/order";
import { Receipt } from "lucide-react";

export default function PastOrdersPage() {
  const { sessionId } = useSessionStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    (async () => {
      await Promise.resolve(useVisitAuthStore.persist.rehydrate());
      const { visitToken, phone } = useVisitAuthStore.getState();
      try {
        // Authenticated customer: full history across ALL visits (backend
        // only serves this for an ACTIVE visit and only for that phone).
        if (visitToken && phone) {
          try {
            const history = await fetchCustomerOrderHistory(phone, visitToken);
            if (!cancelled) {
              setOrders(history.filter((o) => o.status === "completed" || o.status === "cancelled"));
              setAuthed(true);
            }
            return;
          } catch (err) {
            if (err instanceof ApiRequestError && err.status === 401) {
              useVisitAuthStore.getState().clearVisit();
            }
          }
        }
        // Fallback: orders from this browsing session only.
        const data = await fetchOrdersBySession(sessionId);
        if (!cancelled) setOrders(data.past);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  return (
   <main
      className="relative min-h-dvh overflow-x-hidden pb-10"
      style={{
        backgroundImage: "url('/new-assets/paper-texture.webp')",
        backgroundRepeat: "repeat",
        backgroundSize: "480px auto",
        backgroundColor: "var(--bg-primary)",
      }}
    >

      <div className="relative z-10 mx-auto max-w-[480px] px-4 pt-8">
        <h1 className="font-display mb-1 text-3xl font-semibold text-text-primary">Past Orders</h1>
        <p className="font-body mb-6 text-sm text-text-secondary">{authed ? "Your completed orders from all visits" : "Completed orders from your current visit"}</p>

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
