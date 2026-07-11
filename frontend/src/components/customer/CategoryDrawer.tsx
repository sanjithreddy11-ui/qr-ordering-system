"use client";

import { useState } from "react";
import { AlignJustify } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";

export interface DrawerCategory {
  id: string;
  title: string;
}

interface CategoryDrawerProps {
  categories: DrawerCategory[];
  onSelect: (id: string) => void;
}

const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export default function CategoryDrawer({ categories, onSelect }: CategoryDrawerProps) {
  const [open, setOpen] = useState(false);

  const handleSelect = (id: string) => {
    setOpen(false);
    setTimeout(() => onSelect(id), 200);
  };

  return (
    <>
      {/* Floating trigger — fixed bottom-right, sitting above the cart */}
      <motion.button
        type="button"
        aria-label="Open category menu"
        onClick={() => setOpen(true)}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.4, ease: EASE }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-[104px] right-4 z-30 flex items-center gap-1.5 rounded-full border border-border-soft bg-bg-secondary px-4 py-2.5"
        style={{ boxShadow: "0 6px 16px rgba(0,0,0,0.07)" }}
      >
        <AlignJustify size={14} strokeWidth={1.75} className="text-green-primary" />
        <span
          className="font-body text-[10.5px] font-medium uppercase text-green-primary"
          style={{ letterSpacing: "1.2px" }}
        >
          Menu
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3, ease: EASE }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-40 mx-auto max-w-[480px] bg-[#1C1C1C]/22"
            />
            <motion.div
              key="sheet"
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ duration: 0.4, ease: EASE }}
              className="fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[45vh] max-w-[480px] flex-col overflow-hidden rounded-t-[28px] border-t border-border-soft bg-bg-secondary"
              style={{ boxShadow: "0 -12px 28px rgba(0,0,0,0.08)" }}
            >
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.06]"
                style={{
                  backgroundImage: "url('/assets/paper-texture.svg')",
                  backgroundSize: "260px 260px",
                  mixBlendMode: "multiply",
                }}
              />

              <div className="relative flex flex-col items-center pb-2 pt-3">
                <span className="h-1 w-9 rounded-full bg-border-soft" />
              </div>

              <div className="relative flex items-center justify-center pb-3">
                <span
                  className="font-body text-[10.5px] font-medium uppercase text-text-secondary"
                  style={{ letterSpacing: "3px" }}
                >
                  Categories
                </span>
              </div>

              <span className="relative mx-6 h-px bg-border-soft" />

              <nav className="relative flex flex-1 flex-col items-center gap-0.5 overflow-y-auto px-6 py-3">
                {categories.map((cat, i) => (
                  <motion.button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.08 + i * 0.04, ease: EASE }}
                    className="font-display w-full py-2.5 text-center text-[19px] font-medium text-text-primary active:opacity-60"
                  >
                    {cat.title}
                  </motion.button>
                ))}
              </nav>

              <div className="relative flex items-center justify-center gap-3 pb-4 pt-1 opacity-60">
                <Image src="/assets/divider.svg" alt="" width={12} height={12} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
