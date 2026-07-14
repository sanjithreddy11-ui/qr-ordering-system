"use client";

import React from "react";
import { motion } from "framer-motion";
import { type LucideIcon, ArrowRight } from "lucide-react";

export interface AboutHighlight {
  label: string;
  icon: LucideIcon;
}

export interface AboutCafeSectionProps {
  heading?: string;
  subtitle?: string;
  description: string;
  highlights: AboutHighlight[];
  ctaLabel?: string;
  onExploreMenu: () => void;
}

/**
 * Section 2 — "About Café".
 * Replaces the old "Our Menu" heading. Centered description, a row of
 * circled feature icons, and a single dark CTA that hands off to the
 * existing menu route — routing itself is untouched, only this button's
 * appearance changes.
 */
export default function AboutCafeSection({
  heading = "About Café",
  subtitle,
  description,
  highlights,
  ctaLabel = "Explore Our Menu",
  onExploreMenu,
}: AboutCafeSectionProps) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5 }}
      className="relative mx-auto flex max-w-[480px] flex-col items-center px-8 py-10 text-center"
    >
      <h2 className="font-display mb-2 text-4xl font-semibold leading-tight text-green-deep">
        {heading}
      </h2>
      {subtitle && (
        <p className="font-body mb-6 text-sm text-text-secondary">{subtitle}</p>
      )}

      <p className="font-body mb-8 max-w-sm text-[15px] leading-relaxed text-text-primary">
        {description}
      </p>

      <div className="mb-9 flex w-full items-start justify-between">
        {highlights.map((item) => {
          const Icon = item.icon;
          return (
            <div
              key={item.label}
              className="flex flex-1 flex-col items-center gap-2.5 px-1"
            >
              <span
                className="flex h-14 w-14 items-center justify-center rounded-full"
                style={{ border: "1.5px solid var(--gold-accent)" }}
              >
                <Icon size={22} style={{ color: "var(--green-deep)" }} />
              </span>
              <span className="font-body text-xs font-medium leading-tight text-text-primary">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>

      <motion.button
        type="button"
        whileTap={{ scale: 0.96 }}
        onClick={onExploreMenu}
        className="font-display flex w-full max-w-xs items-center justify-center gap-2.5 rounded-full px-8 py-4 text-base text-bg-primary shadow-lg"
        style={{ background: "var(--green-deep)" }}
      >
        {ctaLabel}
        <ArrowRight size={17} style={{ color: "var(--gold-accent)" }} />
      </motion.button>
    </motion.section>
  );
}
