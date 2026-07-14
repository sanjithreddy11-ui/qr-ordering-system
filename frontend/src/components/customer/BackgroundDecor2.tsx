import Image from "next/image";

export default function BackgroundDecor() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden -z-10"
      aria-hidden="true"
    >
      {/* Base paper texture */}
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: "#F8F5EF",
          backgroundImage: "url('/assets/paper-texture.webp')",
          backgroundRepeat: "repeat",
          backgroundSize: "700px",
          opacity: 0.95,
        }}
      />

      {/* Soft watercolor overlay */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 20% 15%, rgba(214,196,160,0.12), transparent 35%), radial-gradient(circle at 80% 45%, rgba(208,220,235,0.10), transparent 35%), radial-gradient(circle at 40% 85%, rgba(224,210,185,0.10), transparent 40%)",
        }}
      />

      {/* Top Left Floral */}
      <Image
        src="/assets/floral-top-left.png"
        alt=""
        width={180}
        height={180}
        className="absolute top-0 left-0 opacity-35"
      />

      {/* Top Right Floral */}
      <Image
        src="/assets/floral-top-right.png"
        alt=""
        width={180}
        height={180}
        className="absolute top-0 right-0 opacity-35"
      />

      {/* Bottom Left Floral */}
      <Image
        src="/assets/floral-bottom-left.png"
        alt=""
        width={240}
        height={240}
        className="absolute bottom-0 left-0 opacity-40"
      />

      {/* Bottom Right Floral */}
      <Image
        src="/assets/floral-bottom-right.png"
        alt=""
        width={240}
        height={240}
        className="absolute bottom-0 right-0 opacity-40"
      />

      {/* Fine paper grain */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(#000 0.5px, transparent 0.5px)",
          backgroundSize: "8px 8px",
        }}
      />
    </div>
  );
}