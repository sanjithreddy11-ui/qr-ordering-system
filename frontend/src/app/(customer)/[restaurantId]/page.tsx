"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  MapPin,
  Phone,
  Star,
  Clock,
  Leaf,
  Coffee,
  Users,
  Heart,
  ArrowRight,
} from "lucide-react";
import BackgroundDecor1 from "@/components/customer/BackgroundDecor1";
import { fetchRestaurant } from "@/lib/api";
import type { Restaurant } from "@/types/session";

// Fields the design below wants that aren't on the Restaurant type yet.
// Once the backend / types/session.ts exposes real values for these,
// swap the fallbacks out for `restaurant.rating`, `restaurant.tagline`, etc.
type ExtendedRestaurant = Restaurant & {
  tagline?: string;
  rating?: number;
  reviewCount?: number;
  hoursLabel?: string;
  isOpenNow?: boolean;
  aboutText?: string;
  aboutImage?: string;
  highlights?: { label: string; sublabel: string }[];
};

const DEFAULT_TAGLINE = "a quiet table, thoughtfully set";
const DEFAULT_HOURS_LABEL = "8:00 AM – 11:00 PM";

const DEFAULT_HIGHLIGHTS = [
  { label: "Fresh Ingredients", sublabel: "Sourced daily" },
  { label: "Cozy Ambience", sublabel: "Feel right at home" },
  { label: "Warm Hospitality", sublabel: "Always for you" },
  { label: "Made with Love", sublabel: "In every dish" },
];

const HIGHLIGHT_ICONS = [Leaf, Coffee, Users, Heart];

// Falls back to true between 8am–11pm local time when the backend hasn't
// told us the real open/closed state yet.
function defaultIsOpenNow() {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 23;
}

function AboutIllustration() {
  return (
    <svg viewBox="0 0 100 110" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="100" height="110" rx="16" fill="var(--bg-secondary)" />
      <path
        d="M28 70 V38 a22 22 0 0 1 44 0 V70"
        stroke="var(--green-deep)"
        strokeWidth="2.5"
        fill="none"
      />
      <rect x="32" y="42" width="36" height="28" fill="var(--green-deep)" opacity="0.08" />
      <path d="M40 70 V50 M50 70 V46 M60 70 V50" stroke="var(--green-deep)" strokeWidth="1.4" opacity="0.5" />
      <circle cx="50" cy="30" r="2" fill="var(--gold-accent)" />
      {/* potted plants either side of the doorway */}
      <path d="M18 78 q4 -14 10 -14 q6 0 8 10" stroke="#7C8C64" strokeWidth="2" fill="none" opacity="0.8" />
      <path d="M64 74 q3 -12 9 -12 q6 0 8 9" stroke="#7C8C64" strokeWidth="2" fill="none" opacity="0.8" />
      <rect x="16" y="78" width="14" height="10" rx="2" fill="var(--green-deep)" opacity="0.75" />
      <rect x="62" y="74" width="14" height="10" rx="2" fill="var(--green-deep)" opacity="0.75" />
      <line x1="12" y1="94" x2="88" y2="94" stroke="var(--border-soft)" strokeWidth="2" />
    </svg>
  );
}

function MiniSprig({ mirror = false }: { mirror?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 56"
      className="h-12 w-4 flex-shrink-0"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <ellipse cx="8" cy="6" rx="3.4" ry="6" fill="#8FA07C" opacity="0.7" />
      {[16, 24, 32, 40, 48].map((y) => (
        <circle key={y} cx="8" cy={y} r="1.1" fill="var(--gold-accent)" opacity="0.55" />
      ))}
    </svg>
  );
}

