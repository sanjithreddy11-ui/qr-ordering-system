import Image from "next/image";

const STAINS = [
  // Top left
  {
    top: "6%",
    left: "-12%",
    size: 240,
    rotate: -12,
    opacity: 0.28,
  },

  // Top center
  {
    top: "8%",
    left: "42%",
    size: 130,
    rotate: 8,
    opacity: 0.18,
  },

  // Top right
  {
    top: "18%",
    left: "82%",
    size: 230,
    rotate: 20,
    opacity: 0.26,
  },

  // Middle left
  {
    top: "52%",
    left: "-10%",
    size: 160,
    rotate: -15,
    opacity: 0.5,
  },

  // Middle right
  {
    top: "46%",
    left: "88%",
    size: 170,
    rotate: 10,
    opacity: 0.7,
  },

  // Bottom left
  {
    top: "78%",
    left: "-8%",
    size: 260,
    rotate: 12,
    opacity: 0.7,
  },

  // Bottom center
  {
    top: "90%",
    left: "40%",
    size: 200,
    rotate: -8,
    opacity: 0.65,
  },

  // Bottom right
  {
    top: "74%",
    left: "82%",
    size: 210,
    rotate: 18,
    opacity: 0.7,
  },
];

export default function CartBackground() {
  return (
    <div
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      aria-hidden="true"
    >
      {/* Washi Paper Texture */}
      <div className="washi-bg" />

      {/* Ink Stains */}
      {STAINS.map((s, i) => (
        <div
          key={i}
          className="absolute"
          style={{
            top: s.top,
            left: s.left,
            width: s.size,
            opacity: s.opacity,
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
    </div>
  );
}