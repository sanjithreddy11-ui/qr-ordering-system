"use client";

import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { useUIStore } from "@/store/ui-store";
import { useCustomerNavigate } from "@/lib/customer-nav";

/**
 * Appears top-left, glass/card styled, whenever the floating category
 * drawer overlay is open (on pages other than /menu, which has its own
 * always-visible back button built directly into the page). Closes the
 * drawer and navigates back to Home, preserving the restaurant slug +
 * table token via useCustomerNavigate().
 */
export default function CategoryMenuBackButton() {
  const isCategoryMenuOpen = useUIStore((s) => s.isCategoryMenuOpen);
  const closeCategoryMenu = useUIStore((s) => s.closeCategoryMenu);
  const goTo = useCustomerNavigate();

  return (
    <AnimatePresence>
      {isCategoryMenuOpen && (
        <motion.button
          initial={{ opacity: 0, scale: 0.8, x: -8 }}
          animate={{ opacity: 1, scale: 1, x: 0 }}
          exit={{ opacity: 0, scale: 0.8, x: -8 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          whileTap={{ scale: 0.92 }}
          onClick={() => {
            closeCategoryMenu();
            goTo("/");
          }}
          className="fixed left-4 top-4 z-[1100] flex h-11 w-11 items-center justify-center rounded-full"
          style={{
            background: "rgba(255,255,255,0.65)",
            border: "1px solid rgba(255,255,255,0.5)",
            backdropFilter: "blur(14px)",
            WebkitBackdropFilter: "blur(14px)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12), inset 0 1px 1px rgba(255,255,255,0.8)",
          }}
          aria-label="Close menu and go home"
        >
          <ArrowLeft size={19} strokeWidth={2.2} color="#263429" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}