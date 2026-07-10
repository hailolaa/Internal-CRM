import { redirect } from "next/navigation";

export default function LegacyLocationsRedirectPage() {
  redirect("/app/settings");
}
