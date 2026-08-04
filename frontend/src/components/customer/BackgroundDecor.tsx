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
      {/* Layer 1 — Paper texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: "url('/new-assets/paper-texture.webp')",
          backgroundRepeat: "repeat",
          backgroundSize: "300px 300px",
          opacity: 0.1,
          mixBlendMode: "multiply",
        }}
      />

      {/* Layer 2 — Soft watercolor ink stains */}
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
          <Image
            src="/assets/ink-stain.svg"
            alt=""
            width={320}
            height={240}
          />
        </div>
      ))}

      {/* Layer 3 — Bottom-left branch */}
      <div className="fixed bottom-0 left-0 z-0 w-[210px] opacity-90">
        <Image
          src="/assets/branch-bottomleft-removebg-preview.png"
          alt=""
          width={280}
          height={320}
        />
      </div>

      {/* Layer 4 — Top-right sakura branch */}
      <div className="fixed right-[-32px] top-[-12px] z-0 w-[350px] opacity-80">
        <Image
          src="/assets/branch.png"
          alt=""
          width={350}
          height={1000}
          priority
        />
      </div>
    </div>
  );
}