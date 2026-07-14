"use client";

import React, { useRef, useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { motion } from "framer-motion";

export interface EventItem {
  id: string;
  image: string;
  alt: string;
}

export interface EventsSectionProps {
  heading?: string;
  subtitle?: string;
  events: EventItem[];
}

/**
 * Section 3 — "Happening Events".
 * Horizontal swipeable carousel (native CSS scroll-snap, no new
 * dependency) with dot page indicators that track scroll position.
 */
export default function EventsSection({
  heading = "Happening Events",
  subtitle = "Explore our happening events —where the fun never stops!",
  events,
}: EventsSectionProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const handleScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const slideWidth = track.clientWidth;
    const index = Math.round(track.scrollLeft / slideWidth);
    setActiveIndex(index);
  }, []);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    track.addEventListener("scroll", handleScroll, { passive: true });
    return () => track.removeEventListener("scroll", handleScroll);
  }, [handleScroll]);

  const goToSlide = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: index * track.clientWidth, behavior: "smooth" });
  };

  if (events.length === 0) return null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.5 }}
      className="relative mx-auto max-w-[480px] px-6 py-10"
    >
      <Image
        src="/new-assets/flower-event-left.png"
        alt=""
        width={237}
        height={162}
        aria-hidden
        className="pointer-events-none absolute -left-2 top-2 h-auto w-[110px] opacity-90"
      />
      <Image
        src="/new-assets/flower-event-right.png"
        alt=""
        width={101}
        height={103}
        aria-hidden
        className="pointer-events-none absolute -right-2 top-2 h-auto w-[75px] opacity-90"
      />

      <div className="relative text-center">
        <h2 className="font-display mb-2 text-4xl font-semibold leading-tight text-green-deep">
          {heading}
        </h2>
        <p className="font-body mb-7 text-sm text-text-secondary">{subtitle}</p>
      </div>

      <div
        ref={trackRef}
        className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-1"
        style={{ scrollbarWidth: "none" }}
      >
        {events.map((event) => (
          <div
            key={event.id}
            className="aspect-[4/5] w-full flex-none snap-center overflow-hidden rounded-3xl"
            style={{ boxShadow: "0 12px 28px rgba(0,0,0,0.16)" }}
          >
            <Image
              src={event.image}
              alt={event.alt}
              width={600}
              height={750}
              className="h-full w-full object-cover"
            />
          </div>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2">
        {events.map((event, i) => (
          <button
            key={event.id}
            type="button"
            aria-label={`Go to event ${i + 1}`}
            onClick={() => goToSlide(i)}
            className="h-2 rounded-full transition-all"
            style={{
              width: i === activeIndex ? 20 : 8,
              background: i === activeIndex ? "var(--green-deep)" : "var(--border-soft)",
            }}
          />
        ))}
      </div>
    </motion.section>
  );
}
