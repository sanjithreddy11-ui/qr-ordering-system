"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import { motion } from "framer-motion";

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export default function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
      className="flex items-center gap-3 rounded-[22px] border border-border-soft bg-bg-secondary px-4 py-3.5"
      style={{ boxShadow: "0 6px 20px rgba(0,0,0,0.04)" }}
    >
      <Search size={18} strokeWidth={1.75} className="shrink-0 text-text-secondary" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for dishes..."
        className="font-body w-full bg-transparent text-[15px] text-text-primary placeholder:text-text-secondary focus:outline-none"
      />
    </motion.div>
  );
}
