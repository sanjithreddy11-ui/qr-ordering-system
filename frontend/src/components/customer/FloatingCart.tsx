"use client";
import { ShoppingBasket, ArrowRight } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useCustomerNavigate } from "@/lib/customer-nav";

interface FloatingCartProps {
  itemCount: number;
  total: number;
}
export default function FloatingCart({ itemCount, total }: FloatingCartProps) {
  const goTo = useCustomerNavigate();
  return (
    <AnimatePresence>
      {itemCount > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
         className="fixed bottom-[max(20px,env(safe-area-inset-bottom))] left-1/2 z-20 w-[calc(100%-40px)] max-w-[440px] -translate-x-1/2 will-change-transform"
        >
          <div
            className="flex items-center gap-3 rounded-[22px] border border-border-soft bg-bg-card py-2.5 pl-3 pr-2.5"
            style={{ boxShadow: "0 10px 28px rgba(0,0,0,0.08)" }}
          >
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-primary text-bg-primary">
              <ShoppingBasket size={19} strokeWidth={1.75} />
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-[#EFE7D6] text-[11px] font-semibold text-green-primary">
                {itemCount}
              </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <span className="font-body text-[15px] font-bold text-text-primary">
                ₹ {total}
              </span>
              <span className="font-body text-[12px] text-text-secondary">
                {itemCount} {itemCount === 1 ? "Item" : "Items"} in cart
              </span>
            </div>

           <motion.button
  whileTap={{ scale: 0.96 }}
  type="button"
  onClick={() => goTo("/cart")}
  className="font-body flex shrink-0 items-center gap-1.5 rounded-full px-5 py-3 text-[13px] font-semibold text-bg-primary"
  style={{
    background: "linear-gradient(135deg, #3A4C3B 0%, #263429 100%)",
    letterSpacing: "0.3px",
  }}
>
  View Cart
  <ArrowRight size={14} strokeWidth={2} />
</motion.button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}