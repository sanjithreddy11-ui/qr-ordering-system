import Image from "next/image";

const STAINS = [
  { top: "10%", left: "-10%", size: 210, rotate: -10, opacity: 0.32 },
  { top: "46%", left: "70%", size: 175, rotate: 24, opacity: 0.26 },
  { top: "80%", left: "-12%", size: 185, rotate: 8, opacity: 0.28 },
];

export default function BackgroundDecor() {
  return (
   <div
  className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
  aria-hidden="true"
>
      {/* Layer 2 — soft watercolor ink stains, barely perceptible */}
      {STAINS.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{
              top: s.top,
              left: s.left,
              width: s.size,
              opacity: s.opacity * 0.8,
              transform: `rotate(${s.rotate}deg)`,
          }}

        >
          <Image src="/assets/ink-stain.svg" alt="" width={320} height={240} />
        </div>
      ))}
    </div>
  );
}
