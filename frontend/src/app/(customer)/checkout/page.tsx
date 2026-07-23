"use client";
import {
  UtensilsCrossed,
  ShoppingBag,
} from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCartStore } from "@/store/cart-store";
import { useOrderStore } from "@/store/order-store";
import { useSessionStore } from "@/store/session-store";
import { CheckoutForm, PaymentMethod } from "@/types/order";
import { placeOrder, createRazorpayOrder, verifyRazorpayPayment } from "@/lib/api";
import { loadRazorpayCheckout, RazorpaySuccessResponse } from "@/lib/razorpay";
import CartBackground from "@/components/customer/CartBackground";
import OrderSummaryCard from "@/components/customer/OrderSummaryCard";
import PaymentMethodSelector from "@/components/customer/PaymentMethodSelector";

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, taxAmount, totalAmount, clearCart } = useCartStore();
  const {
    sessionId,
    restaurantId: sessionRestaurantId,
    tableToken: sessionTableToken,
  } = useSessionStore();
  const restaurantId = sessionRestaurantId ?? "cafe-001";
  const tableToken = sessionTableToken ?? "tbl_demo01";

  const sub = subtotal();
  const tax = taxAmount();
  const total = totalAmount();

  const [form, setForm] = useState<CheckoutForm>({
    customerName: "",
    customerPhone: "",
    orderType: "dine-in",
    specialInstructions: "",
    paymentMethod: "upi",
  });
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setOrder = useOrderStore((s) => s.setOrder);

  const handlePlaceOrder = async () => {
    if (!sessionId) {
      setError("Your session couldn't be found. Please go back to the menu and try again.");
      return;
    }
    const name = form.customerName.trim();
    const phone = form.customerPhone.trim();
    if ((name && !phone) || (phone && !name)) {
      setError("Please enter both your name and phone number, or leave both blank.");
      return;
    }
    if (phone && !/^\d{7,15}$/.test(phone)) {
      setError("Please enter a valid phone number.");
      return;
    }

    setPlacing(true);
    setError(null);

    const orderPayload = {
      sessionId,
      restaurantId,
      tableToken,
      items: items.map((e) => ({ id: e.item.id, quantity: e.quantity })),
      orderType: form.orderType,
      specialInstructions: form.specialInstructions,
      paymentMethod: form.paymentMethod,
      customerName: name || undefined,
      customerPhone: phone || undefined,
    };

    // Cash stays "pay at counter" — unchanged, creates the order right away.
    if (form.paymentMethod === "cash") {
      try {
        const order = await placeOrder(orderPayload);
        setOrder(order);
        router.push("/order-success");
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Couldn't place your order. Please try again."
        );
        setPlacing(false);
      }
      return;
    }

    // UPI / Card pay online via Razorpay Standard Checkout. The order is
    // only created after the payment is verified server-side (see
    // handlePaymentSuccess below) — never on the frontend's say-so.
    try {
      const scriptReady = await loadRazorpayCheckout();
      if (!scriptReady) {
        setError("Couldn't load the payment gateway. Please check your connection and try again.");
        setPlacing(false);
        return;
      }

      const { razorpayOrderId, amount, currency, keyId } = await createRazorpayOrder(orderPayload);

      const handlePaymentSuccess = async (response: RazorpaySuccessResponse) => {
        try {
          const order = await verifyRazorpayPayment({
            razorpay_order_id: response.razorpay_order_id,
            razorpay_payment_id: response.razorpay_payment_id,
            razorpay_signature: response.razorpay_signature,
          });
          setOrder(order);
          router.push("/order-success");
        } catch (err) {
          setError(
            err instanceof Error
              ? err.message
              : "We couldn't confirm your payment. If you were charged, please show this screen to staff."
          );
          setPlacing(false);
        }
      };

      const razorpayCheckout = new window.Razorpay({
        key: keyId,
        amount,
        currency,
        name: "SmartQR",
        description: `Order for ${form.orderType === "dine-in" ? "Table" : "Takeaway"}`,
        order_id: razorpayOrderId,
        prefill: { name: name || undefined, contact: phone || undefined },
        theme: { color: "#3A4C3B" },
        method: { upi: form.paymentMethod === "upi", card: form.paymentMethod === "card" },
        handler: handlePaymentSuccess,
        modal: {
          ondismiss: () => setPlacing(false),
        },
      });

      razorpayCheckout.on("payment.failed", (resp) => {
        setError(resp.error?.description || "Payment failed. Please try again.");
        setPlacing(false);
      });

      razorpayCheckout.open();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't start payment. Please try again."
      );
      setPlacing(false);
    }
  };

  const backToMenuHref = `/${restaurantId}/menu`;

  const glassCardStyle: React.CSSProperties = {
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.4)",
    boxShadow:
      "0 8px 24px rgba(0,0,0,0.06), inset 0 1px 1px rgba(255,255,255,0.7)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    borderRadius: 28,
    padding: "20px",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    fontWeight: 700,
    color: "#1C1C1C",
    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    display: "block",
    marginBottom: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "rgba(255,255,255,0.5)",
    border: "1px solid #E7E1D6",
    borderRadius: 18,
    padding: "12px 14px",
    fontSize: 14,
    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
    color: "#1C1C1C",
    outline: "none",
    boxSizing: "border-box",
    backdropFilter: "blur(8px)",
    WebkitBackdropFilter: "blur(8px)",
  };

  // Empty cart guard — matches Cart page empty state
  if (items.length === 0) {
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
          <div style={{ fontSize: 48, marginBottom: 16 }}>🛒</div>
          <div
            style={{
              fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
              fontSize: 22,
              fontWeight: 700,
              color: "#1C1C1C",
              marginBottom: 8,
            }}
          >
            Nothing to checkout
          </div>
          <div style={{ fontSize: 13, color: "#666666", marginBottom: 28 }}>
            Your cart is empty.
          </div>
          <button
            onClick={() => router.push(backToMenuHref)}
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
            ← Back to Menu
          </button>
        </div>
      </div>
    );
  }

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
        textarea:focus, input:focus { border-color: #3A4C3B !important; }
        textarea { resize: none; }
        textarea::placeholder { color: #999; }
      `}</style>

      <div style={{ position: "relative", zIndex: 1 }}>
        {/* Header — matches cart page header exactly */}
        <div
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "16px 16px 12px",
          }}
        >
          <button
            onClick={() => router.back()}
            style={{
              width: 38,
              height: 38,
              borderRadius: "50%",
              background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
              border: "1px solid rgba(255,255,255,0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              fontSize: 18,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 6px 16px rgba(38,52,41,0.3)",
            }}
          >
            ←
          </button>
          <div>
            <h1
              style={{
                margin: 0,
                fontFamily: "var(--font-display, 'Cormorant Garamond', serif)",
                fontSize: 22,
                fontWeight: 700,
                color: "#1C1C1C",
              }}
            >
              Checkout
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "#666666",
                fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
              }}
            >
              Review and place your order
            </p>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 14,
            padding: "12px 16px 0",
          }}
        >
          {/* Order Summary */}
          <OrderSummaryCard
            items={items}
            subtotal={sub}
            taxAmount={tax}
            totalAmount={total}
          />

          {/* Your Details — used for order updates and our Top Customers program; optional */}
          <div style={glassCardStyle}>
            <p style={labelStyle}>Your Details (optional)</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <input
                type="text"
                placeholder="Your name"
                value={form.customerName}
                onChange={(e) =>
                  setForm((f: CheckoutForm) => ({ ...f, customerName: e.target.value }))
                }
                style={inputStyle}
              />
              <input
                type="tel"
                placeholder="Phone number"
                value={form.customerPhone}
                onChange={(e) =>
                  setForm((f: CheckoutForm) => ({
                    ...f,
                    customerPhone: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
                style={inputStyle}
              />
            </div>
          </div>

          {/* Order Type — dine-in vs takeaway only, no table input */}
          <div style={glassCardStyle}>
            <p style={labelStyle}>Order Details</p>
            <div style={{ display: "flex", gap: 10 }}>
              {(["dine-in", "takeaway"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() =>
                    setForm((f: CheckoutForm) => ({
                      ...f,
                      orderType: type,
                    }))
                  }
                  style={{
                    flex: 1,
                    padding: "11px 0",
                    borderRadius: 16,
                    border: "1px solid",
                    borderColor:
                      form.orderType === type
                        ? "transparent"
                        : "#E7E1D6",
                    background:
                      form.orderType === type
                        ? "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)"
                        : "rgba(255,255,255,0.5)",
                    color: form.orderType === type ? "#FFFFFF" : "#475A47",
                    fontSize: 13,
                    fontWeight: 700,
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    cursor: "pointer",
                    transition: "all 0.18s ease",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    boxShadow:
                      form.orderType === type
                        ? "0 6px 16px rgba(38,52,41,0.25)"
                        : "none",
                  }}
                >
                  {type === "dine-in" ? (
                    <>
                      <UtensilsCrossed size={16} />
                      Dine In
                    </>
                  ) : (
                    <>
                      <ShoppingBag size={16} />
                      Takeaway
                    </>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Special Instructions */}
          <div style={glassCardStyle}>
            <label style={labelStyle}>Special Instructions</label>
            <textarea
              rows={3}
              placeholder="Allergies, spice level, extra napkins…"
              value={form.specialInstructions}
              onChange={(e) =>
                setForm((f: CheckoutForm) => ({
                  ...f,
                  specialInstructions: e.target.value,
                }))
              }
              style={{ ...inputStyle, lineHeight: 1.55 }}
            />
          </div>

          {/* Payment Method */}
          <div style={glassCardStyle}>
            <p style={labelStyle}>Payment Method</p>
            <PaymentMethodSelector
              selected={form.paymentMethod}
              onChange={(method: PaymentMethod) =>
                setForm((f: CheckoutForm) => ({ ...f, paymentMethod: method }))
              }
            />
          </div>

          {error && (
            <div
              style={{
                ...glassCardStyle,
                padding: "14px 16px",
                background: "rgba(255, 235, 235, 0.7)",
                border: "1px solid rgba(220,80,80,0.3)",
                color: "#8a2b2b",
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Place Order — identical style to cart's View Cart button */}
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
          whileTap={{ scale: placing ? 1 : 0.97 }}
          onClick={handlePlaceOrder}
          disabled={placing}
          style={{
            width: "100%",
            background: placing
              ? "linear-gradient(135deg, #55665A 0%, #3A473C 100%)"
              : "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            padding: "16px 24px",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.3px",
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            cursor: placing ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 12px 32px rgba(38,52,41,0.35)",
            transition: "background 0.2s ease",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.8 }}>₹ {total}</span>
          <span>{placing ? "Placing Order…" : "Place Order →"}</span>
          <span style={{ width: 48 }} />
        </motion.button>
      </div>
    </div>
  );
}
