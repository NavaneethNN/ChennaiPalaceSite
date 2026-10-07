import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import MenuContent from "@/components/MenuContent";
export const metadata: Metadata = { title: "Our Menu", description: "Explore Chennai Palace’s menu: dosa, idli, Chettinadu curries, biryani, Indian breads, desserts and South Indian filter coffee in Holden Hill, Adelaide." };
export default function MenuPage() { return <SiteShell menuPage><MenuContent /></SiteShell>; }
