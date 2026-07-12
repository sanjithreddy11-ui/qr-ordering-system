"use client";

import React from "react";

/**
 * Decorative botanical background for the cafe landing page.
 *
 * Every flower/leaf shape below is a real SVG file living in
 * /public/assets/decor — nothing is hand-drawn inline. The files came
 * from Phosphor Icons (MIT licensed, https://github.com/phosphor-icons/core):
 *   - /assets/decor/flower.svg
 *   - /assets/decor/leaf.svg
 * Colors are baked into the files (soft pink for blossoms, sage green
 * for leaves) to match the palette in globals.css.
 *
 * This component only decides WHERE to place copies of those files —
 * position, size, rotation, opacity — to build a branch-like cluster.
 * Swap the STOPS arrays below to rebalance the composition, or swap the
 * source files for different art without touching the layout logic.
 */

type Stop = {
  asset: "flower" | "leaf";
  top: string;
  left: string;
  size: number;
  rotate?: number;
  opacity?: number;
};

const TOP_LEFT_BRANCH: Stop[] = [
  { asset: "flower", top: "2%", left: "10%", size: 30, rotate: -10 },
  { asset: "flower", top: "6%", left: "2%", size: 22, rotate: 20 },
  { asset: "leaf", top: "4%", left: "20%", size: 26, rotate: 40 },
  { asset: "flower", top: "12%", left: "22%", size: 26, rotate: 8 },
  { asset: "flower", top: "16%", left: "8%", size: 18, rotate: -25 },
  { asset: "leaf", top: "18%", left: "30%", size: 22, rotate: -30 },
  { asset: "flower", top: "22%", left: "34%", size: 20, rotate: 15 },
  { asset: "leaf", top: "1%", left: "0%", size: 20, rotate: 70 },
];

const BOTTOM_LEFT_SPRIG: Stop[] = [
  { asset: "leaf", top: "62%", left: "0%", size: 22, rotate: -35 },
  { asset: "leaf", top: "68%", left: "4%", size: 20, rotate: 30 },
  { asset: "leaf", top: "74%", left: "1%", size: 18, rotate: -40 },
  { asset: "leaf", top: "80%", left: "5%", size: 18, rotate: 35 },
  { asset: "leaf", top: "86%", left: "2%", size: 16, rotate: -30 },
  { asset: "leaf", top: "91%", left: "5%", size: 14, rotate: 25 },
];

const BOTTOM_RIGHT_SPRIG: Stop[] = [
  { asset: "leaf", top: "68%", left: "94%", size: 18, rotate: 35, opacity: 0.7 },
  { asset: "leaf", top: "75%", left: "97%", size: 16, rotate: -30, opacity: 0.7 },
  { asset: "leaf", top: "82%", left: "94%", size: 15, rotate: 30, opacity: 0.6 },
];

const TOP_RIGHT_ACCENT: Stop[] = [
  { asset: "leaf", top: "8%", left: "96%", size: 20, rotate: -20, opacity: 0.6 },
  { asset: "leaf", top: "13%", left: "99%", size: 16, rotate: 25, opacity: 0.5 },
];

function DecorLayer({ stops }: { stops: Stop[] }) {
  return (
    <>
      {stops.map((s, i) => (
        <img
          key={i}
          src={`/${s.asset}.svg`}
          alt=""
          aria-hidden="true"
          className="absolute"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            height: s.size,
            transform: `rotate(${s.rotate ?? 0}deg)`,
            opacity: s.opacity ?? 0.9,
          }}
        />
      ))}
    </>
  );
}

export default function BackgroundDecor() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <DecorLayer stops={TOP_LEFT_BRANCH} />
      <DecorLayer stops={TOP_RIGHT_ACCENT} />
      <DecorLayer stops={BOTTOM_LEFT_SPRIG} />
      <DecorLayer stops={BOTTOM_RIGHT_SPRIG} />
    </div>
  );
}