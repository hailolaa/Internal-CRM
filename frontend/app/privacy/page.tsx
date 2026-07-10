import Link from "next/link";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] px-5 py-10">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white p-8 shadow-sm">
        <Link href="/" className="mb-8 inline-flex">
          <ClinicGrowerLogo variant="full" />
        </Link>
        <h1 className="text-3xl font-semibold text-[#111111]">Privacy Policy</h1>
        <p className="mt-4 text-sm leading-6 text-[#6B7280]">
          ClinicGrower Mission Control processes account, prospect, client,
          delivery, communication, and performance data for internal operations. Final legal
          copy should be reviewed before production launch.
        </p>
        <div className="mt-8 space-y-5 text-sm leading-6 text-[#3F3A45]">
          <section>
            <h2 className="font-semibold text-[#111111]">Data We Process</h2>
            <p>
              The platform stores user profile details, workspace configuration,
              CRM records, operational notes, integrations metadata, and reporting
              data needed to run the internal system.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[#111111]">How Data Is Used</h2>
            <p>
              Data is used to authenticate users, provide tenant-scoped workflows,
              produce reports, support automations, and improve account performance.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[#111111]">Your Choices</h2>
            <p>
              Account owners can manage users, security settings, API keys, compliance
              settings, and integrations from the app settings area.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
