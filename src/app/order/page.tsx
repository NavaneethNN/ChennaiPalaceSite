import type { Metadata } from "next";
import { SiteShell } from "@/components/SiteShell";
import OrderContent from "@/components/OrderContent";
export const metadata: Metadata = { title: "Order for your table" };
export default function Page() {
  return (
    <SiteShell menuPage>
      <OrderContent />
    </SiteShell>
  );
}
