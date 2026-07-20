import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  CheckCircle2,
  FileText,
  LineChart,
  MousePointerClick,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { GrowthPackageRecord, ProposalRecord } from "@/lib/api-types";

type ProposalTemplatePackage = Pick<
  GrowthPackageRecord,
  "name" | "priceCents" | "currency" | "billingFrequency" | "setupFeeCents" | "includedFeatures" | "proposalWording"
>;

export interface ClinicGrowerProposalTemplateProps {
  proposal: ProposalRecord;
  packageRecord?: ProposalTemplatePackage | null;
  previewMode?: boolean;
}

const sectionFlow = [
  {
    title: "Growth diagnosis",
    detail: "Where enquiries are currently leaking across visibility, tracking, conversion and follow-up.",
    icon: Search,
  },
  {
    title: "Priority fixes",
    detail: "The highest-impact actions that should happen before adding more spend or complexity.",
    icon: Target,
  },
  {
    title: "Operating system",
    detail: "A practical delivery rhythm for website, SEO, ads, tracking, reporting and sales follow-up.",
    icon: LineChart,
  },
  {
    title: "Review cadence",
    detail: "Clear accountability, next actions and monthly performance review points.",
    icon: CalendarClock,
  },
];

const defaultFeatures = [
  "Clinic Growth Score review and opportunity map",
  "Website and conversion audit",
  "SEO, GBP and paid lead source review",
  "Tracking and reporting setup guidance",
  "Lead handling and follow-up recommendations",
  "Internal action plan for the next 30 days",
];

