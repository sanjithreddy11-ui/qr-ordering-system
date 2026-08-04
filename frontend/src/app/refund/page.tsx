import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { LegalSection } from "@/components/legal/LegalSection";
import { legalConfig } from "@/components/legal/legal-config";

export const metadata: Metadata = {
  title: `Refund Policy | ${legalConfig.productName}`,
  description:
    "Denova's refund policy covering restaurant-controlled refunds, overcharges, and cash refund processing.",
  alternates: { canonical: `${legalConfig.websiteUrl}/refund` },
  robots: { index: true, follow: true },
};

export default function RefundPage() {
  return (
    <LegalPageLayout
      title="Refund Policy"
      description={`This Refund Policy explains how refunds are handled for orders placed through ${legalConfig.productName}.`}
    >
      <LegalSection heading="1. Restaurant-Controlled Refunds">
        <p>
          {legalConfig.productName} is a software platform that enables restaurants and cafés
          (&quot;Merchants&quot;) to accept orders and payments. Refunds relating to food quality,
          incorrect items, order cancellations by the Merchant, or service issues are approved
          and initiated by the concerned Merchant, as they are responsible for order fulfilment.
        </p>
        <p>
          If you are not satisfied with an order, please contact the restaurant directly in the
          first instance, or reach out to our support team and we will help route your request
          to the relevant Merchant.
        </p>
      </LegalSection>

      <LegalSection heading="2. Overcharges">
        <p>
          Orders are paid for in cash at the counter. If you believe you were charged more than
          the amount shown at checkout, please report it to the restaurant or our support team
          with your order ID so it can be verified and, where confirmed, refunded in cash.
        </p>
      </LegalSection>

      <LegalSection heading="3. Incorrect Charges">
        <p>
          If you believe you were charged an incorrect amount (different from what was displayed
          at checkout), please contact us or the Merchant promptly with your order details so the
          discrepancy can be reviewed and, where confirmed, refunded.
        </p>
      </LegalSection>

      <LegalSection heading="4. Refund Processing">
        <p>
          Since all payments are collected in cash at the counter, approved refunds are also paid
          out in cash by the Merchant directly, typically at the time the discrepancy is
          confirmed. {legalConfig.productName} does not process online refunds or hold customer
          funds itself.
        </p>
      </LegalSection>

      <LegalSection heading="5. Contact Support">
        <p>
          For refund-related queries, please contact us at{" "}
          <a
            href={`mailto:${legalConfig.supportEmail}`}
            className="text-green-deep underline underline-offset-2"
          >
            {legalConfig.supportEmail}
          </a>{" "}
          with your order ID and payment reference number.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
