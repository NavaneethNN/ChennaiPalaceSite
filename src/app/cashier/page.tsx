import StaffConsole from "@/components/StaffConsole";
export const metadata = {
  title: "Cashier workspace",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StaffConsole mode="cashier" />;
}
