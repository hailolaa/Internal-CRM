import Link from "next/link";
import { ArrowRight, LockKeyhole, UsersRound } from "lucide-react";
import ClinicGrowerLogo from "@/components/brand/ClinicGrowerLogo";

const journey = [
  {
    stage: "Audit",
    detail: "Capture the request, source, contact details and first action.",
  },
  {
    stage: "Diagnosis",
    detail: "Record Growth Score context, gaps, notes and recommended next step.",
  },
  {
    stage: "Lead recovery",
    detail: "Track response status, contact attempts, WhatsApp, calls and follow-up.",
  },
  {
    stage: "Campaigns",
    detail: "Link the prospect or client to proposals, packages and delivery tasks.",
  },
  {
    stage: "Growth management",
    detail: "Keep client ownership, onboarding, account tasks and retention notes visible.",
  },
];

const primaryPaths = [
  {
    title: "Sales CRM",
    copy: "Prospects, pipeline movement, notes, proposals and follow-up.",
  },
  {
    title: "Client Delivery",
    copy: "Client accounts, onboarding, access gaps, tasks and handover.",
  },
  {
    title: "Communications",
    copy: "Inbox, calls, lead replies and contact history.",
  },
  {
    title: "Operations",
    copy: "Daily dashboard, priorities, owners and internal accountability.",
  },
];

const packages = [
  { name: "Free Clinic Growth Audit", price: "Free", detail: "Outside-in review" },
  { name: "Growth Diagnostic", price: "£395/mo", detail: "Focused monthly diagnosis" },
  { name: "Lead Concierge", price: "£595/mo", detail: "Lead handling visibility" },
  { name: "Starter Engine", price: "£995/mo", detail: "Starter operating rhythm" },
  { name: "Growth Partner", price: "£1,695/mo", detail: "Growth accountability layer" },
  { name: "Clinic Growth Engine", price: "£2,495/mo", detail: "£995 setup" },
  { name: "Growth Engine Plus", price: "£3,495/mo", detail: "£995 setup" },
  { name: "Market Leader", price: "From £4,995/mo", detail: "£995 setup" },
];

export default function PublicOnboardingPage() {
  return (
    <main className="min-h-screen bg-[#F7F4EE] text-[#151F21]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-4 sm:px-8 lg:px-10">
        <header className="flex min-h-12 items-center justify-between gap-4 border-b border-[rgba(21,31,33,0.08)] pb-4">
          <Link href="/" aria-label="ClinicGrower Internal CRM home">
            <ClinicGrowerLogo variant="full" />
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#151F21] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#253639]"
            >
              <LockKeyhole className="h-4 w-4" />
              Sign in
            </Link>
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:py-9">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#9A5524]">
              ClinicGrower Mission Control
            </p>
            <h1 className="mt-4 max-w-4xl text-4xl font-semibold leading-[1.02] tracking-tight text-[#151F21] sm:text-5xl lg:text-[3.45rem]">
              The internal CRM for the work behind clinic growth.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-[#5E6E70]">
              Mission Control is the ClinicGrower-owned operating layer for the
              internal team, keeping first enquiry, proposal, client onboarding,
              delivery ownership and follow-up in one place.
            </p>

            <div className="mt-6">
              <Link
                href="/login"
                className="inline-flex min-h-12 items-center gap-2 rounded-lg bg-[#151F21] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#253639]"
              >
                Open Internal CRM
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2">
              {primaryPaths.map((path) => (
                <article
                  key={path.title}
                  className="rounded-lg border border-[rgba(21,31,33,0.08)] bg-white p-3.5"
                >
                  <h2 className="text-sm font-semibold text-[#151F21]">{path.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-[#5E6E70]">{path.copy}</p>
                </article>
              ))}
            </div>

            <section className="mt-8 rounded-lg border border-[rgba(21,31,33,0.08)] bg-white p-4">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#2F7F7B]">
                    Current package catalogue
                  </p>
                  <h2 className="mt-1.5 text-xl font-semibold text-[#151F21]">
                    Public pricing reference
                  </h2>
                </div>
                <p className="max-w-sm text-xs leading-5 text-[#5E6E70]">
                  Media spend, VAT treatment, scope and term are confirmed on the issued proposal.
                </p>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {packages.map((item) => (
                  <div
                    key={item.name}
                    className="rounded-lg border border-[rgba(21,31,33,0.08)] bg-[#F7F4EE] px-3 py-2.5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-[#151F21]">{item.name}</p>
                      <p className="shrink-0 text-sm font-bold text-[#2F7F7B]">{item.price}</p>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#5E6E70]">{item.detail}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="rounded-lg border border-[rgba(21,31,33,0.08)] bg-[#151F21] p-4 text-white shadow-[0_20px_60px_rgba(21,31,33,0.14)]">
            <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#9DD8D5]">
                  Internal layer
                </p>
                <h2 className="mt-1.5 text-2xl font-semibold">How the work moves</h2>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10">
                <UsersRound className="h-5 w-5 text-[#9DD8D5]" />
              </div>
            </div>

            <div className="mt-4">
              {journey.map((item, index) => (
                <div
                  key={item.stage}
                  className="grid grid-cols-[32px_minmax(0,1fr)] gap-3 border-b border-white/10 py-2.5 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 text-xs font-bold text-[#9DD8D5]">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">{item.stage}</p>
                    <p className="mt-1 text-xs leading-5 text-[#D6E4E2]">
                      {item.detail}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>
      </div>
    </main>
  );
}
