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
 * Full-bleed autoplay video that dominates the first screen (~68dvh), cut
 * along an organic asymmetric curve at the bottom (left edge runs the
 * full height, right edge lifts away earlier) via an objectBoundingBox
 * SVG clip-path — this is what makes the hero feel stitched into the
 * paper section below rather than two stacked rectangles. A logo
 * medallion straddles that seam, and the "Welcome To" line uses a
 * calligraphy script face for a fine-dining feel.
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
      {/* Hidden SVG defining the asymmetric hero clip-path. objectBoundingBox
          units (0–1) keep it fully responsive regardless of viewport width. */}
      <svg width="0" height="0" className="absolute" aria-hidden>
        <defs>
          <clipPath id="heroOrganicClip" clipPathUnits="objectBoundingBox">
            <path d="M0,0 L1,0 L1,0.72 C0.75,0.88 0.35,1 0,1 Z" />
          </clipPath>
        </defs>
      </svg>

      {/* Video block */}
      <div
        className="relative h-[65vh] w-full overflow-hidden"
        style={{
          clipPath: "url(#heroOrganicClip)",
          filter: "drop-shadow(0 18px 30px rgba(0,0,0,0.16))",
        }}
      >
        <video
          className="h-full w-full object-cover object-[center_35%]"
          src={videoSrc}
          autoPlay
          muted
          loop
          playsInline
        />
      </div>

     
      {/* Floating logo — overlaps the video/paper seam */}
      <div className="relative z-10 flex justify-center">
        <motion.div
          initial={{ opacity: 0, y: 12, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="-mt-20 flex h-28 w-28 items-center justify-center overflow-hidden rounded-3xl bg-white p-2"
          style={{
            boxShadow:
              "0 22px 48px rgba(0,0,0,0.16), 0 8px 18px rgba(0,0,0,0.08)",
          }}
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
        className="relative mx-auto flex max-w-[480px] flex-col items-center px-6 pb-2 pt-3 text-center"
      >
        {/* Flower accents — deliberately asymmetric: left sits lower and
            reaches further in, right sits higher and tighter, each with a
            slow ambient float so they read as alive rather than a sticker. */}
        <motion.div
          className="pointer-events-none absolute -left-4 top-[34px]"
          animate={{ y: [0, -6, 0], rotate: [0, -2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src="/new-assets/top-left-flower.png"
            alt=""
            width={92}
            height={105}
            aria-hidden
            className="h-auto w-[150px]"
          />
        </motion.div>
        <motion.div
          className="pointer-events-none absolute -right-4 -top-6"
          animate={{ y: [0, -6, 0], rotate: [0, 2, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
        >
          <Image
            src="/new-assets/top-right-flower.png"
            alt=""
            width={92}
            height={105}
            aria-hidden
            className="h-auto w-[132px]"
          />
        </motion.div>

        <p className="font-script mt-2 text-4xl leading-none text-green-secondary">
          Welcome To
        </p>
        <h1 className="font-display mb-4 mt-2 text-4xl font-semibold leading-tight text-green-deep">
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
