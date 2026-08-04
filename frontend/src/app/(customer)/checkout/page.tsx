"use client";
import {
  UtensilsCrossed,
  ShoppingBag,
  Wallet,
  CheckCircle2,
  Loader2,
  Pencil,
} from "lucide-react";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCartStore } from "@/store/cart-store";
import { useOrderStore } from "@/store/order-store";
import { useSessionStore } from "@/store/session-store";
import { useBuildCustomerUrl } from "@/lib/customer-nav";
import { RESTAURANT_ID } from "@/constants/restaurant";
import { CheckoutForm } from "@/types/order";
import { placeOrder } from "@/lib/api";
import { usePhoneAuth } from "@/hooks/usePhoneAuth";
import CartBackground from "@/components/customer/CartBackground";
import OrderSummaryCard from "@/components/customer/OrderSummaryCard";

const PHONE_REGEX = /^\d{10}$/; // 10-digit local number; sent to 2Factor as 91XXXXXXXXXX

export default function CheckoutPage() {
  const router = useRouter();
  const buildCustomerUrl = useBuildCustomerUrl();
  const { items, subtotal, taxAmount, totalAmount, clearCart } = useCartStore();
  const {
    sessionId,
    restaurantId: sessionRestaurantId,
    tableToken: sessionTableToken,
  } = useSessionStore();
  const restaurantId = sessionRestaurantId ?? RESTAURANT_ID;
  const tableToken = sessionTableToken ?? "";

  const sub = subtotal();
  const tax = taxAmount();
  const total = totalAmount();

  const [form, setForm] = useState<CheckoutForm>({
    customerName: "",
    customerPhone: "",
    orderType: "dine-in",
    specialInstructions: "",
    paymentMethod: "cash",
  });
  const [otp, setOtp] = useState("");
  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const phoneAuth = usePhoneAuth();

  const setOrder = useOrderStore((s) => s.setOrder);

  const name = form.customerName.trim();
  const phone = form.customerPhone.trim();
  const phoneVerified = phoneAuth.status === "verified";
  // Locked once verification succeeds — "Change number" resets both the
  // OTP confirmation and this lock.
  const phoneLocked = phoneVerified;
  // Customer must complete OTP verification before
  // Place Order becomes available — no bypass path.
  const canPlaceOrder = Boolean(name) && phoneVerified && Boolean(phoneAuth.verificationToken);

  const handlePlaceOrder = async () => {
    if (!sessionId) {
      setError("Your session couldn't be found. Please go back to the menu and try again.");
      return;
    }
    if (!name) {
      setError("Please enter your name.");
      return;
    }
    if (!phoneVerified || !phoneAuth.verificationToken) {
      setError("Please verify your phone number before placing your order.");
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
      customerName: name,
      customerPhone: phone,
    };

    // Cash only — "pay at counter", creates the order right away. The
    // phone verification token proves OTP ownership; the backend
    // re-checks it against the phone before creating the order.
    try {
      const order = await placeOrder(orderPayload, phoneAuth.verificationToken);
      setOrder(order);
      router.push(buildCustomerUrl("/order-success"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't place your order. Please try again."
      );
      setPlacing(false);
    }
  };

  const handleSendOtp = () => {
    if (!PHONE_REGEX.test(phone)) return;
    phoneAuth.sendOtp(phone);
  };

  const handleVerifyOtp = () => {
    if (otp.trim().length !== 6) return;
    phoneAuth.verifyOtp(otp.trim());
  };

  const handleChangeNumber = () => {
    phoneAuth.reset();
    setOtp("");
  };

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
            onClick={() => router.push(buildCustomerUrl("/menu"))}
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
        .spin { animation: checkout-spin 0.8s linear infinite; }
        @keyframes checkout-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
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

          {/* Your Details — phone must be verified via OTP before
              Place Order is enabled below. */}
          <div style={glassCardStyle}>
            <p style={labelStyle}>Your Details</p>
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

              <div style={{ display: "flex", gap: 8 }}>
                <input
                  type="tel"
                  placeholder="10-digit phone number"
                  value={form.customerPhone}
                  disabled={phoneLocked}
                  onChange={(e) =>
                    setForm((f: CheckoutForm) => ({
                      ...f,
                      customerPhone: e.target.value.replace(/[^\d]/g, "").slice(0, 10),
                    }))
                  }
                  style={{
                    ...inputStyle,
                    flex: 1,
                    opacity: phoneLocked ? 0.7 : 1,
                    background: phoneLocked ? "rgba(240,245,240,0.6)" : inputStyle.background,
                  }}
                />
                {phoneVerified && (
                  <button
                    type="button"
                    onClick={handleChangeNumber}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "0 14px",
                      borderRadius: 18,
                      border: "1px solid #E7E1D6",
                      background: "rgba(255,255,255,0.5)",
                      color: "#475A47",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <Pencil size={13} />
                    Edit
                  </button>
                )}
                {!phoneVerified && phoneAuth.status !== "sent" && phoneAuth.status !== "verifying" && (
                  <button
                    type="button"
                    onClick={handleSendOtp}
                    disabled={!PHONE_REGEX.test(phone) || phoneAuth.status === "sending"}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "0 16px",
                      borderRadius: 18,
                      border: "none",
                      background:
                        !PHONE_REGEX.test(phone) || phoneAuth.status === "sending"
                          ? "linear-gradient(135deg, #97A399 0%, #7C8A7E 100%)"
                          : "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                      cursor:
                        !PHONE_REGEX.test(phone) || phoneAuth.status === "sending"
                          ? "not-allowed"
                          : "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {phoneAuth.status === "sending" ? (
                      <>
                        <Loader2 size={13} className="spin" />
                        Sending…
                      </>
                    ) : (
                      "Send OTP"
                    )}
                  </button>
                )}
              </div>

              {/* Phone Verified success state */}
              {phoneVerified && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "10px 14px",
                    borderRadius: 16,
                    background: "rgba(58,76,59,0.1)",
                    color: "#2C3A2D",
                    fontSize: 12,
                    fontWeight: 700,
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                  }}
                >
                  <CheckCircle2 size={16} color="#3A4C3B" />
                  Phone Verified
                </div>
              )}

              {/* OTP entry — only shown once an OTP has actually been sent */}
              {!phoneVerified && phoneAuth.status !== "idle" && phoneAuth.status !== "sending" && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      maxLength={6}
                      onChange={(e) => setOtp(e.target.value.replace(/[^\d]/g, "").slice(0, 6))}
                      style={{ ...inputStyle, flex: 1, letterSpacing: "0.3em" }}
                    />
                    <button
                      type="button"
                      onClick={handleVerifyOtp}
                      disabled={otp.length !== 6 || phoneAuth.status === "verifying"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "0 16px",
                        borderRadius: 18,
                        border: "none",
                        background:
                          otp.length !== 6 || phoneAuth.status === "verifying"
                            ? "linear-gradient(135deg, #97A399 0%, #7C8A7E 100%)"
                            : "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                        cursor:
                          otp.length !== 6 || phoneAuth.status === "verifying"
                            ? "not-allowed"
                            : "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {phoneAuth.status === "verifying" ? (
                        <>
                          <Loader2 size={13} className="spin" />
                          Verifying…
                        </>
                      ) : (
                        "Verify OTP"
                      )}
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={phoneAuth.resendOtp}
                    disabled={phoneAuth.resendSeconds > 0}
                    style={{
                      alignSelf: "flex-start",
                      background: "none",
                      border: "none",
                      padding: 0,
                      fontSize: 12,
                      fontWeight: 700,
                      fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                      color: phoneAuth.resendSeconds > 0 ? "#999" : "#3A4C3B",
                      cursor: phoneAuth.resendSeconds > 0 ? "not-allowed" : "pointer",
                      textDecoration: phoneAuth.resendSeconds > 0 ? "none" : "underline",
                    }}
                  >
                    {phoneAuth.resendSeconds > 0
                      ? `Resend OTP in ${phoneAuth.resendSeconds}s`
                      : "Resend OTP"}
                  </button>
                </div>
              )}

              {phoneAuth.error && (
                <div style={{ fontSize: 12, fontWeight: 600, color: "#8a2b2b" }}>
                  {phoneAuth.error}
                </div>
              )}
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

          {/* Payment Method — cash only */}
          <div style={glassCardStyle}>
            <p style={labelStyle}>Payment Method</p>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                padding: "12px 4px",
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  background: "rgba(255,255,255,0.7)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Wallet size={20} color="#324234" />
              </div>
              <div>
                <div
                  style={{
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: "#1C1C1C",
                  }}
                >
                  Cash/ Upi / Card
                </div>
                <div
                  style={{
                    fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
                    fontSize: 12,
                    color: "#666666",
                    marginTop: 2,
                  }}
                >
                  Pay at Table
                </div>
              </div>
            </div>
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
          whileTap={{ scale: placing || !canPlaceOrder ? 1 : 0.97 }}
          onClick={handlePlaceOrder}
          disabled={placing || !canPlaceOrder}
          style={{
            width: "100%",
            background:
              placing || !canPlaceOrder
                ? "linear-gradient(135deg, #97A399 0%, #7C8A7E 100%)"
                : "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
            color: "#FFFFFF",
            border: "none",
            borderRadius: 999,
            padding: "16px 24px",
            fontSize: 15,
            fontWeight: 700,
            letterSpacing: "0.3px",
            fontFamily: "var(--font-body, 'Inter', system-ui, sans-serif)",
            cursor: placing || !canPlaceOrder ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            boxShadow: "0 12px 32px rgba(38,52,41,0.35)",
            transition: "background 0.2s ease",
          }}
        >
          <span style={{ fontSize: 13, opacity: 0.8 }}>₹ {total}</span>
          <span>
            {placing
              ? "Placing Order…"
              : !canPlaceOrder
              ? "Verify Phone to Continue"
              : "Place Order →"}
          </span>
          <span style={{ width: 48 }} />
        </motion.button>
      </div>
    </div>
  );
}
