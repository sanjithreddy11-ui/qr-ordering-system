"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BellRing, Check } from "lucide-react";
import { getSocket } from "@/lib/socket";

interface WaiterCallButtonProps {
  restaurantId: string;
  tableToken?: string | null;
  tableLabel?: string | null;
  // "fixed" (default) = original floating circular button, pinned to the
  // viewport. "inline" = sized/shaped to sit inline next to the search bar
  // (replaces the old group-order trigger there). Same call/cooldown/toast
  // logic either way.
  variant?: "fixed" | "inline";
}

const COOLDOWN_MS = 45_000;
const TOAST_MS = 2800;

export default function WaiterCallButton({
  restaurantId,
  tableToken,
  tableLabel,
  variant = "fixed",
}: WaiterCallButtonProps) {
  const [cooldownUntil, setCooldownUntil] = useState<number | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onCooldown = cooldownUntil !== null;

  useEffect(() => {
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (cooldownTimer.current) clearTimeout(cooldownTimer.current);
    };
  }, []);

  const handleCall = () => {
    if (onCooldown) return;

    getSocket().emit("call-waiter", {
      restaurantId,
      tableToken: tableToken ?? null,
      tableLabel: tableLabel ?? tableToken ?? "Table",
    });

    setCooldownUntil(Date.now() + COOLDOWN_MS);
    cooldownTimer.current = setTimeout(() => setCooldownUntil(null), COOLDOWN_MS);

    setShowConfirm(true);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setShowConfirm(false), TOAST_MS);
  };

  return (
    <>
      {variant === "fixed" ? (
        <motion.button
          type="button"
          onClick={handleCall}
          disabled={onCooldown}
          initial={{ opacity: 0, scale: 0.8, x: 8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          whileTap={{ scale: onCooldown ? 1 : 0.92 }}
          className="fixed right-4 top-4 z-[1100] flex h-11 w-11 items-center justify-center rounded-full disabled:opacity-70"
          style={{
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(255,255,255,0.5)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
          }}
          aria-label={onCooldown ? "Waiter notified" : "Call waiter"}
        >
          {onCooldown ? (
            <Check size={18} strokeWidth={2.4} color="#3A4C3B" />
          ) : (
            <BellRing size={18} strokeWidth={2.2} color="#263429" />
          )}
        </motion.button>
      ) : (
        <motion.button
          type="button"
          onClick={handleCall}
          disabled={onCooldown}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          whileTap={{ scale: onCooldown ? 1 : 0.95 }}
          className="relative flex h-[52px] shrink-0 items-center justify-center rounded-[22px] border border-border-soft bg-bg-secondary px-3.5 disabled:opacity-70"
          style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
          aria-label={onCooldown ? "Waiter notified" : "Call waiter"}
        >
          {onCooldown ? (
            <Check size={18} strokeWidth={2.4} className="text-green-primary" />
          ) : (
            <BellRing size={18} strokeWidth={1.75} className="text-green-primary" />
          )}
        </motion.button>
      )}

      <AnimatePresence>
        {showConfirm && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.95 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="fixed left-1/2 top-[70px] z-[1100] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5"
            style={{
              background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
              boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
            }}
          >
            <Check size={14} strokeWidth={2.4} color="#F8F5ED" />
            <span className="font-body text-[12.5px] font-medium text-[#F8F5ED]">
              Waiter notified — on the way
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}