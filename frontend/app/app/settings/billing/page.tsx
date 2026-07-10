import { redirect } from "next/navigation";

export default function LegacyBillingRedirectPage() {
  redirect("/app/settings");
}
