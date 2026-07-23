"use client";

import Image from "next/image";
import { motion } from "framer-motion";

export default function RestaurantHeader() {
  return (
    <motion.header
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
      className="relative px-6 pb-2 pt-8 text-center"
    >
      <div className="mt-2 flex items-center justify-center gap-3">
        <h1
          className="font-display text-[34px] font-semibold text-green-primary"
          style={{ letterSpacing: "2px" }}
        >
          MAXIBREW
        </h1>
        <Image
          src="/assets/hanko.svg"
          alt=""
          width={26}
          height={26}
          className="mt-1 opacity-90"
        />
      </div>
      <p className="font-display mt-1 text-[15px] italic text-text-secondary">
        a quiet table, thoughtfully set
      </p>
    </motion.header>
  );
}