function linesFromText(value: string | null | undefined) {
  return (value || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function formatMoney(valueCents: number | null | undefined, currency = "GBP") {
  if (valueCents === null || valueCents === undefined) return "Bespoke";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(valueCents / 100);
}

function formatBilling(value: string | null | undefined) {
  if (!value) return "";
  return value.replace(/_/g, " ");
}

function formatDate(value: string | null | undefined) {
  if (!value) return "To be agreed";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ");
}

export function ClinicGrowerProposalTemplate({
  proposal,
  packageRecord,
  previewMode = true,
}: ClinicGrowerProposalTemplateProps) {
  const accountName = proposal.clientAccountName || proposal.accountName || "Prospective Clinic";
  const contactName = proposal.contactName || "Decision maker";
  const packageName = packageRecord?.name || proposal.packageName || "Clinic Growth Plan";
  const currency = packageRecord?.currency || proposal.currency || "GBP";
  const mainPrice = proposal.valueCents ?? packageRecord?.priceCents ?? null;
  const sectionContent = proposal.sectionContent || {};
  const features = sectionContent.includedFeatures?.length
    ? sectionContent.includedFeatures
    : packageRecord?.includedFeatures?.length
      ? packageRecord.includedFeatures
      : defaultFeatures;
  const proposalWording =
    sectionContent.recommendedPlan ||
    packageRecord?.proposalWording ||
    "This proposal sets out the recommended ClinicGrower plan to improve visibility, conversion, lead handling and measurable growth.";
  const executiveSummary =
    sectionContent.executiveSummary ||
    "This proposal is managed inside Mission Control so ownership, follow-up and sales activity stay attached to the CRM record.";
  const diagnosisLines = linesFromText(sectionContent.diagnosis);
  const timelineLines = linesFromText(sectionContent.timeline);
  const nextStep =
    sectionContent.nextSteps ||
    "Review the proposal, confirm fit, then move to acceptance or follow-up.";

  return (
    <article className="mx-auto max-w-5xl overflow-hidden rounded-[8px] border border-[#d8e4df] bg-white text-[#1f332f] shadow-sm">
      <header className="border-b border-[#d8e4df] bg-[#f3f7f4] px-6 py-7 sm:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#8cb8a6] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#315f51]">
              <FileText className="h-3.5 w-3.5" />
              ClinicGrower Proposal
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-[#14231f] sm:text-5xl">
              {proposal.proposalName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#4e635d]">
              Prepared for {accountName}. {executiveSummary}
            </p>
          </div>

          <div className="min-w-[220px] rounded-[8px] border border-[#c8dad2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Prepared for</p>
            <p className="mt-2 text-lg font-semibold text-[#14231f]">{accountName}</p>
            <p className="mt-1 text-sm text-[#5b7069]">{contactName}</p>
            <div className="mt-4 border-t border-[#e2ebe7] pt-4 text-sm text-[#4e635d]">
              <div className="flex justify-between gap-4">
                <span>Status</span>
                <span className="font-semibold capitalize text-[#315f51]">{statusLabel(proposal.status)}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Owner</span>
                <span className="font-semibold text-[#315f51]">{proposal.ownerName || "Unassigned"}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Follow-up</span>
                <span className="font-semibold text-[#315f51]">{formatDate(proposal.followUpAt)}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {previewMode && (
        <div className="border-b border-[#d8e4df] bg-[#fff8ed] px-6 py-3 text-sm font-medium text-[#775a22] sm:px-10">
          CRM preview mode. Sending, signatures and client-facing access will be handled in later proposal cards.
        </div>
      )}

      <section className="grid gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[1.2fr_0.8fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Recommended plan</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">{packageName}</h2>
          <p className="mt-4 text-base leading-7 text-[#4e635d]">{proposalWording}</p>
        </div>
        <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-5">
          <p className="text-sm font-semibold text-[#5b7069]">Investment</p>
          <p className="mt-3 text-3xl font-semibold text-[#14231f]">{formatMoney(mainPrice, currency)}</p>
          <p className="mt-1 text-sm capitalize text-[#5b7069]">{formatBilling(packageRecord?.billingFrequency)}</p>
          {packageRecord?.setupFeeCents ? (
            <p className="mt-3 text-sm text-[#5b7069]">Setup: {formatMoney(packageRecord.setupFeeCents, currency)}</p>
          ) : null}
        </div>
      </section>

      <section className="border-y border-[#d8e4df] bg-[#f8fbf9] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Proposal flow</p>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {sectionFlow.map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                <Icon className="h-5 w-5 text-[#2f7665]" />
                <h3 className="mt-4 text-lg font-semibold text-[#14231f]">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b7069]">{item.detail}</p>
              </div>
            );
          })}
        </div>
        {diagnosisLines.length ? (
          <div className="mt-5 rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <h3 className="text-lg font-semibold text-[#14231f]">Current diagnosis</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#5b7069]">
              {diagnosisLines.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#2f7665]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">What is included</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">A controlled path from insight to action.</h2>
          <p className="mt-4 text-sm leading-6 text-[#5b7069]">
            {sectionContent.investmentNotes ||
              "The proposal keeps the commercial plan, owner, follow-up date and CRM activity together so the team is not relying on Better Proposals, email threads or memory."}
          </p>
        </div>
        <div className="grid gap-3">
          {features.map((feature) => (
            <div key={feature} className="flex gap-3 rounded-[8px] border border-[#e2ebe7] p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[#2f7665]" />
              <span className="text-sm leading-6 text-[#354943]">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {timelineLines.length ? (
        <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Delivery timeline</p>
          <div className="mt-4 grid gap-3">
            {timelineLines.map((line, index) => (
              <div key={line} className="flex gap-3 rounded-[8px] border border-[#e2ebe7] p-4">
                <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[#315f51] text-sm font-semibold text-white">
                  {index + 1}
                </span>
                <span className="text-sm leading-6 text-[#354943]">{line}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-[8px] bg-[#edf5f1] p-5">
            <BarChart3 className="h-5 w-5 text-[#2f7665]" />
            <p className="mt-4 text-sm font-semibold text-[#14231f]">Measured growth</p>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">Built around visibility, conversion and lead handling data.</p>
          </div>
          <div className="rounded-[8px] bg-[#f4f0e8] p-5">
            <MousePointerClick className="h-5 w-5 text-[#8a6630]" />
            <p className="mt-4 text-sm font-semibold text-[#14231f]">Clear next step</p>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">Follow-up stays owned inside Mission Control.</p>
          </div>
          <div className="rounded-[8px] bg-[#eef2fb] p-5">
            <ShieldCheck className="h-5 w-5 text-[#4f63a5]" />
            <p className="mt-4 text-sm font-semibold text-[#14231f]">Controlled process</p>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">Proposal activity appears on the CRM timeline.</p>
          </div>
        </div>
      </section>

      <footer className="flex flex-col gap-4 border-t border-[#d8e4df] bg-[#14231f] px-6 py-6 text-white sm:px-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">Next step</p>
          <p className="mt-1 text-sm text-white/75">{nextStep}</p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          Continue in Mission Control
          <ArrowRight className="h-4 w-4" />
        </div>
      </footer>
    </article>
  );
}
