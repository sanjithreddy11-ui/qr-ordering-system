"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock3,
  Receipt,
  UtensilsCrossed,
  ShoppingBag,
  CreditCard,
} from "lucide-react";
import { useOrderStore } from "@/store/order-store";
import { OrderItem, Order, OrderStatus } from "@/types/order";
import { getSocket } from "@/lib/socket";
import CartBackground from "@/components/customer/CartBackground";

const PAYMENT_LABELS: Record<string, string> = {
  upi: "UPI",
  cash: "Cash",
  card: "Card",
};

// Live kitchen status shown as a small pill in the hero. Colors are tuned
// against the dark green hero gradient so they stay legible there.
const STATUS_META: Record<OrderStatus, { label: string; dot: string }> = {
  pending: { label: "Order Received", dot: "#F4C542" },
  preparing: { label: "Preparing", dot: "#F4C542" },
  ready: { label: "Ready to Serve", dot: "#6FCF97" },
  completed: { label: "Completed", dot: "#6FCF97" },
  cancelled: { label: "Cancelled", dot: "#E27D60" },
};

export default function OrderSuccessPage() {
  const router = useRouter();
  const { currentOrder, updateStatus, clearOrder } = useOrderStore();
  const [showItems, setShowItems] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setShowItems(true), 900);
    return () => clearTimeout(t);
  }, []);

  // Join this order's Socket.io room so status changes made on the kitchen
  // dashboard (Preparing → Ready → Completed) reflect here live, no refresh.
  useEffect(() => {
    if (!currentOrder) return;
    const socket = getSocket();
    socket.emit("join-order", currentOrder.orderId);

    const onUpdate = (updated: Order) => {
      if (updated.orderId === currentOrder.orderId) {
        updateStatus(updated.status);
      }
    };
    socket.on("order-status-updated", onUpdate);

    return () => {
      socket.emit("leave-order", currentOrder.orderId);
      socket.off("order-status-updated", onUpdate);
    };
  }, [currentOrder?.orderId, updateStatus]);

  const glassCardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.4)",
    boxShadow:
      "0 8px 24px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 28,
    padding: "16px",
  };

  if (!currentOrder) {
    return (
      <div
        style={{
          position: "relative",
          minHeight: "100vh",
          width: "100%",
          maxWidth: 480,
          margin: "0 auto",
          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
          overflow: "hidden",
        }}
      >
        <CartBackground />
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap');
          * { box-sizing: border-box; }
        `}</style>
        <div
          style={{
            position: "relative",
            zIndex: 1,
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 24px",
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤔</div>
          <div
            style={{
              fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
              fontSize: 22,
              fontWeight: 700,
              color: "#1C1C1C",
              marginBottom: 24,
            }}
          >
            No order found
          </div>
          <button
            onClick={() => router.push("/")}
            style={{
              background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "13px 28px",
              fontSize: 14,
              fontWeight: 700,
              cursor: "pointer",
              letterSpacing: "0.3px",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              boxShadow: "0 8px 20px rgba(38,52,41,0.3)",
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  const {
    orderId,
    restaurantId,
    items,
    totalAmount,
    orderType,
    paymentMethod,
    estimatedMinutes,
    status,
  } = currentOrder;

  const statusMeta = STATUS_META[status] ?? STATUS_META.pending;

  const metaItems = [
    {
      label: "Order Type",
      icon:
        orderType === "dine-in" ? (
          <UtensilsCrossed size={18} strokeWidth={2} className="text-green-primary" />
        ) : (
          <ShoppingBag size={18} strokeWidth={2} className="text-green-primary" />
        ),
      value: orderType === "dine-in" ? "Dine In" : "Takeaway",
    },
    {
      label: "Payment",
      icon: <CreditCard size={18} strokeWidth={2} className="text-green-primary" />,
      value: PAYMENT_LABELS[paymentMethod] ?? paymentMethod,
    },
    {
      label: "Total Paid",
      icon: null,
      value: `₹ ${totalAmount}`,
    },
    {
      label: "Order ID",
      icon: null,
      value: orderId,
    },
  ];

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        width: "100%",
        maxWidth: 480,
        margin: "0 auto",
        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
        paddingBottom: 120,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <CartBackground />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @keyframes status-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Hero block */}
        <div
          style={{
            background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
            borderRadius: "0 0 28px 28px",
            padding: "52px 24px 36px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            textAlign: "center",
            boxShadow: "0 12px 32px rgba(38,52,41,0.25)",
          }}
        >
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 320, damping: 22, delay: 0.1 }}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              border: "2px solid rgba(255,255,255,0.25)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 34,
              marginBottom: 20,
              color: "#fff",
            }}
          >
            ✓
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            style={{
              margin: "0 0 8px",
              fontSize: 28,
              fontWeight: 700,
              color: "#FFFFFF",
              fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
            }}
          >
            Order Placed!
          </motion.h1>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38 }}
            style={{
              margin: "0 0 20px",
              fontSize: 13,
              color: "rgba(255,255,255,0.65)",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            }}
          >
            We&apos;ve received your order and the kitchen is on it.
          </motion.p>

          {/* Live status pill — updates in real time via Socket.io */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.42 }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              background: "rgba(255,255,255,0.14)",
              border: "1px solid rgba(255,255,255,0.25)",
              borderRadius: 20,
              padding: "7px 16px 7px 12px",
              fontSize: 12,
              fontWeight: 700,
              color: "#FFFFFF",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              letterSpacing: "0.03em",
              marginBottom: 12,
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: statusMeta.dot,
                animation:
                  status === "pending" || status === "preparing"
                    ? "status-pulse 1.6s ease-in-out infinite"
                    : undefined,
              }}
            />
            {statusMeta.label}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 }}
            style={{
              background: "rgba(255,255,255,0.1)",
              border: "1px solid rgba(255,255,255,0.2)",
              borderRadius: 20,
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 700,
              color: "#FFFFFF",
              fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              letterSpacing: "0.08em",
            }}
          >
            {orderId}
          </motion.div>
        </div>

        <div
          style={{
            padding: "16px 16px 0",
            display: "flex",
            flexDirection: "column",
            gap: 14,
          }}
        >
          {/* ETA card */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            style={{ ...glassCardStyle, display: "flex", gap: 14 }}
          >
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 16,
                flexShrink: 0,
                background: "rgba(50,66,52,0.1)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Clock3 size={32} strokeWidth={1.8} className="text-green-primary" />
            </div>
            <div>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "#666666",
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  marginBottom: 3,
                }}
              >
                Estimated Time
              </div>
              <div
                style={{
                  fontSize: 22,
                  fontWeight: 800,
                  color: "#1C1C1C",
                  fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                }}
              >
                {estimatedMinutes} min
              </div>
            </div>
          </motion.div>

          {/* Order meta grid */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65 }}
            style={{
              ...glassCardStyle,
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "14px 12px",
            }}
          >
            {metaItems.map(({ label, icon, value }) => (
              <div key={label}>
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#666666",
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    marginBottom: 4,
                  }}
                >
                  {label}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#1C1C1C",
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    wordBreak: "break-all",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {icon}
                  <span>{value}</span>
                </div>
              </div>
            ))}
          </motion.div>

          {/* Items ordered */}
          <AnimatePresence>
            {showItems && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35 }}
                style={{ ...glassCardStyle, padding: 0, overflow: "hidden" }}
              >
                <div
                  style={{
                    padding: "14px 16px 10px",
                    borderBottom: "1px solid #E7E1D6",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <Receipt size={18} strokeWidth={2} className="text-green-primary" />
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: "#1C1C1C",
                      fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                    }}
                  >
                    Items Ordered
                  </span>
                </div>

                {items.map((entry: OrderItem, i: number) => (
                  <div
                    key={entry.item.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "11px 16px",
                      borderBottom:
                        i < items.length - 1 ? "1px solid #F0EBE0" : "none",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          width: 12,
                          height: 12,
                          borderRadius: 2,
                          flexShrink: 0,
                          border: `2px solid ${
                            entry.item.diet === "veg" ? "#4CAF50" : "#F44336"
                          }`,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <div
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: "50%",
                            background:
                              entry.item.diet === "veg" ? "#4CAF50" : "#F44336",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 600,
                          color: "#1C1C1C",
                          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {entry.item.name}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "#666666",
                          fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                          flexShrink: 0,
                        }}
                      >
                        × {entry.quantity}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: "#1C1C1C",
                        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                        flexShrink: 0,
                        marginLeft: 12,
                      }}
                    >
                      ₹ {entry.item.price * entry.quantity}
                    </span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Sticky Back to Menu */}
      <div
        style={{
          position: "fixed",
          bottom: 16,
          left: 0,
          right: 0,
          margin: "0 auto",
          width: "calc(100% - 32px)",
          maxWidth: 448,
          zIndex: 999,
        }}
      >
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => {
            router.push(`/${restaurantId ?? "lifafa"}/menu`);
          }}
          style={{
            width: "100%",
            background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            padding: "16px 24px",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.3px",
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            cursor: "pointer",
            boxShadow: "0 12px 32px rgba(38,52,41,0.35)",
          }}
        >
          ← Back to Menu
        </motion.button>
      </div>
    </div>
  );
}
