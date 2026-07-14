"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { User } from "lucide-react";

export interface HeroSectionProps {
  /** Path under /public to the looping hero video, e.g. "/new-assets/floral.mp4" */
  videoSrc: string;
  /** Path under /public to the restaurant logo shown in the floating medallion */
  logo: string;
  restaurantName: string;
  tagline: string;
  description?: string;
  /** Called when the top-right circular profile button is tapped.
   *  Left as a no-op hook until an account/profile page exists. */
  onProfileClick?: () => void;
}

/**
 * Section 1 — Hero.
 * Full-bleed autoplay video that dominates the first screen (~68dvh —
 * the video should read as most of the initial view, with only the
 * logo medallion + "Welcome To" line peeking in below it, matching the
 * reference), large rounded bottom corners, a circular profile button
 * floating top-right on the video, and a logo medallion straddling the
 * seam between the video and the paper-texture body below it.
 */
export default function HeroSection({
  videoSrc,
  logo,
  restaurantName,
  tagline,
  description,
  onProfileClick,
}: HeroSectionProps) {
  return (
    <section className="relative w-full">
      {/* Video block — sized to dominate the first screen, like the reference */}
      <div className="relative h-[68dvh] w-full overflow-hidden rounded-b-[44px] shadow-lg">
        <video
          className="h-full w-full object-cover"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
        />

        <button
          type="button"
          onClick={onProfileClick}
          aria-label="Profile"
          className="absolute right-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/90 shadow-md backdrop-blur-sm transition-transform active:scale-95"
        >
          <User size={20} style={{ color: "var(--green-deep)" }} />
        </button>
      </div>

      {/* Floating logo — overlaps the video/paper seam */}
      <div className="relative z-10 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="-mt-14 flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-white p-2"
          style={{ boxShadow: "0 12px 28px rgba(0,0,0,0.18)" }}
        >
          <Image
            src={logo}
            alt={restaurantName}
            width={112}
            height={112}
            className="h-full w-full rounded-2xl object-cover"
          />
        </motion.div>
      </div>

      {/* Welcome copy */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.5 }}
        className="relative mx-auto flex max-w-[480px] flex-col items-center px-8 pb-2 pt-4 text-center"
      >
        {/* Flower accents — full opacity, with a slow ambient float so they
            read as a living detail rather than a flat sticker. */}
        <motion.div
          className="pointer-events-none absolute -left-1 -top-1"
          animate={{ y: [0, -6, 0], rotate: [0, -2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src="/new-assets/top-left-flower.png"
            alt=""
            width={92}
            height={105}
            aria-hidden
            className="h-auto w-[96px]"
          />
        </motion.div>
        <motion.div
          className="pointer-events-none absolute -right-1 -top-1"
          animate={{ y: [0, -6, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        >
          <Image
            src="/new-assets/top-right-flower.png"
            alt=""
            width={92}
            height={105}
            aria-hidden
            className="h-auto w-[96px]"
          />
        </motion.div>

        <p className="font-display mb-1 text-2xl italic text-green-secondary">
          Welcome To
        </p>
        <h1 className="font-display mb-4 text-4xl font-semibold leading-tight text-green-deep">
          {restaurantName}
        </h1>

        <p className="font-body max-w-xs text-sm leading-relaxed text-text-secondary">
          {tagline}
        </p>
        {description && (
          <p className="font-body mt-2 max-w-xs text-sm leading-relaxed text-text-secondary">
            {description}
          </p>
        )}

        <Image
          src="/new-assets/flower-divider.png"
          alt=""
          width={808}
          height={348}
          aria-hidden
          className="pointer-events-none mt-6 h-auto w-full max-w-[320px]"
        />
      </motion.div>
    </section>
  );
}
