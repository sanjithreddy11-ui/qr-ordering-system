"use client";

import React from "react";

/**
 * Decorative botanical layer for the cafe landing page.
 * Pure line-art SVG, no raster images, no motion — sits behind the content
 * column and never competes with it. Fully replaces the previous decor.
 */

type Pt = [number, number];

function Blossom({ x, y, size = 7, rotate = 0 }: { x: number; y: number; size?: number; rotate?: number }) {
  const petals = [0, 72, 144, 216, 288];
  return (
    <g transform={`rotate(${rotate} ${x} ${y})`}>
      {petals.map((rot) => (
        <ellipse
          key={rot}
          cx={x}
          cy={y - size * 0.55}
          rx={size * 0.42}
          ry={size * 0.62}
          fill="#F3C2CC"
          opacity={0.92}
          transform={`rotate(${rot} ${x} ${y})`}
        />
      ))}
      <circle cx={x} cy={y} r={size * 0.16} fill="#D98BA0" />
    </g>
  );
}

function Leaf({ x, y, size = 10, rotate = 0, tone = "#8FA07C" }: { x: number; y: number; size?: number; rotate?: number; tone?: string }) {
  return (
    <ellipse
      cx={x}
      cy={y}
      rx={size * 0.34}
      ry={size}
      fill={tone}
      opacity={0.55}
      transform={`rotate(${rotate} ${x} ${y})`}
    />
  );
}

/** A gently curving stem passing through the given points. */
function stemPath(points: Pt[]) {
  return points.reduce((d, [x, y], i) => (i === 0 ? `M ${x} ${y}` : `${d} Q ${points[i - 1][0] + 10} ${points[i - 1][1] + 6}, ${x} ${y}`), "");
}

function CherryBlossomBranch() {
  const stem: Pt[] = [
    [2, 6],
    [46, 22],
    [92, 46],
    [136, 78],
    [172, 118],
    [200, 160],
  ];
  const blossoms: { x: number; y: number; size: number; rotate: number }[] = [
    { x: 30, y: 8, size: 9, rotate: 10 },
    { x: 58, y: 20, size: 6, rotate: -8 },
    { x: 76, y: 10, size: 7, rotate: 30 },
    { x: 100, y: 34, size: 9, rotate: -15 },
    { x: 120, y: 52, size: 6, rotate: 12 },
    { x: 138, y: 40, size: 7, rotate: -20 },
    { x: 160, y: 74, size: 8, rotate: 8 },
    { x: 178, y: 98, size: 6, rotate: -10 },
    { x: 150, y: 96, size: 5, rotate: 25 },
  ];
  const leaflets: { x: number; y: number; rotate: number }[] = [
    { x: 44, y: 30, rotate: 40 },
    { x: 88, y: 58, rotate: -30 },
    { x: 128, y: 90, rotate: 50 },
  ];

  return (
    <svg viewBox="0 0 220 200" className="h-full w-full" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d={stemPath(stem)} stroke="#9C6B52" strokeWidth="1.6" strokeLinecap="round" opacity={0.8} />
      {leaflets.map((l, i) => (
        <Leaf key={i} x={l.x} y={l.y} size={7} rotate={l.rotate} tone="#B9C79E" />
      ))}
      {blossoms.map((b, i) => (
        <Blossom key={i} {...b} />
      ))}
    </svg>
  );
}

function LeafSprig({ mirror = false }: { mirror?: boolean }) {
  const stem: Pt[] = [
    [4, 200],
    [10, 160],
    [16, 120],
    [22, 80],
    [28, 44],
    [34, 10],
  ];
  const leaves: { x: number; y: number; rotate: number; size: number }[] = [
    { x: 14, y: 176, rotate: -50, size: 11 },
    { x: 24, y: 150, rotate: 45, size: 10 },
    { x: 12, y: 130, rotate: -40, size: 9 },
    { x: 26, y: 104, rotate: 50, size: 10 },
    { x: 14, y: 80, rotate: -45, size: 9 },
    { x: 28, y: 56, rotate: 40, size: 8 },
    { x: 20, y: 30, rotate: -35, size: 7 },
  ];

  return (
    <svg
      viewBox="0 0 44 210"
      className="h-full w-full"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={mirror ? { transform: "scaleX(-1)" } : undefined}
    >
      <path d={stemPath(stem)} stroke="#7C8C64" strokeWidth="1.4" strokeLinecap="round" opacity={0.75} />
      {leaves.map((l, i) => (
        <Leaf key={i} x={l.x} y={l.y} size={l.size} rotate={l.rotate} tone="#8FA07C" />
      ))}
    </svg>
  );
}

export default function BackgroundDecor1() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute -left-4 -top-2 h-[190px] w-[210px] sm:h-[220px] sm:w-[240px]">
        <CherryBlossomBranch />
      </div>

      <div className="absolute -right-3 top-10 h-[130px] w-[80px] opacity-70">
        <LeafSprig mirror />
      </div>

      <div className="absolute -left-2 bottom-24 h-[220px] w-[46px]">
        <LeafSprig />
      </div>

      <div className="absolute -right-1 bottom-32 h-[150px] w-[32px] opacity-60">
        <LeafSprig mirror />
      </div>
    </div>
  );
}