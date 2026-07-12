"use client";

import { motion } from "framer-motion";
import {
  UtensilsCrossed,
  Leaf,
  Drumstick,
  type LucideIcon,
} from "lucide-react";

export type FilterValue = "all" | "veg" | "non-veg";

interface FilterOption {
  label: string;
  value: FilterValue;
  icon: LucideIcon;
}

const options: FilterOption[] = [
  {
    label: "All",
    value: "all",
    icon: UtensilsCrossed,
  },
  {
    label: "Veg",
    value: "veg",
    icon: Leaf,
  },
  {
    label: "Non-Veg",
    value: "non-veg",
    icon: Drumstick,
  },
];

interface FilterTabsProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

export default function FilterTabs({
  value,
  onChange,
}: FilterTabsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: 0.18,
        ease: "easeOut",
      }}
      className="flex items-center gap-2.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        const Icon = opt.icon;

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`font-body flex-1 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-all duration-300 ${
              active
                ? "border-green-primary bg-green-primary text-bg-primary shadow-md"
                : "border-border-soft bg-bg-card text-text-primary hover:bg-bg-secondary"
            }`}
            style={{ letterSpacing: "0.5px" }}
          >
            <motion.div
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-center gap-2"
            >
              <Icon
                size={16}
                strokeWidth={2}
                className={
                  active
                    ? "text-bg-primary"
                    : "text-green-primary"
                }
              />

              <span>{opt.label.toUpperCase()}</span>
            </motion.div>
          </button>
        );
      })}
    </motion.div>
  );
}