"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Wallet, CreditCard, type LucideIcon } from "lucide-react";
import type { PaymentMethod } from "@/types/order";

interface Option {
  value: PaymentMethod;
  label: string;
  icon: string | LucideIcon;
  sub: string;
}

const OPTIONS: Option[] = [
  {
    value: "upi",
    label: "UPI",
    icon: "/upilogo.png",
    sub: "GPay, PhonePe, Paytm",
  },
  {
    value: "cash",
    label: "Cash",
    icon: Wallet,
    sub: "Pay at counter",
  },
  {
    value: "card",
    label: "Card",
    icon: CreditCard,
    sub: "Debit & Credit Cards",
  },
];

interface Props {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export default function PaymentMethodSelector({
  selected,
  onChange,
}: Props) {
  return (
    <div className="space-y-3">
      {OPTIONS.map((option) => {
        const isActive = selected === option.value;

        return (
          <motion.button
            key={option.value}
            whileTap={{ scale: 0.98 }}
            type="button"
            onClick={() => onChange(option.value)}
            className="relative flex w-full items-center gap-4 overflow-hidden rounded-[24px] p-4 text-left transition-all"
            style={{
              background: isActive
                ? "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)"
                : "rgba(255,255,255,0.55)",

              border: isActive
                ? "none"
                : "1px solid rgba(255,255,255,0.4)",

              boxShadow: isActive
                ? "0 8px 24px rgba(50,66,52,0.18)"
                : `
                    0 8px 24px rgba(0,0,0,0.05),
                    inset 0 1px 1px rgba(255,255,255,0.7)
                  `,

              backdropFilter: "blur(12px)",
            }}
          >
            {/* Glass shine */}
            {!isActive && (
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(135deg, rgba(255,255,255,0.18), transparent 50%)",
                }}
              />
            )}

            {/* Icon */}
            <div
              className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
              style={{
                background: isActive
                  ? "rgba(255,255,255,0.14)"
                  : "rgba(255,255,255,0.7)",
              }}
            >
              {typeof option.icon === "string" ? (
                <Image
                  src={option.icon}
                  alt={option.label}
                  width={24}
                  height={24}
                />
              ) : (
                <option.icon
                  size={20}
                  color={isActive ? "#FFFFFF" : "#324234"}
                />
              )}
            </div>

            {/* Content */}
            <div className="relative z-10 flex-1">
              <h3
                className={`font-body text-[15px] font-semibold ${
                  isActive
                    ? "text-white"
                    : "text-text-primary"
                }`}
              >
                {option.label}
              </h3>

              <p
                className={`font-body mt-1 text-xs ${
                  isActive
                    ? "text-white/70"
                    : "text-text-secondary"
                }`}
              >
                {option.sub}
              </p>
            </div>

            {/* Radio */}
            <div
              className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                isActive
                  ? "border-white"
                  : "border-green-primary/30"
              }`}
            >
              {isActive && (
                <div className="h-2.5 w-2.5 rounded-full bg-white" />
              )}
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}