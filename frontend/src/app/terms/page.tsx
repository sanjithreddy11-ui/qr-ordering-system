import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { LegalSection, LegalList } from "@/components/legal/LegalSection";
import { legalConfig } from "@/components/legal/legal-config";

export const metadata: Metadata = {
  title: `Terms & Conditions | ${legalConfig.productName}`,
  description:
    "Terms and Conditions governing the use of Denova, a QR-based digital menu and ordering platform for restaurants and cafés.",
  alternates: { canonical: `${legalConfig.websiteUrl}/terms` },
  robots: { index: true, follow: true },
};

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="Terms & Conditions"
      description={`These Terms govern your access to and use of ${legalConfig.productName}, a QR-based digital menu and ordering platform for restaurants and cafés.`}
    >
      <LegalSection heading="1. Acceptance of Terms">
        <p>
          By accessing or using {legalConfig.productName} (&quot;the Platform&quot;), whether as a
          diner scanning a QR code or as a restaurant/café using our dashboard, you agree to be
          bound by these Terms & Conditions. If you do not agree to these Terms, please do not
          use the Platform.
        </p>
        <p>
          We may update these Terms from time to time. Continued use of the Platform after
          changes are posted constitutes acceptance of the revised Terms.
        </p>
      </LegalSection>

      <LegalSection heading="2. Platform Usage">
        <p>
          {legalConfig.productName} provides software that enables restaurants and cafés to
          create digital QR menus, receive orders, accept online payments, manage orders in
          real time, and view analytics. Customers use the Platform to scan a QR code, browse a
          restaurant&apos;s digital menu, place food orders, and pay online.
        </p>
        <p>
          You agree to use the Platform only for lawful purposes and in a manner that does not
          infringe the rights of, or restrict or inhibit the use of the Platform by, any other
          user.
        </p>
      </LegalSection>

      <LegalSection heading="3. User Responsibilities">
        <p>As a customer using the Platform, you agree to:</p>
        <LegalList
          items={[
            "Provide accurate information (such as contact number and order details) when placing an order.",
            "Review your order and the total amount payable before completing payment.",
            "Use the Platform only for genuine orders and not for any fraudulent or abusive activity.",
            "Understand that food quality, preparation, and fulfilment are the responsibility of the individual restaurant, not Denova.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="4. Restaurant Responsibilities">
        <p>
          Restaurants and cafés using {legalConfig.productName} (&quot;Merchants&quot;) are
          independently responsible for:
        </p>
        <LegalList
          items={[
            "Setting and updating menu items, descriptions, and pricing.",
            "Food preparation, quality, hygiene, and safety in line with applicable food-safety laws.",
            "Order acceptance, fulfilment, and delivery or serving of orders.",
            "Approving, processing, or declining refund requests from their customers.",
            "Handling customer support queries relating to food, orders, or service.",
          ]}
        />
        <p>
          {legalConfig.productName} only provides the underlying software platform and is not a
          party to the transaction between a Merchant and its customer.
        </p>
      </LegalSection>

      <LegalSection heading="5. Payments">
        <p>
          Online payments made through the Platform are processed by our third-party payment
          gateway partner, Razorpay. {legalConfig.productName} does not store your full card,
          UPI, or banking credentials — these are handled directly by the payment gateway in
          accordance with applicable security standards.
        </p>
        <p>
          Amounts charged reflect the menu prices set by the relevant Merchant, along with any
          applicable taxes or charges disclosed at checkout.
        </p>
      </LegalSection>

      <LegalSection heading="6. Intellectual Property">
        <p>
          All software, branding, design, and underlying technology of the Platform are the
          property of {legalConfig.legalEntityName} and are protected by applicable intellectual
          property laws. Menu content, restaurant names, logos, and images uploaded by Merchants
          remain the property of the respective Merchant.
        </p>
        <p>
          You may not copy, modify, distribute, or reverse-engineer any part of the Platform
          without our prior written consent.
        </p>
      </LegalSection>

      <LegalSection heading="7. Disclaimer">
        <p>
          The Platform is provided on an &quot;as is&quot; and &quot;as available&quot; basis.
          {" "}{legalConfig.productName} does not guarantee that the Platform will be
          uninterrupted, error-free, or completely secure, and makes no representations about
          the quality, safety, or accuracy of food or listings provided by Merchants.
        </p>
      </LegalSection>

      <LegalSection heading="8. Limitation of Liability">
        <p>
          To the maximum extent permitted by law, {legalConfig.productName} shall not be liable
          for any indirect, incidental, or consequential damages arising from your use of the
          Platform, including but not limited to food quality, delayed or failed order
          fulfilment, or disputes between customers and Merchants. Our total liability, if any,
          shall not exceed the amount of the specific transaction giving rise to the claim.
        </p>
      </LegalSection>

      <LegalSection heading="9. Governing Law">
        <p>
          These Terms are governed by the laws of {legalConfig.jurisdiction}. Any disputes
          arising out of or in connection with these Terms shall be subject to the exclusive
          jurisdiction of the courts located in {legalConfig.jurisdiction}.
        </p>
      </LegalSection>

      <LegalSection heading="10. Contact">
        <p>
          For any questions about these Terms, please contact us at{" "}
          <a
            href={`mailto:${legalConfig.supportEmail}`}
            className="text-green-deep underline underline-offset-2"
          >
            {legalConfig.supportEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
