"use client";

import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Leaf, Coffee, Heart, Users } from "lucide-react";
import HeroSection from "@/components/customer/HeroSection";
import AboutCafeSection, {
  type AboutHighlight,
} from "@/components/customer/AboutCafeSection";
import EventsSection, { type EventItem } from "@/components/customer/EventsSection";
import InformationSection, {
  type OpeningHoursRow,
} from "@/components/customer/InformationSection";

// Local, frontend-only homepage content — mirrors the previous page's
// pattern of inline restaurant data (no backend call here; the menu page
// still fetches its own data as before). Edit these values directly to
// rebrand: swap copy, swap /new-assets/* paths, done.
const restaurant = {
  name: "Ebowla Club",
  logo: "/logo.png",
  tagline: "A place where the ordinary ends, and the extraordinary begins!",
  heroVideo: "/new-assets/floral.mp4",
  aboutText:
    "Ebowla is more than just a club—it's an experience rooted in warmth, flavor, and community. Inspired by the joy of sharing good food and meaningful moments, we bring you a menu crafted with passion, served with love.",

  highlights: [
    { label: "Fresh Ingredients", icon: Leaf },
    { label: "Specialty Coffee", icon: Coffee },
    { label: "Made with Love", icon: Heart },
    { label: "Warm Hospitality", icon: Users },
  ] satisfies AboutHighlight[],

  events: [
    { id: "event-1", image: "/new-assets/events/event-1.webp", alt: "Upcoming event at E-BOWLA CLUB" },
    { id: "event-2", image: "/new-assets/events/event-2.webp", alt: "Upcoming event at E-BOWLA CLUB" },
    { id: "event-3", image: "/new-assets/events/event-3.webp", alt: "Upcoming event at E-BOWLA CLUB" },
    { id: "event-4", image: "/new-assets/events/event-4.webp", alt: "Upcoming event at E-BOWLA CLUB" },
    { id: "event-5", image: "/new-assets/events/event-5.webp", alt: "Upcoming event at E-BOWLA CLUB" },
  ] satisfies EventItem[],

  // TODO: confirm real values — placeholders below follow the reference's
  // format (Mon–Sun, same hours daily) but with E-BOWLA CLUB's own timing.
  hours: [
    { day: "Mon", hours: "8:00 AM – 11:00 PM" },
    { day: "Tue", hours: "8:00 AM – 11:00 PM" },
    { day: "Wed", hours: "8:00 AM – 11:00 PM" },
    { day: "Thu", hours: "8:00 AM – 11:00 PM" },
    { day: "Fri", hours: "8:00 AM – 11:00 PM" },
    { day: "Sat", hours: "8:00 AM – 11:00 PM" },
    { day: "Sun", hours: "8:00 AM – 11:00 PM" },
  ] satisfies OpeningHoursRow[],

  // TODO: replace with real contact details.
  contact: {
    phone: "+91-7569442081",
    address: "Mumbai, India",
  },

  // TODO: add real social/profile URLs. Any key left undefined is hidden.
  social: {
    instagram: "https://instagram.com/",
  },

  // TODO: replace with real registration details before launch.
};

export default function CafeLandingPage() {
  const searchParams = useSearchParams();
  const table = searchParams.get("table");
  const router = useRouter();
  const params = useParams<{ restaurantId: string }>();
  const restaurantId = params.restaurantId;

  const goToMenu = () => {
    router.push(`/${restaurantId}/menu${table ? `?table=${table}` : ""}`);
  };

  return (
    <main
      className="relative min-h-dvh overflow-x-hidden pb-10"
      style={{
        backgroundImage: "url('/new-assets/paper-texture.webp')",
        backgroundRepeat: "repeat",
        backgroundSize: "480px auto",
        backgroundColor: "var(--bg-primary)",
      }}
    >
      <HeroSection
        videoSrc={restaurant.heroVideo}
        logo={restaurant.logo}
        restaurantName={restaurant.name}
        tagline={restaurant.tagline}
      />

      <AboutCafeSection
        description={restaurant.aboutText}
        highlights={restaurant.highlights}
        onExploreMenu={goToMenu}
      />

      <EventsSection events={restaurant.events} />

      <InformationSection
        hours={restaurant.hours}
        contact={restaurant.contact}
        social={restaurant.social}
      />
    </main>
  );
}
