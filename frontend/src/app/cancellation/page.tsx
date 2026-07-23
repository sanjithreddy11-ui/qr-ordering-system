import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { LegalSection, LegalList } from "@/components/legal/LegalSection";
import { legalConfig } from "@/components/legal/legal-config";

export const metadata: Metadata = {
  title: `Cancellation Policy | ${legalConfig.productName}`,
  description:
    "Denova's cancellation policy for customer and restaurant-initiated order cancellations, including non-refundable situations.",
  alternates: { canonical: `${legalConfig.websiteUrl}/cancellation` },
  robots: { index: true, follow: true },
};

export default function CancellationPage() {
  return (
    <LegalPageLayout
      title="Cancellation Policy"
      description={`This Cancellation Policy explains when and how orders placed through ${legalConfig.productName} can be cancelled.`}
    >
      <LegalSection heading="1. Customer Cancellations">
        <p>
          Once an order is placed and confirmed, cancellation is generally only possible if the
          restaurant has not yet started preparing the order. Please contact the restaurant staff
          or use the in-app cancellation option, if available, as soon as possible after placing
          an order you wish to cancel.
        </p>
      </LegalSection>

      <LegalSection heading="2. Restaurant Cancellations">
        <p>
          A restaurant may cancel an order in situations such as an item being unavailable, an
          inability to fulfil the order within a reasonable time, or unforeseen operational
          issues. Where a restaurant cancels an order that has already been paid for, the amount
          paid is eligible for a full refund in accordance with our Refund Policy.
        </p>
      </LegalSection>

      <LegalSection heading="3. Non-Refundable Situations">
        <p>Cancellation requests may not be accepted, and amounts may not be refundable, where:</p>
        <LegalList
          items={[
            "The order has already been prepared or is substantially in progress.",
            "The cancellation request is made after the restaurant has confirmed and begun preparing the food.",
            "The order has already been served or handed over to the customer.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Order Preparation Policy">
        <p>
          Because food preparation typically begins shortly after an order is confirmed, the
          window for cancellation is generally short. We recommend reviewing your order carefully
          before completing payment to avoid unwanted cancellations.
        </p>
      </LegalSection>

      <LegalSection heading="5. Failed Payment Scenarios">
        <p>
          If a payment fails or is not completed, the order is not considered placed and no
          cancellation is required. If an amount was debited despite a failed order, please refer
          to our Refund Policy regarding failed transactions.
        </p>
      </LegalSection>

      <LegalSection heading="6. Contact Support">
        <p>
          For help with cancelling an order, please contact us at{" "}
          <a
            href={`mailto:${legalConfig.supportEmail}`}
            className="text-green-deep underline underline-offset-2"
          >
            {legalConfig.supportEmail}
          </a>{" "}
          or reach out to the restaurant directly for time-sensitive requests.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
