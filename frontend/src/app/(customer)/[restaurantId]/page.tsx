"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  MapPin,
  Star,
  Calendar,
  Clock,
  Leaf,
  Coffee,
  Users,
  Heart,
  ArrowRight,
} from "lucide-react";
import BackgroundDecor2 from "@/components/customer/BackgroundDecor2";

const HIGHLIGHT_ICONS = [Leaf, Coffee, Heart, Users];

// Falls back to true between 8am–11pm local time if you ever want the
// pill to reflect the real clock instead of a fixed value.
function defaultIsOpenNow() {
  const hour = new Date().getHours();
  return hour >= 8 && hour < 23;
}

// Plain placeholder for the About thumbnail — no illustration, just a
// neutral block so the layout holds its shape until a real cafe photo
// is available (swap for <img src={restaurant.aboutImage ?? "..."} />).
function AboutIllustration() {
  return <div className="h-full w-full bg-bg-secondary" />;
}

export default function CafeLandingPage() {
  const searchParams = useSearchParams();
  const table = searchParams.get("table");
  const router = useRouter();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  // Local, frontend-only restaurant data — replaces the previous
  // fetchRestaurant() call so this page renders instantly with no API
  // request. Update these values directly; the menu page still fetches
  // its own data from the backend as before.
  const restaurant = {
    name: "Lifafa Cafe & Bistro",
    logo: "/logo.png",
    tagline: "a quiet table, thoughtfully set",
    description: "A cozy neighborhood cafe serving fresh, seasonal comfort food and specialty drinks.",
    address: "Uppal,Hyderabad",
    hoursLabel: "8:00 AM – 11:00 PM",
    isOpenNow: defaultIsOpenNow(),
    rating: 4.4,
    reviewCount: 2340,
    establishedYear: 2021,
    aboutText:
      "The Lifafa Cafe is a place where great food, warm ambience and good conversations come together. Every dish is made with the freshest ingredients and a lot of love.",
    aboutImage: "/cafe.png",
    highlights: [
      { label: "Fresh Ingredients" },
      { label: "Specialty Coffee" },
      { label: "Made with Love" },
      { label: "Warm Hospitality" },
    ],
  };

  const highlights = restaurant.highlights;
  const isOpenNow = restaurant.isOpenNow;
  const hoursLabel = restaurant.hoursLabel;
  const aboutText = restaurant.aboutText;

  return (
    <main className="relative min-h-dvh overflow-x-hidden pb-10">
      <BackgroundDecor2 />

      <div className="relative z-10 mx-auto flex min-h-[40dvh] max-w-[480px] flex-col items-center px-6 pt-14 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="flex w-full flex-col items-center"
        >
          {/* Logo medallion — premium, ATTENTION-GRABBING treatment.
              Footprint grows from 96px to 120px to make room for the
              pulse rings, which nudges spacing below by ~12px — an
              unavoidable side effect of the ring/pulse effects rather
              than a deliberate layout change. */}
          <div
            className="relative mb-6 flex items-center justify-center"
            style={{ width: 120, height: 120 }}
          >
            {/* Big soft ambient halo behind everything */}
            <div
              className="pointer-events-none absolute rounded-full"
              style={{
                width: 260,
                height: 260,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(circle, rgba(201,166,104,0.14) 0%, rgba(201,166,104,0) 70%)",
              }}
            />

            {/* Bright, clearly-pulsing gold glow */}
            <motion.div
              className="pointer-events-none absolute rounded-full"
              style={{
                width: 150,
                height: 150,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                background:
                  "radial-gradient(circle, rgba(201,166,104,0.65) 0%, rgba(201,166,104,0) 70%)",
                filter: "blur(30px)",
              }}
              animate={{ opacity: [0.28, 0.6, 0.28], scale: [1, 1.15, 1] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Radar-style pulse rings — two, staggered, continuously
                expanding and fading outward. This is the main thing that
                pulls the eye without needing motion elsewhere on the page. */}
            {[0, 1].map((i) => (
              <motion.div
                key={i}
                className="pointer-events-none absolute rounded-full"
                style={{
                  width: 108,
                  height: 108,
                  left: "50%",
                  top: "50%",
                  x: "-50%",
                  y: "-50%",
                  border: "1.5px solid rgba(201,166,104,0.6)",
                }}
                animate={{ scale: [1, 1.55], opacity: [0.55, 0] }}
                transition={{
                  duration: 2.6,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: i * 1.3,
                }}
              />
            ))}

            {/* Initial entrance — runs once on mount, a touch more
                dramatic than a plain fade so the logo announces itself */}
            <motion.div
              className="relative"
              style={{ width: 108, height: 108 }}
              initial={{ opacity: 0, scale: 0.7, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.8, type: "spring", bounce: 0.4 }}
            >
              {/* Float + hover/tap */}
              <motion.div
                className="relative flex items-center justify-center"
                style={{ width: 108, height: 108 }}
                animate={{ y: [0, -6, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.95 }}
              >
                {/* Bright light continuously orbiting the ring — this is
                    the detail that reads as "alive" at a glance */}
                <motion.div
                  className="pointer-events-none absolute inset-0"
                  style={{ borderRadius: "9999px" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3.5, repeat: Infinity, ease: "linear" }}
                >
                  <span
                    className="absolute rounded-full"
                    style={{
                      top: -3,
                      left: "50%",
                      width: 12,
                      height: 12,
                      marginLeft: -6,
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,215,140,0.7) 45%, rgba(255,215,140,0) 75%)",
                      boxShadow: "0 0 12px 3px rgba(255,215,140,0.65)",
                    }}
                  />
                </motion.div>

                {/* Outer ring */}
                <div
                  className="pointer-events-none absolute inset-0 rounded-full"
                  style={{ border: "2px solid rgba(201,166,104,0.9)" }}
                />

                {/* Inner ring + layered shadow + glass highlight, on the
                    same 96px circle that holds the logo image */}
                <div
                  className="absolute flex items-center justify-center overflow-hidden rounded-full"
                  style={{
                    inset: 6,
                    background: "var(--green-deep)",
                    border: "1px solid rgba(255,255,255,0.65)",
                    boxShadow:
                      "0 8px 20px rgba(0,0,0,0.15), 0 20px 45px rgba(0,0,0,0.12), 0 0 45px rgba(201,166,104,0.35)",
                  }}
                >
                  {/* Glass highlight — top-left, ~10% opacity */}
                  <div
                    className="pointer-events-none absolute rounded-full"
                    style={{
                      top: "-15%",
                      left: "-15%",
                      width: "65%",
                      height: "65%",
                      background:
                        "radial-gradient(circle, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0) 70%)",
                    }}
                  />

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
              </motion.div>
            </motion.div>
          </div>

          {/* Name */}
          <h1 className="font-display mb-4 text-4xl font-semibold leading-tight text-green-deep">
            {restaurant.name}
          </h1>

          <div className="divider-diamond mb-4 w-full max-w-[220px]">
            <span />
          </div>

          <p className="font-display mb-4 text-lg italic text-green-secondary">
            {restaurant.tagline}
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

          {/* Stats card: rating / location / established year */}
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
              <Calendar size={20} style={{ color: "var(--gold-accent)" }} />
              <span className="font-body text-sm font-semibold text-text-primary">
                Est. {restaurant.establishedYear}
              </span>
              <span className="font-body text-[11px] text-text-secondary">Years of trust</span>
            </div>
          </div>

          {/* About + highlights — photo and text side by side (matches the
              reference), icon row as a full-width strip underneath */}
          <div
            className="mb-8 w-full overflow-hidden rounded-3xl bg-bg-card text-left"
            style={{ border: "1px solid var(--border-soft)" }}
          >
            <div className="grid grid-cols-[128px_1fr] gap-4 p-4">
              <div
                className="overflow-hidden rounded-2xl"
                style={{ border: "2px solid var(--gold-accent)" }}
              >
                {restaurant.aboutImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={restaurant.aboutImage}
                    alt={`Inside ${restaurant.name}`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <AboutIllustration />
                )}
              </div>

              <div className="flex flex-col justify-center">
                <h2 className="font-display mb-2 text-2xl font-semibold leading-tight text-green-deep">
                  About Lifafa
                </h2>

                <div className="divider-diamond mb-3 w-full max-w-[160px]">
                  <span />
                </div>

                <p className="font-body mb-2 text-xs leading-relaxed text-text-secondary">
                  {aboutText}
                </p>

                <p className="font-display text-xs italic" style={{ color: "var(--gold-accent)" }}>
                  – Lifafa Team
                </p>
              </div>
            </div>

            <div
              className="flex w-full items-start justify-between px-5 py-5"
              style={{ borderTop: "1px solid var(--border-soft)" }}
            >
              {highlights.map((item, i) => {
                const Icon = HIGHLIGHT_ICONS[i % HIGHLIGHT_ICONS.length];
                return (
                  <div
                    key={item.label}
                    className="flex flex-1 flex-col items-center gap-2 px-1 text-center"
                    style={i > 0 ? { borderLeft: "1px solid var(--border-soft)" } : undefined}
                  >
                    <Icon size={20} style={{ color: "var(--gold-accent)" }} />
                    <span className="font-body text-[11px] font-medium leading-tight text-text-primary">
                      {item.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => router.push(`/${restaurantId}/menu${table ? `?table=${table}` : ""}`)}
          className="font-body flex w-full max-w-xs items-center justify-center gap-2 rounded-full px-8 py-4 text-sm font-semibold text-bg-primary shadow-lg"
          style={{
            background: "linear-gradient(135deg, var(--green-secondary) 0%, var(--green-deep) 100%)",
            letterSpacing: "0.3px",
          }}
        >
          View Menu
          <ArrowRight size={16} />
        </motion.button>
      </div>
    </main>
  );
}