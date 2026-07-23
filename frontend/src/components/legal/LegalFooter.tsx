import Link from "next/link";
import { legalConfig, legalNavLinks } from "./legal-config";

/**
 * Shared site footer containing the legal policy links required for
 * payment-gateway (Razorpay) website verification.
 *
 * The project didn't previously have a global footer component (the
 * root `page.tsx` is still the default Next.js starter page), so this
 * is a new, self-contained component rather than a modification of an
 * existing one. Drop <LegalFooter /> into any page — it's already
 * included on the four new legal pages.
 */
export default function LegalFooter() {
  const year = new Date().getFullYear();

  return (
    <footer
      className="font-body w-full border-t"
      style={{ borderColor: "var(--border-soft)", background: "var(--bg-secondary)" }}
    >
      <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4 px-8 py-10 text-center sm:flex-row sm:items-center sm:justify-between sm:text-left">
        <p className="font-display text-sm text-text-secondary">
          &copy; {year} {legalConfig.productName}. All rights reserved.
        </p>

        <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {legalNavLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-xs text-text-secondary underline-offset-4 transition-colors hover:text-green-deep hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  );
}