export default function CafeLandingPage() {
  const searchParams = useSearchParams();
  const table = searchParams.get("table");
  const router = useRouter();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const [restaurant, setRestaurant] = useState<ExtendedRestaurant | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchRestaurant(restaurantId)
      .then((r) => {
        if (!cancelled) setRestaurant(r as ExtendedRestaurant);
      })
      .catch(() => {
        if (!cancelled) setLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [restaurantId]);
  if (!restaurant && !loadFailed) {
  return (
    <main className="relative min-h-dvh overflow-hidden">
      <BackgroundDecor1 />
    </main>
  );
}

  const highlights =
    restaurant?.highlights && restaurant.highlights.length > 0
      ? restaurant.highlights
      : DEFAULT_HIGHLIGHTS;

  const isOpenNow = restaurant?.isOpenNow ?? defaultIsOpenNow();
  const hoursLabel = restaurant?.hoursLabel ?? DEFAULT_HOURS_LABEL;
  const aboutText =
    restaurant?.aboutText ??
    (restaurant
      ? `${restaurant.name} is a place where great food, warm ambience and good conversations come together. Every dish is made with the freshest ingredients and a lot of love.`
      : "");

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-10">
      <BackgroundDecor1 />

      <div className="relative z-10 mx-auto flex min-h-[40dvh] max-w-[480px] flex-col items-center px-6 pt-14 text-center">
        

        {loadFailed && (
          <div className="font-body text-sm text-text-secondary">
            Couldn&apos;t load cafe details right now — you can still browse the menu.
          </div>
        )}

        {restaurant && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full flex-col items-center"
          >
            {/* Logo medallion */}
            <div
              className="mb-6 flex h-24 w-24 items-center justify-center rounded-full"
              style={{
                background: "var(--green-deep)",
                border: "2px solid var(--gold-accent)",
                boxShadow: "0 8px 20px -8px rgba(22, 40, 30, 0.45)",
              }}
            >
              {restaurant.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={restaurant.logo}
                  alt={restaurant.name}
                  className="h-[88px] w-[88px] rounded-full object-cover"
                />
              ) : (
                <Leaf size={30} style={{ color: "var(--gold-accent)" }} />
              )}
            </div>

            {/* Name */}
            <h1 className="font-display mb-4 text-4xl font-semibold leading-tight text-green-deep">
              {restaurant.name}
            </h1>

            <div className="divider-diamond mb-4 w-full max-w-[220px]">
              <span />
            </div>

            <p className="font-display mb-4 text-lg italic text-green-secondary">
              {restaurant.tagline ?? DEFAULT_TAGLINE}
            </p>

            <div className="divider-diamond mb-5 w-full max-w-[220px]">
              <span />
            </div>

            {restaurant.description && (
              <p className="font-body mb-6 max-w-xs text-sm leading-relaxed text-text-secondary">
                {restaurant.description}
              </p>
            )}

            {/* Open now / hours pill */}
            <div
              className="font-body mb-7 flex items-center gap-3 rounded-full bg-bg-card px-5 py-2.5 text-xs text-text-primary"
              style={{ border: "1px solid var(--border-soft)" }}
            >
              <span className="flex items-center gap-1.5 font-medium">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: isOpenNow ? "#3E8E5A" : "#B5482E" }}
                />
                {isOpenNow ? "Open Now" : "Closed"}
              </span>
              <span className="h-3 w-px bg-border-soft" />
              <span className="flex items-center gap-1.5 text-text-secondary">
                <Clock size={13} />
                {hoursLabel}
              </span>
            </div>

            {/* Stats card: rating / location / phone */}
            <div
              className="mb-6 grid w-full grid-cols-3 gap-2 rounded-3xl bg-bg-card px-2 py-6"
              style={{ border: "1px solid var(--border-soft)" }}
            >
              <div className="flex flex-col items-center gap-1.5 px-1">
                <Star size={20} style={{ color: "var(--gold-accent)" }} />
                <span className="font-body text-sm font-semibold text-text-primary">
                  {restaurant.rating ? `${restaurant.rating} Rating` : "New"}
                </span>
                <span className="font-body text-[11px] text-text-secondary">
                  {restaurant.reviewCount ? `${restaurant.reviewCount}+ Reviews` : "Be the first"}
                </span>
              </div>

              <div
                className="flex flex-col items-center gap-1.5 border-x px-1"
                style={{ borderColor: "var(--border-soft)" }}
              >
                <MapPin size={20} style={{ color: "var(--gold-accent)" }} />
                <span className="font-body text-sm font-semibold text-text-primary">
                  {restaurant.address ? restaurant.address.split(",")[0] : "—"}
                </span>
                <span className="font-body text-[11px] text-text-secondary">
                  {restaurant.address ? restaurant.address.split(",").slice(1).join(",").trim() : ""}
                </span>
              </div>

              <div className="flex flex-col items-center gap-1.5 px-1">
                <Phone size={20} style={{ color: "var(--gold-accent)" }} />
                <span className="font-body text-sm font-semibold text-text-primary">
                  {restaurant.phone ?? "—"}
                </span>
                <span className="font-body text-[11px] text-text-secondary">Call Us</span>
              </div>
            </div>

            {/* About section — always shown; uses a real photo if the
                backend provides one, otherwise a line-art illustration */}
            <div
              className="mb-7 grid w-full grid-cols-[100px_1fr] gap-4 rounded-3xl bg-bg-card p-4 text-left"
              style={{ border: "1px solid var(--border-soft)" }}
            >
              <div className="h-full w-full overflow-hidden rounded-2xl bg-bg-secondary">
                {restaurant.aboutImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={restaurant.aboutImage}
                    alt={`About ${restaurant.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AboutIllustration />
                )}
              </div>
              <div>
                <h2 className="font-display mb-2 text-2xl font-semibold text-green-deep">
                  About {restaurant.name.split(" ")[0]}
                </h2>
                <p className="font-body mb-2 text-sm leading-relaxed text-text-secondary">
                  {aboutText}
                </p>
                <p className="font-display text-sm italic" style={{ color: "var(--gold-accent)" }}>
                  – The {restaurant.name.split(" ")[0]} Team
                </p>
              </div>
            </div>

            {/* Why choose grid */}
            <div className="mb-8 w-full">
              <h3 className="font-display mb-1 text-lg font-semibold tracking-wide text-green-deep">
                WHY CHOOSE {restaurant.name.split(" ")[0].toUpperCase()}
              </h3>
              <div className="divider-diamond mx-auto mb-5 w-[140px]">
                <span />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {highlights.map((item, i) => {
                  const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
                  return (
                    <div
                      key={item.label}
                      className="flex flex-col items-center gap-2 rounded-2xl bg-bg-card px-3 py-5"
                      style={{ border: "1px solid var(--border-soft)" }}
                    >
                      <div
                        className="flex h-11 w-11 items-center justify-center rounded-full"
                        style={{ background: "var(--gold-soft)" }}
                      >
                        <Icon size={18} style={{ color: "var(--green-deep)" }} />
                      </div>
                      <span className="font-body text-xs font-semibold text-text-primary">
                        {item.label}
                      </span>
                      <span className="font-body text-[11px] text-text-secondary">
                        {item.sublabel}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        <div className="flex w-full items-center justify-center gap-3">
          <MiniSprig />
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => router.push(`/${restaurantId}/menu${table ? `?table=${table}` : ""}`)}
            className="font-body flex flex-1 max-w-[240px] items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-bg-primary shadow-lg"
            style={{
              background: "linear-gradient(135deg, var(--green-secondary) 0%, var(--green-deep) 100%)",
              letterSpacing: "0.3px",
            }}
          >
            View Menu
            <ArrowRight size={16} />
          </motion.button>
          <MiniSprig mirror />
        </div>
      </div>
    </main>
  );
}