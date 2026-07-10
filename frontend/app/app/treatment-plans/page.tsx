import { redirect } from "next/navigation";

export default function LegacyInternalRedirectPage() {
  redirect("/app/ops/delivery");
}