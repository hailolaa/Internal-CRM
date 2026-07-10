import { redirect } from "next/navigation";

export default function LegacyInternalRedirectPage() {
  redirect("/app/admin");
}