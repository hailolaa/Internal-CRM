import Link from "next/link";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#FAF9F6] px-5 py-10">
      <div className="mx-auto max-w-3xl rounded-[28px] border border-[rgba(0,0,0,0.06)] bg-white p-8 shadow-sm">
        <Link href="/" className="mb-8 inline-flex">
          <ClinicGrowerLogo variant="full" />
        </Link>
        <h1 className="text-3xl font-semibold text-[#111111]">Terms of Service</h1>
        <p className="mt-4 text-sm leading-6 text-[#6B7280]">
          These terms cover access to the ClinicGrower platform, account security,
          acceptable use, billing, and service availability. Final legal copy should
          be reviewed by ClinicGrower before production launch.
        </p>
        <div className="mt-8 space-y-5 text-sm leading-6 text-[#3F3A45]">
          <section>
            <h2 className="font-semibold text-[#111111]">Use of the Platform</h2>
            <p>
              Users are responsible for keeping login details secure and for ensuring
              clinic data entered into the platform is accurate and lawfully held.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[#111111]">Billing</h2>
            <p>
              Paid subscriptions, onboarding fees, renewals, cancellations, and
              refunds are governed by the commercial agreement selected during signup
              or agreed with the ClinicGrower team.
            </p>
          </section>
          <section>
            <h2 className="font-semibold text-[#111111]">Support</h2>
            <p>
              Support requests should be sent through the agreed ClinicGrower support
              channel. Platform availability may be affected by maintenance or third
              party provider outages.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
