/**
 * Central place for the details that show up across the legal pages
 * (Terms, Privacy, Refund, Cancellation) and the legal footer.
 *
 * Update these values to match your registered business details —
 * they're referenced by all four policy pages.
 */
export const legalConfig = {
  productName: "Denova",
  legalEntityName: "Denova", // Replace with your registered business/company name if different
  supportEmail: "support@denova.app",
  websiteUrl: "https://denova-demo.vercel.app",
  jurisdiction: "India",
  lastUpdated: "23 July 2026",
};

export const legalNavLinks = [
  { href: "/terms", label: "Terms & Conditions" },
  { href: "/privacy", label: "Privacy Policy" },
  { href: "/refund", label: "Refund Policy" },
  { href: "/cancellation", label: "Cancellation Policy" },
];
