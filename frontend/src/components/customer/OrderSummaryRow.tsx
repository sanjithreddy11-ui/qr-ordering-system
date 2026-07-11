"use client";

import React from "react";
import { Clock, UtensilsCrossed, ShoppingBag } from "lucide-react";
import type { Order, OrderStatus } from "@/types/order";

const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Order Received",
  preparing: "Preparing",
  ready: "Ready to Serve",
  completed: "Completed",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<OrderStatus, string> = {
  pending: "#C9971F",
  preparing: "#C9971F",
  ready: "#2E7D4F",
  completed: "#2E7D4F",
  cancelled: "#C24C2E",
};

const glassCardStyle: React.CSSProperties = {
  background: "rgba(255,255,255,0.55)",
  border: "1px solid rgba(255,255,255,0.4)",
  boxShadow: "0 8px 24px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.7)",
  backdropFilter: "blur(12px)",
  WebkitBackdropFilter: "blur(12px)",
  borderRadius: 24,
  padding: "16px",
};

export default function OrderSummaryRow({ order }: { order: Order }) {
  return (
    <div style={{ ...glassCardStyle, marginBottom: 12 }}>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-body text-xs font-bold text-text-secondary">#{order.orderId}</span>
        <span
          className="font-body flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ background: `${STATUS_COLOR[order.status]}1A`, color: STATUS_COLOR[order.status] }}
        >
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: STATUS_COLOR[order.status] }} />
          {STATUS_LABEL[order.status]}
        </span>
      </div>

      <div className="mb-2 flex items-center gap-2 text-[11px] text-text-secondary">
        {order.orderType === "dine-in" ? <UtensilsCrossed size={12} /> : <ShoppingBag size={12} />}
        <span className="font-body">{order.orderType === "dine-in" ? "Dine In" : "Takeaway"}</span>
        <span>·</span>
        <Clock size={12} />
        <span className="font-body">
          {new Date(order.placedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      <div className="border-t border-border-soft/50 pt-2">
        {order.items.map((e) => (
          <div key={e.item.id} className="font-body flex justify-between text-[13px] text-text-primary">
            <span>{e.quantity} × {e.item.name}</span>
            <span>₹ {e.item.price * e.quantity}</span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex justify-between border-t border-border-soft/50 pt-2 text-sm font-bold">
        <span className="font-body text-text-primary">Total</span>
        <span className="font-body text-text-primary">₹ {order.totalAmount}</span>
      </div>
    </div>
  );
}
