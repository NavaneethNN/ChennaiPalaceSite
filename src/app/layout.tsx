import type { Metadata } from "next";
import { restaurant } from "@/lib/content";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://chennaipalace.thrivehausdigital.com.au"),
  title: { default: "Chennai Palace | South Indian Dining in Adelaide", template: "%s | Chennai Palace" },
  description: restaurant.description,
  icons: { icon: "/images/logo.webp" },
  openGraph: { title: "Chennai Palace — A little Chennai. A lot of soul.", description: restaurant.description, type: "website", locale: "en_AU", images: [{ url: "/images/feast.webp", width: 1448, height: 1086, alt: "Chennai Palace South Indian feast" }] },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const data = { "@context": "https://schema.org", "@type": "Restaurant", name: restaurant.name, description: restaurant.description, telephone: "+61870866880", servesCuisine: ["South Indian", "Indian"], priceRange: "$$", address: { "@type": "PostalAddress", streetAddress: restaurant.address, addressLocality: "Holden Hill", addressRegion: "SA", postalCode: "5088", addressCountry: "AU" }, hasMap: restaurant.maps };
  return <html lang="en-AU"><body><a className="skip-link" href="#main">Skip to content</a>{children}<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} /></body></html>;
}
