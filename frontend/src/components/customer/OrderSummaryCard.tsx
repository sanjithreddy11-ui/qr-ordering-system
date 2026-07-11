"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { CartEntry } from "@/store/cart-store";

interface Props {
  items: CartEntry[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export default function OrderSummaryCard({
  items,
  subtotal,
  taxAmount,
  totalAmount,
}: Props) {
  const [expanded, setExpanded] = useState(false);

  const totalQty = items.reduce(
    (sum, item) => sum + item.quantity,
    0
  );

  return (
    <div
      className="relative overflow-hidden rounded-[28px] p-5 backdrop-blur-md"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: `
          0 8px 24px rgba(0,0,0,0.06),
          inset 0 1px 1px rgba(255,255,255,0.7)
        `,
      }}
    >
      {/* Glass Shine */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 50%)",
        }}
      />

      <div className="relative z-10">
        {/* Header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex w-full items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">🧾</span>

            <div className="text-left">
              <h2 className="font-display text-[28px] font-semibold text-text-primary">
                Order Summary
              </h2>

              <p className="font-body text-xs text-text-secondary">
                {totalQty} {totalQty === 1 ? "item" : "items"}
              </p>
            </div>
          </div>

          <motion.span
            animate={{ rotate: expanded ? 180 : 0 }}
            transition={{ duration: 0.25 }}
            className="font-body text-xl text-green-primary"
          >
            ⌄
          </motion.span>
        </button>

        {/* Expandable Items */}
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-border-soft/50 pt-4">
                <div className="space-y-4">
                  {items.map((entry) => {
                    const isVeg =
                      entry.item.diet === "veg";

                    return (
                      <div
                        key={entry.item.id}
                        className="flex items-center justify-between"
                      >
                        <div className="flex min-w-0 items-center gap-3">
                          <span
                            className={`flex h-4 w-4 items-center justify-center rounded-[3px] border ${
                              isVeg
                                ? "border-green-secondary"
                                : "border-[#8B4B3B]"
                            }`}
                          >
                            <span
                              className={`h-2 w-2 rounded-full ${
                                isVeg
                                  ? "bg-green-secondary"
                                  : "bg-[#8B4B3B]"
                              }`}
                            />
                          </span>

                          <div className="min-w-0">
                            <p className="font-body truncate text-[14px] font-medium text-text-primary">
                              {entry.item.name}
                            </p>

                            <p className="font-body text-xs text-text-secondary">
                              Qty: {entry.quantity}
                            </p>
                          </div>
                        </div>

                        <span className="font-body text-sm font-semibold text-text-primary">
                          ₹{" "}
                          {entry.item.price *
                            entry.quantity}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bill */}
        <div className="mt-5 border-t border-border-soft/50 pt-4">
          <div className="flex items-center justify-between py-2">
            <span className="font-body text-[14px] text-text-secondary">
              Item Total
            </span>

            <span className="font-body text-[15px] font-medium text-text-primary">
              ₹ {subtotal}
            </span>
          </div>

          <div className="flex items-center justify-between py-2">
            <span className="font-body text-[14px] text-text-secondary">
              GST (5%)
            </span>

            <span className="font-body text-[15px] font-medium text-text-primary">
              ₹ {taxAmount}
            </span>
          </div>

          <div className="my-4 border-t border-dashed border-green-primary/40" />

          <div className="flex items-center justify-between">
            <span className="font-body text-[18px] font-semibold text-text-primary">
              To Pay
            </span>

            <span className="font-body text-[20px] font-bold text-text-primary">
              ₹ {totalAmount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}