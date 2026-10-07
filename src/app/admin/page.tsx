import StaffConsole from "@/components/StaffConsole";
export const metadata = {
  title: "Restaurant administration",
  robots: { index: false, follow: false },
};
export default function Page() {
  return <StaffConsole mode="admin" />;
}
