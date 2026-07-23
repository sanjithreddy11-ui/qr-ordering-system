import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { LegalSection, LegalList } from "@/components/legal/LegalSection";
import { legalConfig } from "@/components/legal/legal-config";

export const metadata: Metadata = {
  title: `Refund Policy | ${legalConfig.productName}`,
  description:
    "Denova's refund policy covering restaurant-controlled refunds, duplicate payments, failed transactions, and processing timelines.",
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

      <LegalSection heading="2. Duplicate Payments">
        <p>
          If you are charged more than once for the same order due to a technical error, the
          duplicate amount is eligible for a refund. Please report duplicate charges to us with
          your payment reference/transaction ID so we can verify and process the refund via the
          original payment method.
        </p>
      </LegalSection>

      <LegalSection heading="3. Failed Transactions">
        <p>
          If an amount is debited from your account but the order was not successfully placed
          (for example, due to a payment gateway or network error), the debited amount is
          typically auto-reversed by the payment gateway within the standard banking timelines.
          If it is not reversed automatically, please contact us with your transaction details.
        </p>
      </LegalSection>

      <LegalSection heading="4. Incorrect Charges">
        <p>
          If you believe you were charged an incorrect amount (different from what was displayed
          at checkout), please contact us or the Merchant promptly with your order details so the
          discrepancy can be reviewed and, where confirmed, refunded.
        </p>
      </LegalSection>

      <LegalSection heading="5. Refund Processing Timelines">
        <LegalList
          items={[
            "Approved refunds are initiated within 3–5 business days of approval.",
            "Once initiated, funds are typically credited to your original payment method within 5–7 business days, depending on your bank or payment provider.",
            "Timelines may vary based on your bank, card network, or UPI provider and are outside our direct control.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="6. Payment Gateway Processing">
        <p>
          All refunds are processed through Razorpay, our payment gateway partner, back to the
          original payment method used for the transaction. {legalConfig.productName} does not
          process refunds in cash or to any alternate account.
        </p>
      </LegalSection>

      <LegalSection heading="7. Contact Support">
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
