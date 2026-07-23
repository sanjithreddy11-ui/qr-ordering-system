import type { Metadata } from "next";
import LegalPageLayout from "@/components/legal/LegalPageLayout";
import { LegalSection, LegalList } from "@/components/legal/LegalSection";
import { legalConfig } from "@/components/legal/legal-config";

export const metadata: Metadata = {
  title: `Privacy Policy | ${legalConfig.productName}`,
  description:
    "How Denova collects, uses, and protects information from customers and restaurant partners using our QR-based ordering platform.",
  alternates: { canonical: `${legalConfig.websiteUrl}/privacy` },
  robots: { index: true, follow: true },
};

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="Privacy Policy"
      description={`This Privacy Policy explains how ${legalConfig.productName} collects, uses, and protects information when you use our QR-based ordering platform.`}
    >
      <LegalSection heading="1. Information Collected">
        <p>
          We collect information necessary to operate the Platform, provide digital menus,
          process orders, and facilitate payments. This includes information provided directly
          by customers and by restaurant partners (&quot;Merchants&quot;), as detailed below.
        </p>
      </LegalSection>

      <LegalSection heading="2. Mobile Numbers">
        <p>
          When placing an order, we may collect your mobile number to send order updates, enable
          order tracking, and allow the Merchant to contact you regarding your order. We do not
          use your mobile number for unsolicited marketing without your consent.
        </p>
      </LegalSection>

      <LegalSection heading="3. Customer Information">
        <p>
          We collect information such as your name, table or order details, order history, and
          any preferences you provide while browsing the menu or placing an order, in order to
          process and display your order correctly to the Merchant.
        </p>
      </LegalSection>

      <LegalSection heading="4. Restaurant Information">
        <p>
          For Merchants, we collect business details such as restaurant name, address, menu
          items and pricing, staff logins, GST/FSSAI details (where provided), and analytics
          data, in order to operate their digital menu, dashboard, and order management tools.
        </p>
      </LegalSection>

      <LegalSection heading="5. Payment Information">
        <p>
          Payments made on the Platform are processed by our payment gateway partner, Razorpay.
          {" "}{legalConfig.productName} does not collect or store full card numbers, CVV, or UPI
          PINs; these are handled directly and securely by the payment gateway in accordance
          with applicable Reserve Bank of India and card network guidelines.
        </p>
      </LegalSection>

      <LegalSection heading="6. Cookies">
        <p>
          The Platform may use cookies and similar technologies to keep your cart and session
          active while browsing a menu, remember your preferences, and understand how the
          Platform is used so we can improve it. You can control cookies through your browser
          settings, though some features may not function correctly if cookies are disabled.
        </p>
      </LegalSection>

      <LegalSection heading="7. Data Usage">
        <p>We use the information collected to:</p>
        <LegalList
          items={[
            "Process and fulfil orders placed through the Platform.",
            "Enable communication between customers and Merchants regarding orders.",
            "Process payments securely through our payment gateway partner.",
            "Provide Merchants with order management tools and analytics.",
            "Maintain, secure, and improve the Platform.",
            "Comply with applicable legal and regulatory obligations.",
          ]}
        />
      </LegalSection>

      <LegalSection heading="8. Third-Party Services">
        <p>
          We rely on trusted third-party service providers to operate the Platform, including
          Razorpay for payment processing and cloud hosting providers for infrastructure. These
          providers process data only as necessary to provide their services and are bound by
          their own applicable privacy and security obligations.
        </p>
      </LegalSection>

      <LegalSection heading="9. Data Protection">
        <p>
          We implement reasonable technical and organisational safeguards to protect the data
          collected on the Platform from unauthorised access, alteration, disclosure, or
          destruction. However, no method of transmission or storage is completely secure, and
          we cannot guarantee absolute security.
        </p>
      </LegalSection>

      <LegalSection heading="10. User Rights">
        <p>
          You may request access to, correction of, or deletion of your personal information held
          by us, subject to applicable law and any legitimate business or legal requirements to
          retain certain records (such as transaction history). To exercise these rights, please
          contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="11. Contact">
        <p>
          For any questions about this Privacy Policy or how your data is handled, please contact
          us at{" "}
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
