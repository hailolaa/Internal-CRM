import { redirect } from "next/navigation";

export default function LegacyTreatmentSettingsRedirectPage() {
  redirect("/app/crm/pipeline/settings");
}
