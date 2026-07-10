import { redirect } from "next/navigation";

export default function LegacyCallIntelligenceRedirectPage() {
  redirect("/app/comms/calls");
}