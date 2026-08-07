"use client";

import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { requiresCustomization, type MenuItem } from "@/lib/menu-data";

interface FoodCardProps {
  item: MenuItem;
  quantity: number;
  // For a customizable item, `onAdd` is interpreted by the parent as "open
  // the customization modal" rather than "add directly to cart" — see
  // app/(customer)/menu/page.tsx. FoodCard itself never knows what a
  // sauce is; it only knows whether this item needs a modal at all.
  onAdd: (item: MenuItem) => void;
  onRemove: (item: MenuItem) => void;
  index?: number;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function FoodCard({
  item,
  quantity,
  onAdd,
  onRemove,
  index = 0,
}: FoodCardProps) {
  // Menu Item Customization (Modifiers): a customizable item can have
  // several cart lines at once (one per sauce chosen), so a single +/-
  // stepper on the menu list can't unambiguously represent "which line am
  // I adjusting". Instead it always shows a tappable "+" (with the total
  // quantity across all its variants as a badge) that opens the
  // customization modal every time — per-variant quantity adjustments
  // happen in the Cart, where each sauce is its own line.
  const customizable = requiresCustomization(item);
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{
        duration: 0.7,
        delay: Math.min(index, 3) * 0.06,
        ease: EASE,
      }}
      className="relative flex gap-4 overflow-hidden rounded-[28px] p-3.5 backdrop-blur-md"
      style={{
        background: "rgba(255, 255, 255, 0.55)",
        border: "1px solid rgba(255, 255, 255, 0.4)",
        boxShadow: `
          0 8px 24px rgba(0,0,0,0.06),
          inset 0 1px 1px rgba(255,255,255,0.7)
        `,
      }}
    >
      {/* Glass Shine Effect */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.25), transparent 50%)",
        }}
      />

      <div className="relative h-[104px] w-[104px] shrink-0 overflow-hidden rounded-[18px] bg-bg-secondary">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display truncate text-[19px] font-semibold leading-tight text-text-primary">
              {item.name}
            </h3>

            <span
              className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
                item.diet === "veg"
                  ? "border-green-secondary"
                  : "border-[#8B4B3B]"
              }`}
            >
              <span
                className={`h-2 w-2 rounded-full ${
                  item.diet === "veg"
                    ? "bg-green-secondary"
                    : "bg-[#8B4B3B]"
                }`}
              />
            </span>
          </div>

          <p className="font-body mt-1 line-clamp-2 text-[13px] leading-snug text-text-secondary">
            {item.description}
          </p>
        </div>

        <div className="mt-2 flex items-end justify-between">
          <span className="font-body text-[15px] font-bold text-text-primary">
            ₹ {item.price}
          </span>

          <div className="relative flex h-8 items-center justify-end">
            {customizable ? (
              <motion.button
                key="customize"
                type="button"
                whileTap={{ scale: 0.88 }}
                onClick={() => onAdd(item)}
                aria-label={quantity > 0 ? `Add another ${item.name}` : `Customize ${item.name}`}
                className="relative flex h-8 w-8 items-center justify-center rounded-full border border-green-primary text-green-primary transition-colors active:bg-green-primary active:text-bg-primary"
              >
                <Plus size={16} strokeWidth={2} />
                {quantity > 0 && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-green-primary px-1 text-[10px] font-bold leading-none text-bg-primary">
                    {quantity}
                  </span>
                )}
              </motion.button>
            ) : (
              <AnimatePresence mode="wait" initial={false}>
                {quantity === 0 ? (
                  <motion.button
                    key="add"
                    type="button"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    whileTap={{ scale: 0.88 }}
                    onClick={() => onAdd(item)}
                    aria-label={`Add ${item.name}`}
                    className="flex h-8 w-8 items-center justify-center rounded-full border border-green-primary text-green-primary transition-colors active:bg-green-primary active:text-bg-primary"
                  >
                    <Plus size={16} strokeWidth={2} />
                  </motion.button>
                ) : (
                  <motion.div
                    key="stepper"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.22, ease: EASE }}
                    className="flex h-8 items-center gap-2.5 rounded-full border border-green-primary bg-green-primary/[0.06] px-1.5"
                  >
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={() => onRemove(item)}
                      aria-label={`Remove one ${item.name}`}
                      className="flex h-5 w-5 items-center justify-center text-green-primary"
                    >
                      <Minus size={13} strokeWidth={2.25} />
                    </motion.button>

                    <span className="font-body min-w-[10px] text-center text-[13px] font-semibold text-green-primary">
                      {quantity}
                    </span>

                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.85 }}
                      onClick={() => onAdd(item)}
                      aria-label={`Add one more ${item.name}`}
                      className="flex h-5 w-5 items-center justify-center text-green-primary"
                    >
                      <Plus size={13} strokeWidth={2.25} />
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}