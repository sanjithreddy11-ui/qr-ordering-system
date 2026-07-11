"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { useCartStore } from "@/store/cart-store";
import { useBuildCustomerUrl } from "@/lib/customer-nav";
import CartItemCard from "@/components/customer/CartItemCard";
import BillSummary from "@/components/customer/BillSummary";
import CartBackground from "@/components/customer/CartBackground";

export default function CartPage() {
  const router = useRouter();
  const buildCustomerUrl = useBuildCustomerUrl();

  const {
    items,
    subtotal,
    taxAmount,
    totalAmount,
  } = useCartStore();

  const sub = subtotal();
  const tax = taxAmount();
  const total = totalAmount();

  if (items.length === 0) {
    return (
      <main className="relative min-h-dvh overflow-hidden bg-bg-primary">
        <CartBackground />

        <div className="relative z-10 mx-auto flex min-h-dvh max-w-[480px] flex-col items-center justify-center px-6">
          <div className="mb-4 text-6xl">🛒</div>

          <h1 className="font-display mb-2 text-3xl font-semibold text-text-primary">
            Your Cart
          </h1>

          <p className="font-body mb-8 text-sm text-text-secondary">
            Add items from the menu to get started
          </p>

         <motion.button
  whileTap={{ scale: 0.96 }}
  onClick={() => router.push(buildCustomerUrl("/menu"))}
  className="font-body rounded-full px-7 py-4 text-sm font-semibold text-bg-primary shadow-lg transition"
  style={{
    background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
    letterSpacing: "0.3px",
  }}
>
  ← Back to Menu
</motion.button>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-dvh overflow-x-hidden bg-bg-primary pb-28">
      <CartBackground />

      <div className="relative z-10 mx-auto max-w-[480px]">
        {/* Header */}
        <div className="sticky top-0 z-50 border-b border-border-soft/50 bg-bg-primary/90 px-4 pb-3 pt-4 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <motion.button
  whileTap={{ scale: 0.96 }}
  onClick={() => router.push(buildCustomerUrl("/menu"))}
  className="font-body flex h-10 w-10 items-center justify-center rounded-full text-lg text-bg-primary shadow-lg"
  style={{
    background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
    letterSpacing: "0.3px",
  }}
>
  ←
</motion.button>
            <div>
              <h1 className="font-display text-[28px] font-semibold text-text-primary">
                Your Cart
              </h1>

              <p className="font-body text-xs text-text-secondary">
                {items.reduce((s, e) => s + e.quantity, 0)} items
              </p>
            </div>
          </div>
        </div>

        {/* Cart Items */}
      <div
  className="mx-4 mt-4 overflow-hidden rounded-[28px] backdrop-blur-md"
  style={{
    background: "rgba(255,255,255,0.55)",
    border: "1px solid rgba(255,255,255,0.4)",
    boxShadow: `
      0 8px 24px rgba(0,0,0,0.06),
      inset 0 1px 1px rgba(255,255,255,0.7)
    `,
  }}
>
  {items.map((entry) => (
    <CartItemCard key={entry.item.id} entry={entry} />
  ))}
</div>

        {/* Bill Summary */}
        <BillSummary
          subtotal={sub}
          taxAmount={tax}
          totalAmount={total}
        />
      </div>

      {/* Proceed Button */}
      <div className="fixed bottom-4 left-0 right-0 z-[999] mx-auto w-[calc(100%-32px)] max-w-[448px] px-4">
        <motion.button
  whileTap={{ scale: 0.97 }}
  onClick={() => router.push(buildCustomerUrl("/checkout"))}
  className="font-body flex w-full items-center justify-between rounded-full px-6 py-4 text-[15px] font-semibold text-bg-primary shadow-lg"
  style={{
    background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
    letterSpacing: "0.3px",
  }}
>
  <span className="font-body text-sm opacity-90">
    ₹ {total}
  </span>

  <span className="font-body text-[15px] font-semibold">
    Proceed to Checkout →
  </span>

  <span className="w-[60px]" />
</motion.button>
      </div>
    </main>
  );
}
