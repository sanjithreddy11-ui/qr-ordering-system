import Link from "next/link";
import type { ReactNode } from "react";
import LegalFooter from "./LegalFooter";
import { legalConfig } from "./legal-config";

interface LegalPageLayoutProps {
  title: string;
  description: string;
  children: ReactNode;
}

/**
 * Shared shell for /terms, /privacy, /refund and /cancellation.
 * Reuses the app's existing design tokens (colors, fonts, spacing,
 * border/card treatment) defined in globals.css so these pages feel
 * native to the product rather than bolted on.
 */
export default function LegalPageLayout({
  title,
  description,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-bg-primary">
      <header
        className="w-full border-b"
        style={{ borderColor: "var(--border-soft)" }}
      >
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-8 py-6">
          <Link href="/" className="font-display text-xl font-semibold text-green-deep">
            {legalConfig.productName}
          </Link>
          <Link
            href="/"
            className="font-body text-sm text-text-secondary transition-colors hover:text-green-deep"
          >
            &larr; Back to home
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto w-full max-w-3xl px-8 py-14 sm:py-16">
          <div className="mb-10">
            <h1 className="font-display text-3xl font-semibold leading-tight text-green-deep sm:text-4xl">
              {title}
            </h1>
            <p className="font-body mt-3 max-w-2xl text-base text-text-secondary">
              {description}
            </p>
            <div
              className="mt-6 inline-flex items-center gap-2 rounded-full border px-4 py-1.5"
              style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)" }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ background: "var(--gold-accent)" }}
              />
              <span className="font-body text-xs text-text-secondary">
                Last updated: {legalConfig.lastUpdated}
              </span>
            </div>
          </div>

          <div
            className="rounded-2xl border p-8 sm:p-10"
            style={{ borderColor: "var(--border-soft)", background: "var(--bg-card)" }}
          >
            {children}
          </div>
        </div>
      </main>

      <LegalFooter />
    </div>
  );
}
