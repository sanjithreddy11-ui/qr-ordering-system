"use client";

interface Props {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export default function BillSummary({
  subtotal,
  taxAmount,
  totalAmount,
}: Props) {
  const Row = ({
    label,
    value,
    total = false,
  }: {
    label: string;
    value: number;
    total?: boolean;
  }) => (
    <div
      className={`flex items-center justify-between py-3 ${
        !total && "border-b border-border-soft/50"
      }`}
    >
      <span
        className={`font-body ${
          total
            ? "text-[18px] font-semibold text-text-primary"
            : "text-[14px] text-text-secondary"
        }`}
      >
        {label}
      </span>

      <span
        className={`font-body ${
          total
            ? "text-[20px] font-bold text-text-primary"
            : "text-[15px] font-medium text-text-primary"
        }`}
      >
        ₹ {value}
      </span>
    </div>
  );

  return (
    <div
      className="relative mx-4 mt-4 overflow-hidden rounded-[28px] p-5 backdrop-blur-md"
      style={{
        background: "rgba(255,255,255,0.55)",
        border: "1px solid rgba(255,255,255,0.4)",
        boxShadow: `
          0 8px 24px rgba(0,0,0,0.06),
          inset 0 1px 1px rgba(255,255,255,0.7)
        `,
      }}
    >
      {/* Glass Shine */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(135deg, rgba(255,255,255,0.2), transparent 50%)",
        }}
      />

      <div className="relative z-10">
        <h2 className="font-display mb-4 text-[28px] font-semibold text-text-primary">
          Bill Summary
        </h2>

        <Row
          label="Item Total"
          value={subtotal}
        />

        <Row
          label="GST (5%)"
          value={taxAmount}
        />

        <div className="my-4 border-t border-dashed border-green-primary/40" />

        <Row
          label="To Pay"
          value={totalAmount}
          total
        />
      </div>
    </div>
  );
}