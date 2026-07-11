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

      {/* Layer 3 — traditional sumi-e mountains, extreme bottom corners only */}
      <div className="absolute -bottom-10 -left-16 w-[280px] opacity-[0.42]">
        <Image src="/assets/mountains-sumie.svg" alt="" width={520} height={360} />
      </div>
      <div className="absolute -bottom-14 -right-20 w-[260px] scale-x-[-1] opacity-[0.3]">
        <Image src="/assets/mountains-sumie.svg" alt="" width={520} height={360} />
      </div>

      {/* Layer 3.5 — sumi-e branch rising along the left edge, balancing the top-right sakura */}
      <div className="fixed bottom-0 left-0 z-0 w-[210px] opacity-90">
        <Image src="/assets/branch-bottomleft-removebg-preview.png" alt="" width={280} height={320} />
      </div>

      {/* Layer 4 — sakura branch, top-right */}
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
