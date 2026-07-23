import type { ReactNode } from "react";

export function LegalSection({
  heading,
  children,
}: {
  heading: string;
  children: ReactNode;
}) {
  return (
    <section className="mb-10 last:mb-0">
      <div className="mb-3 flex items-center gap-4">
        <h2 className="font-display whitespace-nowrap text-xl font-semibold text-green-deep">
          {heading}
        </h2>
        <span
          className="h-px flex-1"
          style={{ background: "var(--gold-accent)", opacity: 0.5 }}
        />
      </div>
      <div className="font-body flex flex-col gap-3 text-sm leading-relaxed text-text-primary">
        {children}
      </div>
    </section>
  );
}

export function LegalList({ items }: { items: ReactNode[] }) {
  return (
    <ul className="ml-5 flex list-disc flex-col gap-2 text-sm leading-relaxed text-text-primary">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
