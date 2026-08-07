"use client";

import Image from "next/image";
import { Minus, Plus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { CartEntry, entryUnitPrice, useCartStore } from "@/store/cart-store";

interface Props {
  entry: CartEntry;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function CartItemCard({ entry }: Props) {
  const { addItem, removeItem } = useCartStore();

  const { item, quantity, modifiers } = entry;
  const isVeg = item.diet === "veg";
  const unitPrice = entryUnitPrice(entry);

  return (
    <motion.div
      layout
      transition={{ duration: 0.4, ease: EASE }}
      className="relative flex gap-4 border-b border-border-soft/60 p-4 last:border-b-0"
    >
      {/* Glass Shine */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.18), transparent 50%)",
        }}
      />

      {/* Food Image */}
      <div className="relative h-[88px] w-[88px] shrink-0 overflow-hidden rounded-[18px] bg-bg-secondary">
        <Image
          src={item.image}
          alt={item.name}
          fill
          className="object-cover"
        />
      </div>

      {/* Content */}
      <div className="flex min-w-0 flex-1 flex-col justify-between">
        <div>
          <div className="flex items-start gap-2">
            {/* Veg / Non-Veg */}
            <span
              className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border ${
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

            <h3 className="font-display line-clamp-1 text-[20px] font-semibold text-text-primary">
              {item.name}
            </h3>
          </div>

          {/* Menu Item Customization (Modifiers): the selected sauce shown
              right under the item name, so it's always visible while the
              cart is reviewed — preserved even as the quantity changes,
              since it lives on this exact cart entry, not derived from
              elsewhere. */}
          {modifiers && modifiers.length > 0 ? (
            <ul className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
              {modifiers.map((m) => (
                <li
                  key={m.groupId}
                  className="font-body text-[13px] leading-snug text-text-secondary"
                >
                  • {m.optionName}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body mt-1 line-clamp-2 text-[13px] leading-snug text-text-secondary">
              {item.description}
            </p>
          )}
        </div>

        {/* Bottom */}
        <div className="mt-3 flex items-end justify-between">
          <span className="font-body text-[18px] font-bold text-text-primary">
            ₹ {unitPrice * quantity}
          </span>

          <AnimatePresence mode="wait">
            <motion.div
              key={quantity}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.2 }}
              className="flex h-9 items-center gap-3 rounded-full border border-green-primary bg-green-primary/[0.08] px-2"
            >
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => removeItem(item, modifiers)}
                className="flex h-6 w-6 items-center justify-center text-green-primary"
              >
                <Minus size={14} strokeWidth={2.3} />
              </motion.button>

              <span className="font-body min-w-[12px] text-center text-[14px] font-semibold text-green-primary">
                {quantity}
              </span>

              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={() => addItem(item, modifiers)}
                className="flex h-6 w-6 items-center justify-center text-green-primary"
              >
                <Plus size={14} strokeWidth={2.3} />
              </motion.button>
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
}