"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Phone,
  MapPin,
  Mail,
  Camera,
  Link as LinkIcon,
  MessageCircle,
  Globe,
  type LucideIcon,
} from "lucide-react";

export interface OpeningHoursRow {
  day: string;
  hours: string;
}

export interface ContactDetails {
  phone?: string;
  address?: string;
  email?: string;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  whatsapp?: string;
  website?: string;
}

export interface BusinessDetails {
  placeName: string;
  gstNumber?: string;
  fssaiNumber?: string;
  registeredName: string;
  address: string;
}

export interface InformationSectionProps {
  hours: OpeningHoursRow[];
  contact: ContactDetails;
  social: SocialLinks;
  business: BusinessDetails;
}

const SOCIAL_META: Record<
  keyof SocialLinks,
  { icon: LucideIcon; label: string }
> = {
  instagram: { icon: Camera, label: "Instagram" },
  facebook: { icon: LinkIcon, label: "Facebook" },
  whatsapp: { icon: MessageCircle, label: "WhatsApp" },
  website: { icon: Globe, label: "Website" },
};

/** Section heading with a gold hairline extending to the right — reused
 *  by Opening Hours / Contact Us / Follow Us On / Registered Business Details. */
function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-5 flex items-center gap-4">
      <h2 className="font-display whitespace-nowrap text-2xl font-semibold text-green-deep">
        {children}
      </h2>
      <span className="h-px flex-1" style={{ background: "var(--gold-accent)", opacity: 0.5 }} />
    </div>
  );
}

/**
 * Sections 4–8 — Opening Hours, Contact Us, Follow Us On, Registered
 * Business Details, and the footer flower decoration. Grouped into one
 * component since together they read as a single "information" block
 * scrolling continuously, matching the reference.
 */
export default function InformationSection({
  hours,
  contact,
  social,
  business,
}: InformationSectionProps) {
  const socialEntries = (Object.keys(SOCIAL_META) as (keyof SocialLinks)[]).filter(
    (key) => social[key]
  );

  return (
    <motion.section
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: 0.5 }}
      className="mx-auto max-w-[480px] px-8 py-10"
    >
      {/* Opening Hours */}
      {hours.length > 0 && (
        <div className="mb-10">
          <SectionHeading>Opening Hours</SectionHeading>
          <div className="flex flex-col gap-2.5">
            {hours.map((row) => (
              <div key={row.day} className="font-body flex text-sm text-text-primary">
                <span className="w-12 font-medium">{row.day}</span>
                <span className="mr-2">:</span>
                <span className="text-text-secondary">{row.hours}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Contact Us */}
      {(contact.phone || contact.address || contact.email) && (
        <div className="mb-10">
          <SectionHeading>Contact Us</SectionHeading>
          <div className="flex flex-col gap-3">
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="font-body flex items-center gap-3 text-sm text-text-primary"
              >
                <Phone size={17} style={{ color: "var(--green-deep)" }} />
                {contact.phone}
              </a>
            )}
            {contact.address && (
              <div className="font-body flex items-start gap-3 text-sm text-text-primary">
                <MapPin size={17} className="mt-0.5 flex-none" style={{ color: "var(--green-deep)" }} />
                <span>{contact.address}</span>
              </div>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="font-body flex items-center gap-3 text-sm text-text-primary"
              >
                <Mail size={17} style={{ color: "var(--green-deep)" }} />
                {contact.email}
              </a>
            )}
          </div>
        </div>
      )}

      {/* Follow Us On */}
      {socialEntries.length > 0 && (
        <div className="mb-10">
          <SectionHeading>Follow Us On</SectionHeading>
          <div className="flex items-center gap-5">
            {socialEntries.map((key) => {
              const { icon: Icon, label } = SOCIAL_META[key];
              return (
                <a
                  key={key}
                  href={social[key]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex flex-col items-center gap-1.5"
                >
                  <span
                    className="flex h-12 w-12 items-center justify-center rounded-full"
                    style={{ background: "var(--green-deep)" }}
                  >
                    <Icon size={20} color="var(--bg-primary)" />
                  </span>
                  <span className="font-body text-[11px] text-text-secondary">{label}</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* Registered Business Details */}
      <div>
        <SectionHeading>Registered Business Details</SectionHeading>
        <div className="font-body flex flex-col gap-2 text-sm text-text-primary">
          <p>
            <span className="text-text-secondary">Place Name: </span>
            {business.placeName}
          </p>
          {business.gstNumber && (
            <p>
              <span className="text-text-secondary">GST Number: </span>
              {business.gstNumber}
            </p>
          )}
          {business.fssaiNumber && (
            <p>
              <span className="text-text-secondary">FSSAI Number: </span>
              {business.fssaiNumber}
            </p>
          )}
          <p>
            <span className="text-text-secondary">Registered Name: </span>
            {business.registeredName}
          </p>
          <p>
            <span className="text-text-secondary">Address: </span>
            {business.address}
          </p>
        </div>
      </div>

      {/* Footer decoration */}
      <div className="mt-12 flex justify-center">
        <Image
          src="/new-assets/flower-bottom.png"
          alt=""
          width={345}
          height={146}
          aria-hidden
          className="pointer-events-none h-auto w-[220px] opacity-90"
        />
      </div>
    </motion.section>
  );
}
