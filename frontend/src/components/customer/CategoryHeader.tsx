"use client";

import Image from "next/image";
import { motion } from "framer-motion";

interface CategoryHeaderProps {
  title: string;
  birdSide?: "left" | "right";
}

export default function CategoryHeader({ title, birdSide = "right" }: CategoryHeaderProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
      className="relative flex flex-col items-center pb-4 pt-4"
    >
      <div
        className={`absolute top-0 opacity-70 ${
          birdSide === "right" ? "right-6" : "left-6 -scale-x-100"
        }`}
      >
        <Image src="/assets/bird.svg" alt="" width={32} height={19} />
      </div>

      <div className="flex w-full items-center justify-center gap-4">
        <span className="h-px flex-1 max-w-[64px] bg-border-soft" />
        <h2
          className="font-display shrink-0 whitespace-nowrap text-[21px] font-semibold text-green-primary"
          style={{ letterSpacing: "4px" }}
        >
          {title.toUpperCase()}
        </h2>
        <span className="h-px flex-1 max-w-[64px] bg-border-soft" />
      </div>

      <Image
        src="/assets/divider.svg"
        alt=""
        width={16}
        height={16}
        className="mt-3 opacity-80"
      />
    </motion.div>
  );
}
