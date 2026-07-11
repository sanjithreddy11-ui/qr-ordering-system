"use client";

import { motion } from "framer-motion";

export type FilterValue = "all" | "veg" | "non-veg";

const options: { label: string; value: FilterValue }[] = [
  { label: "All", value: "all" },
  { label: "Veg", value: "veg" },
  { label: "Non-Veg", value: "non-veg" },
];

interface FilterTabsProps {
  value: FilterValue;
  onChange: (value: FilterValue) => void;
}

export default function FilterTabs({ value, onChange }: FilterTabsProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.18, ease: "easeOut" }}
      className="flex items-center gap-2.5"
    >
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`font-body flex-1 rounded-full border px-4 py-2.5 text-[13px] font-medium transition-colors ${
              active
                ? "border-green-primary bg-green-primary text-bg-primary"
                : "border-border-soft bg-bg-card text-text-primary"
            }`}
            style={{ letterSpacing: "0.5px" }}
          >
            <motion.span whileTap={{ scale: 0.94 }} className="inline-block">
              {opt.label.toUpperCase()}
            </motion.span>
          </button>
        );
      })}
    </motion.div>
  );
}
