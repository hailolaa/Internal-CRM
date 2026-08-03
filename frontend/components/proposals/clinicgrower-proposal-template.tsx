import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  FileText,
  LineChart,
  PlayCircle,
  Search,
  ShieldCheck,
  Target,
} from "lucide-react";
import type { GrowthPackageRecord, ProposalPublicRecord, ProposalRecord } from "@/lib/api-types";

type ProposalTemplatePackage = Pick<
  GrowthPackageRecord,
  "name" | "priceCents" | "currency" | "billingFrequency" | "setupFeeCents" | "includedFeatures" | "proposalWording"
>;

export interface ClinicGrowerProposalTemplateProps {
  proposal: ProposalPublicRecord | ProposalRecord;
  packageRecord?: ProposalTemplatePackage | null;
  previewMode?: boolean;
}

const standardSectionFlow = [
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

const growthScoreSectionFlow = [
  {
    title: "Scorecard findings",
    detail: "The lowest-scoring areas and the commercial impact they are having on visibility, conversion and follow-up.",
    icon: Search,
  },
  {
    title: "Fastest growth wins",
    detail: "The priority actions that can improve the score and remove revenue leakage first.",
    icon: Target,
  },
  {
    title: "90-day action plan",
    detail: "A sequenced plan that turns the audit findings into owned website, marketing and sales actions.",
    icon: LineChart,
  },
  {
    title: "Score review checkpoints",
    detail: "Clear milestones for measuring progress, reviewing evidence and agreeing the next growth priority.",
    icon: CalendarClock,
  },
];

const bespokeSectionFlow = [
  {
    title: "Commercial objectives",
    detail: "The outcomes, constraints and success measures agreed for this specific clinic or group.",
    icon: Target,
  },
  {
    title: "Tailored workstreams",
    detail: "A custom blend of strategy, website, acquisition, tracking and lead-conversion work.",
    icon: LineChart,
  },
  {
    title: "Phased delivery",
    detail: "Dependencies, owners and delivery phases arranged around the clinic’s priorities and capacity.",
    icon: CalendarClock,
  },
  {
    title: "Governance and review",
    detail: "A practical decision and reporting cadence for keeping a bespoke engagement controlled.",
    icon: ShieldCheck,
  },
];

const templateVariants = {
  clinicgrower_standard: {
    eyebrow: "ClinicGrower Proposal",
    recommendedPlanLabel: "Recommended plan",
    defaultPlan:
      "This proposal sets out the recommended ClinicGrower plan to improve visibility, conversion, lead handling and measurable growth.",
    internalSummary:
      "This proposal is managed inside Mission Control so ownership, follow-up and sales activity stay attached to the CRM record.",
    publicSummary:
      "It brings the recommended priorities, delivery scope and commercial terms together in one clear plan.",
    flowLabel: "Proposal flow",
    flow: standardSectionFlow,
    includedHeading: "A controlled path from insight to action.",
    defaultNextStep: "Review the proposal, confirm fit, then move to acceptance or follow-up.",
    publicFooter: "Ready to move forward",
  },
  growth_score_follow_up: {
    eyebrow: "Growth Score Action Plan",
    recommendedPlanLabel: "Recommended next step",
    defaultPlan:
      "This action plan turns the Growth Score findings into a focused set of priorities, owned actions and measurable review points.",
    internalSummary:
      "This follow-up proposal connects the Growth Score evidence to the recommended package, owner and next sales action.",
    publicSummary:
      "It translates the Growth Score findings into a practical plan for closing the highest-impact gaps first.",
    flowLabel: "From score to action",
    flow: growthScoreSectionFlow,
    includedHeading: "Turn the Growth Score into measurable progress.",
    defaultNextStep: "Agree the priority gaps, confirm the recommended package and schedule the first 90-day action review.",
    publicFooter: "Ready to act on the scorecard",
  },
  bespoke_growth_plan: {
    eyebrow: "Bespoke Clinic Growth Plan",
    recommendedPlanLabel: "Tailored scope",
    defaultPlan:
      "This bespoke plan combines the workstreams, delivery phases and commercial terms selected for this clinic’s specific growth objectives.",
    internalSummary:
      "This custom proposal keeps the agreed scope, commercial assumptions and follow-up ownership attached to the CRM opportunity.",
    publicSummary:
      "It brings the tailored workstreams, responsibilities, timing and commercial terms into one controlled plan.",
    flowLabel: "Bespoke delivery model",
    flow: bespokeSectionFlow,
    includedHeading: "A tailored engagement with clear ownership.",
    defaultNextStep: "Confirm the tailored scope, delivery sequence and commercial terms before scheduling kickoff.",
    publicFooter: "Ready to confirm the tailored scope",
  },
} as const;

const defaultFeatures = [
  "Clinic Growth Score review and opportunity map",
  "Website and conversion audit",
  "SEO, GBP and paid lead source review",
  "Tracking and reporting setup guidance",
  "Lead handling and follow-up recommendations",
  "Prioritised action plan for the next 30 days",
];

const defaultStrategyPoints = [
  "Capture high-intent demand from search, maps and paid channels.",
  "Improve the conversion path from page visit to enquiry.",
  "Track calls, forms and WhatsApp enquiries through to booked outcomes.",
  "Reduce lead-handling leakage with clearer response and follow-up visibility.",
  "Scale only once demand, conversion and reporting are stable.",
];

const defaultSuccessMetrics = [
  "Qualified enquiries | Baseline to establish | Lead tracking and call tracking",
  "Booked consultations | Directional improvement | Booking and CRM data",
  "Lead-to-booked conversion rate | Directional improvement | Lead and booking data",
  "Cost per booked patient | Within viable economics | Ads and CRM data",
  "Response time | Under 10 minutes where practical | Call and lead data",
];

const defaultClinicGrowerResponsibilities = [
  "Deliver the agreed scope and raise blockers quickly.",
  "Track agreed conversion events and report on the patient journey.",
  "Optimise based on reliable data, lead quality and booked outcomes.",
  "Provide reporting, recommendations and next actions.",
];

const defaultClientResponsibilities = [
  "Provide access, approvals and required assets promptly.",
  "Respond to enquiries quickly and maintain appointment capacity.",
  "Share accurate booking, sales and treatment outcome data where available.",
  "Pay advertising spend directly and follow agreed clinical compliance rules.",
];

const defaultTimeline = [
  {
    title: "Days 1 to 14",
    phase: "Diagnose and establish control",
    items: ["Confirm access", "Validate tracking", "Confirm priority treatments", "Review website and landing pages", "Confirm booking process", "Build or restructure campaigns"],
  },
  {
    title: "Days 15 to 45",
    phase: "Launch and learn",
    items: ["Launch campaigns", "Review search terms and lead quality", "Improve targeting and negatives", "Review calls, forms and WhatsApp", "Fix conversion friction"],
  },
  {
    title: "Days 46 to 90",
    phase: "Stabilise and grow",
    items: ["Scale working campaigns", "Reduce wasted spend", "Improve cost per booked patient", "Strengthen local visibility", "Produce the next growth plan"],
  },
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

function deliveryTypeLabel(value: string) {
  return value === "one_off" ? "One-off" : "Recurring";
}

function firstName(value: string) {
  return value.trim().split(/\s+/)[0] || value;
}

function valueOrFallback(value: string | null | undefined, fallback = "To confirm") {
  return value?.trim() || fallback;
}

function scoreTone(value: number | null | undefined) {
  if (value === null || value === undefined) return "bg-[#edf2ef] text-[#5b7069]";
  if (value < 45) return "bg-[#fce8e5] text-[#9d2f22]";
  if (value < 70) return "bg-[#fff1d6] text-[#8a5a10]";
  return "bg-[#e4f5ec] text-[#256148]";
}

function scoreWidth(value: number | null | undefined) {
  if (value === null || value === undefined) return "0%";
  return `${Math.max(0, Math.min(100, value))}%`;
}

function getVimeoEmbedUrl(value: string | null | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.hostname.includes("player.vimeo.com")) {
      const id = url.pathname.match(/\/video\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
    if (url.hostname.includes("vimeo.com")) {
      const id = url.pathname.match(/\/(\d+)/)?.[1];
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {
    return null;
  }
  return null;
}

export function ClinicGrowerProposalTemplate({
  proposal,
  packageRecord,
  previewMode = true,
}: ClinicGrowerProposalTemplateProps) {
  const templateVariant =
    templateVariants[proposal.templateKey as keyof typeof templateVariants] ||
    templateVariants.clinicgrower_standard;
  const accountName = proposal.clientAccountName || proposal.accountName || "Prospective Clinic";
  const contactName = proposal.contactName || "Decision maker";
  const packageName = packageRecord?.name || proposal.packageName || "Clinic Growth Plan";
  const currency = packageRecord?.currency || proposal.currency || "GBP";
  const mainPrice = proposal.valueCents ?? packageRecord?.priceCents ?? null;
  const monthlyFee = proposal.monthlyFeeCents ?? (packageRecord?.billingFrequency === "monthly" ? packageRecord?.priceCents : null);
  const setupFee = proposal.setupFeeCents ?? packageRecord?.setupFeeCents ?? null;
  const sectionContent = proposal.sectionContent || {};
  const features = sectionContent.includedFeatures?.length
    ? sectionContent.includedFeatures
    : packageRecord?.includedFeatures?.length
      ? packageRecord.includedFeatures
      : defaultFeatures;
  const scopeItems = (sectionContent.scopeItems || [])
    .filter((item) => item.title && item.clientDescription)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const proofAssets = (sectionContent.proofAssets || [])
    .filter((asset) => asset.title && asset.copy)
    .sort((a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title));
  const proposalWording =
    sectionContent.recommendedPlan ||
    packageRecord?.proposalWording ||
    templateVariant.defaultPlan;
  const executiveSummary =
    sectionContent.executiveSummary ||
    (previewMode
      ? templateVariant.internalSummary
      : templateVariant.publicSummary);
  const diagnosisLines = linesFromText(sectionContent.diagnosis);
  const timelineLines = linesFromText(sectionContent.timeline);
  const introVideoUrl = sectionContent.introVideoUrl || null;
  const introVideoTitle = sectionContent.introVideoTitle || "A short message from ClinicGrower";
  const introVideoEmbedUrl = getVimeoEmbedUrl(introVideoUrl);
  const fallbackVideoUrl = sectionContent.fallbackVideoUrl || null;
  const printableVideoUrl = fallbackVideoUrl || introVideoUrl;
  const personalIntro =
    sectionContent.personalIntroduction ||
    `Hi ${firstName(contactName)}, thank you for taking the time to explain how the clinic currently operates, what is working and where you want to grow. This proposal sets out what we believe is currently restricting growth, what should be fixed first, and the ClinicGrower programme we recommend.`;
  const understoodCards: Array<[string, string]> = [
    ["Primary goal", valueOrFallback(sectionContent.primaryGoal)],
    ["Current position", valueOrFallback(sectionContent.currentPosition)],
    ["Available capacity", valueOrFallback(sectionContent.availableCapacity)],
    ["Priority treatments", valueOrFallback(sectionContent.priorityTreatments)],
    ["Target area", valueOrFallback(sectionContent.targetArea)],
    ["Desired outcome", valueOrFallback(sectionContent.desiredOutcome)],
  ];
  const diagnosisScores: Array<[string, number | null | undefined]> = [
    ["Overall Clinic Growth Score", sectionContent.growthScoreOverall],
    ["Visibility", sectionContent.visibilityScore],
    ["Conversion", sectionContent.conversionScore],
    ["Tracking", sectionContent.trackingScore],
    ["Lead handling", sectionContent.leadHandlingScore],
    ["Sales conversion", sectionContent.salesConversionScore],
    ["Retention", sectionContent.retentionScore],
  ];
  const hasGrowthDiagnosis =
    diagnosisScores.some(([, score]) => score !== null && score !== undefined) ||
    Boolean(sectionContent.biggestRisk || sectionContent.biggestOpportunity || sectionContent.firstRecommendedFix || diagnosisLines.length);
  const opportunityRows = ([
    ["Current monthly enquiries", sectionContent.currentMonthlyEnquiries],
    ["Current monthly booked patients", sectionContent.currentMonthlyBookedPatients],
    ["Target bookings", sectionContent.targetBookings],
    ["Consultation value", sectionContent.consultationValue],
    ["Average treatment value", sectionContent.averageTreatmentValue],
    ["Available capacity", sectionContent.availableCommercialCapacity || sectionContent.availableCapacity],
    ["Recommended ad spend", sectionContent.recommendedAdSpend],
    ["Estimated cost per lead", sectionContent.estimatedCostPerLead],
    ["Estimated leads", sectionContent.estimatedLeads],
    ["Estimated booked patients", sectionContent.estimatedBookedPatients],
    ["Break-even bookings", sectionContent.breakEvenBookings],
    ["Data source", sectionContent.commercialDataSource],
  ] satisfies Array<[string, string | null | undefined]>).filter(([, value]) => Boolean(value?.trim()));
  const strategyPoints = sectionContent.strategyPoints?.length ? sectionContent.strategyPoints : defaultStrategyPoints;
  const successMetrics = sectionContent.successMetrics?.length ? sectionContent.successMetrics : defaultSuccessMetrics;
  const clinicGrowerResponsibilities = sectionContent.clinicGrowerResponsibilities?.length
    ? sectionContent.clinicGrowerResponsibilities
    : defaultClinicGrowerResponsibilities;
  const clientResponsibilities = sectionContent.clientResponsibilities?.length
    ? sectionContent.clientResponsibilities
    : defaultClientResponsibilities;
  const timelinePhases = timelineLines.length
    ? timelineLines.map((line, index) => ({ title: `Phase ${index + 1}`, phase: line, items: [] as string[] }))
    : defaultTimeline;
  const termsSummary =
    sectionContent.termsSummary ||
    "Initial term, renewal structure, payment terms, ad spend arrangements, account ownership, client responsibilities, data/privacy and performance disclaimers are confirmed as part of acceptance.";
  const nextStep =
    sectionContent.nextSteps ||
    templateVariant.defaultNextStep;

  return (
    <article className="proposal-print-root mx-auto max-w-5xl overflow-hidden rounded-[8px] border border-[#d8e4df] bg-white text-[#1f332f] shadow-sm">
      <div className="proposal-print-footer" aria-hidden="true">
        <span>Personalised Growth Proposal for {accountName}</span>
        <span>
          ClinicGrower | Valid until {formatDate(proposal.expiresAt)} | Page{" "}
          <span className="proposal-print-page-number" />
        </span>
      </div>
      <header className="border-b border-[#d8e4df] bg-[#f3f7f4] px-6 py-7 sm:px-10">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#8cb8a6] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#315f51]">
              <FileText className="h-3.5 w-3.5" />
              Personalised Growth Proposal
            </div>
            <h1 className="text-3xl font-semibold leading-tight text-[#14231f] sm:text-5xl">
              Personalised Growth Proposal for {accountName}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-[#4e635d]">
              {executiveSummary}
            </p>
          </div>

          <div className="min-w-[220px] rounded-[8px] border border-[#c8dad2] bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Prepared for</p>
            <p className="mt-2 text-lg font-semibold text-[#14231f]">{accountName}</p>
            <p className="mt-1 text-sm text-[#5b7069]">{contactName}</p>
            <div className="mt-4 border-t border-[#e2ebe7] pt-4 text-sm text-[#4e635d]">
              <div className="flex justify-between gap-4">
                <span>Recommended</span>
                <span className="text-right font-semibold text-[#315f51]">{packageName}</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Prepared by</span>
                <span className="font-semibold text-[#315f51]">Max Sharpe</span>
              </div>
              <div className="mt-2 flex justify-between gap-4">
                <span>Valid until</span>
                <span className="font-semibold text-[#315f51]">{formatDate(proposal.expiresAt)}</span>
              </div>
            </div>
            {previewMode && "status" in proposal ? (
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
            ) : null}
          </div>
        </div>
      </header>

      {previewMode && (
        <div className="border-b border-[#d8e4df] bg-[#fff8ed] px-6 py-3 text-sm font-medium text-[#775a22] sm:px-10">
          CRM preview mode. Sending, signatures and client-facing access will be handled in later proposal cards.
        </div>
      )}

      <section className="grid gap-6 px-6 py-8 sm:px-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Personal introduction</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">A note from Max</h2>
        </div>
        <div>
          <p className="text-base leading-7 text-[#4e635d]">{personalIntro}</p>
          {fallbackVideoUrl ? (
            <a href={fallbackVideoUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#315f51] hover:text-[#24483d]">
              <PlayCircle className="h-4 w-4" />
              Open backup video link
            </a>
          ) : null}
        </div>
      </section>

      <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">What we understood</p>
        <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {understoodCards.map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[#e2ebe7] bg-[#f8fbf9] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</p>
              <p className="mt-2 text-sm font-semibold leading-6 text-[#14231f]">{value}</p>
            </div>
          ))}
        </div>
      </section>

      {hasGrowthDiagnosis ? (
        <section className="border-t border-[#d8e4df] bg-[#f8fbf9] px-6 py-8 sm:px-10">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Growth diagnosis</p>
              <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">Where growth is currently being lost</h2>
            </div>
            {sectionContent.growthScoreOverall !== null && sectionContent.growthScoreOverall !== undefined ? (
              <div className={`rounded-[8px] px-4 py-3 text-right font-semibold ${scoreTone(sectionContent.growthScoreOverall)}`}>
                <p className="text-xs uppercase tracking-[0.08em]">Overall score</p>
                <p className="text-2xl">{Math.round(sectionContent.growthScoreOverall)} / 100</p>
              </div>
            ) : null}
          </div>
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {diagnosisScores.map(([label, score]) => (
              <div key={label} className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[#14231f]">{label}</p>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${scoreTone(score)}`}>
                    {score === null || score === undefined ? "Not scored" : `${Math.round(score)} / 100`}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#edf2ef]">
                  <div className="h-full rounded-full bg-[#315f51]" style={{ width: scoreWidth(score) }} />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-5 grid gap-3 md:grid-cols-3">
            {[
              ["Biggest current risk", sectionContent.biggestRisk],
              ["Biggest opportunity", sectionContent.biggestOpportunity],
              ["First recommended fix", sectionContent.firstRecommendedFix],
            ].map(([label, value]) => value ? (
              <div key={label} className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</p>
                <p className="mt-2 text-sm leading-6 text-[#354943]">{value}</p>
              </div>
            ) : null)}
          </div>
          {diagnosisLines.length ? (
            <ul className="mt-5 space-y-2 rounded-[8px] border border-[#d8e4df] bg-white p-5 text-sm leading-6 text-[#5b7069]">
              {diagnosisLines.map((line) => (
                <li key={line} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#2f7665]" />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}

      {opportunityRows.length ? (
        <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Commercial opportunity</p>
          <div className="mt-5 grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {opportunityRows.map(([label, value]) => (
              <div key={label} className="rounded-[8px] border border-[#e2ebe7] bg-[#f8fbf9] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</p>
                <p className="mt-2 text-sm font-semibold leading-6 text-[#14231f]">{value}</p>
              </div>
            ))}
          </div>
          <p className="mt-5 rounded-[8px] bg-[#fff8ed] p-4 text-sm leading-6 text-[#775a22]">
            Commercial forecasts are illustrative and are not guaranteed. Actual performance depends on demand, competition, advertising spend, response speed, follow-up, appointment availability and clinic conversion.
          </p>
        </section>
      ) : null}

      <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
        <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Recommended strategy</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">What we recommend and why</h2>
            <p className="mt-4 text-sm leading-6 text-[#5b7069]">{proposalWording}</p>
          </div>
          <div>
            <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-4 text-center text-sm font-semibold text-[#315f51]">
              Demand -&gt; Enquiry -&gt; Response -&gt; Booking -&gt; Attendance -&gt; Treatment -&gt; Revenue -&gt; Optimisation
            </div>
            <div className="mt-4 grid gap-3">
              {strategyPoints.map((point) => (
                <div key={point} className="flex gap-3 rounded-[8px] border border-[#e2ebe7] p-4">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[#2f7665]" />
                  <span className="text-sm leading-6 text-[#354943]">{point}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#d8e4df] bg-[#f8fbf9] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">The first 90 days</p>
        <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">A controlled route from diagnosis to growth</h2>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {timelinePhases.map((item) => (
            <div key={`${item.title}-${item.phase}`} className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{item.title}</p>
              <h3 className="mt-2 text-lg font-semibold text-[#14231f]">{item.phase}</h3>
              {item.items.length ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-[#5b7069]">
                  {item.items.map((timelineItem) => (
                    <li key={timelineItem} className="flex gap-2">
                      <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-[#2f7665]" />
                      <span>{timelineItem}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      {introVideoUrl ? (
        <section className="border-t border-[#d8e4df] bg-[#f8fbf9] px-6 py-8 sm:px-10">
          <div className="grid gap-6 lg:grid-cols-[0.75fr_1.25fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-[#8cb8a6] bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-[#315f51]">
                <PlayCircle className="h-3.5 w-3.5" />
                Proposal video
              </div>
              <h2 className="mt-4 text-2xl font-semibold text-[#14231f]">{introVideoTitle}</h2>
              <p className="mt-3 text-sm leading-6 text-[#5b7069]">
                Watch this before reviewing the scope and next steps. It gives context for the recommended growth plan and how ClinicGrower approaches the work.
              </p>
            </div>
            <div className="overflow-hidden rounded-[8px] border border-[#d8e4df] bg-[#14231f]">
              {introVideoEmbedUrl ? (
                <iframe
                  src={introVideoEmbedUrl}
                  title={introVideoTitle}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  className="aspect-video w-full"
                />
              ) : (
                <a
                  href={introVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex aspect-video w-full items-center justify-center gap-3 bg-[#14231f] px-6 text-center text-sm font-semibold text-white transition hover:bg-[#1f332f]"
                >
                  <PlayCircle className="h-6 w-6" />
                  Open proposal video
                </a>
              )}
            </div>
            {printableVideoUrl ? (
              <p className="proposal-video-fallback text-sm leading-6 text-[#5b7069]">
                Video link:{" "}
                <a
                  href={printableVideoUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-semibold text-[#315f51] hover:text-[#24483d]"
                >
                  {printableVideoUrl}
                </a>
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Recommended programme and investment</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-[8px] border border-[#d8e4df] bg-[#f8fbf9] p-5">
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{templateVariant.recommendedPlanLabel}</p>
            <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">{packageName}</h2>
            <p className="mt-3 text-sm leading-6 text-[#5b7069]">
              This is the recommended programme for the priorities identified above. Alternative packages are intentionally hidden by default so the proposal stays focused on the clearest recommendation.
            </p>
          </div>
          <div className="rounded-[8px] border border-[#d8e4df] bg-[#14231f] p-5 text-white">
            <p className="text-sm font-semibold text-white/75">Monthly programme fee</p>
            <p className="mt-3 text-3xl font-semibold">{formatMoney(monthlyFee ?? mainPrice, currency)}</p>
            <p className="mt-1 text-sm capitalize text-white/70">{formatBilling(packageRecord?.billingFrequency)}</p>
            {setupFee ? (
              <p className="mt-3 text-sm text-white/80">Setup and launch: {formatMoney(setupFee, currency)}</p>
            ) : null}
            {proposal.adSpendNote ? (
              <p className="mt-3 text-sm leading-6 text-white/75">{proposal.adSpendNote}</p>
            ) : null}
          </div>
        </div>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {[
            ["Monthly fee", formatMoney(monthlyFee, currency)],
            ["Setup fee", formatMoney(setupFee, currency)],
            ["VAT", proposal.vatStatus ? proposal.vatStatus.replace(/_/g, " ") : "To be confirmed"],
            ["Minimum term", proposal.minimumTermMonths ? `${proposal.minimumTermMonths} months` : "To be agreed"],
            ["Notice period", proposal.noticePeriodDays ? `${proposal.noticePeriodDays} days` : "To be agreed"],
            ["Start date", proposal.startDate ? formatDate(proposal.startDate) : "To be agreed"],
            ["Expiry date", proposal.expiresAt ? formatDate(proposal.expiresAt) : "To be agreed"],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[8px] border border-[#e2ebe7] bg-[#f8fbf9] p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</p>
              <p className="mt-2 text-sm font-semibold capitalize text-[#14231f]">{value}</p>
            </div>
          ))}
        </div>
        {proposal.addOns.length || proposal.discounts.length ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {proposal.addOns.length ? (
              <div className="rounded-[8px] border border-[#e2ebe7] p-4">
                <h3 className="text-sm font-semibold text-[#14231f]">Optional add-ons</h3>
                <ul className="mt-3 space-y-2 text-sm text-[#5b7069]">
                  {proposal.addOns.map((item) => (
                    <li key={`${item.name}-${item.amountCents || ""}`}>
                      {item.name}{item.amountCents ? ` - ${formatMoney(item.amountCents, currency)}` : ""}{item.note ? ` (${item.note})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {proposal.discounts.length ? (
              <div className="rounded-[8px] border border-[#e2ebe7] p-4">
                <h3 className="text-sm font-semibold text-[#14231f]">Discounts</h3>
                <ul className="mt-3 space-y-2 text-sm text-[#5b7069]">
                  {proposal.discounts.map((item) => (
                    <li key={`${item.name}-${item.amountCents || ""}`}>
                      {item.name}{item.amountCents ? ` - ${formatMoney(item.amountCents, currency)}` : ""}{item.note ? ` (${item.note})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="grid gap-8 px-6 py-8 sm:px-10 lg:grid-cols-[0.85fr_1.15fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">What is included</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">
            {templateVariant.includedHeading}
          </h2>
          <p className="mt-4 text-sm leading-6 text-[#5b7069]">
            {sectionContent.investmentNotes ||
              (previewMode
                ? "The proposal keeps the commercial plan, owner, follow-up date and CRM activity together so the team is not relying on Better Proposals, email threads or memory."
                : "The recommended scope brings the highest-impact growth priorities into one practical, measurable delivery plan.")}
          </p>
        </div>
        <div className="grid gap-3">
          {scopeItems.length ? scopeItems.map((item) => (
            <div key={`${item.category}-${item.title}-${item.sortOrder}`} className="rounded-[8px] border border-[#e2ebe7] p-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-[#edf5f1] px-2 py-1 text-xs font-semibold text-[#315f51]">{item.category}</span>
                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${item.inclusionStatus === "included" ? "bg-[#e4f5ec] text-[#256148]" : "bg-[#f7e8e6] text-[#9d2f22]"}`}>
                  {item.inclusionStatus === "included" ? "Included" : "Not included"}
                </span>
                {item.isOptionalAddOn ? (
                  <span className="rounded-full bg-[#fff1d6] px-2 py-1 text-xs font-semibold text-[#8a5a10]">Optional add-on</span>
                ) : null}
                <span className="rounded-full bg-[#f3f7f4] px-2 py-1 text-xs font-semibold capitalize text-[#5b7069]">
                  {deliveryTypeLabel(item.deliveryType)}
                </span>
              </div>
              <h3 className="mt-3 text-base font-semibold text-[#14231f]">{item.title}</h3>
              <p className="mt-2 text-sm leading-6 text-[#5b7069]">{item.clientDescription}</p>
              {item.frequency || item.quantityLimit ? (
                <dl className="mt-3 grid gap-2 text-xs text-[#5b7069] sm:grid-cols-2">
                  {item.frequency ? (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Frequency</dt>
                      <dd className="mt-1">{item.frequency}</dd>
                    </div>
                  ) : null}
                  {item.quantityLimit ? (
                    <div>
                      <dt className="font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Quantity / limit</dt>
                      <dd className="mt-1">{item.quantityLimit}</dd>
                    </div>
                  ) : null}
                </dl>
              ) : null}
            </div>
          )) : features.map((feature) => (
            <div key={feature} className="flex gap-3 rounded-[8px] border border-[#e2ebe7] p-4">
              <CheckCircle2 className="mt-0.5 h-5 w-5 flex-none text-[#2f7665]" />
              <span className="text-sm leading-6 text-[#354943]">{feature}</span>
            </div>
          ))}
        </div>
      </section>

      {proofAssets.length ? (
        <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
          <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Proof and credibility</p>
          <h2 className="mt-2 text-2xl font-semibold text-[#14231f]">Why this recommendation is credible</h2>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {proofAssets.map((asset) => (
              <div key={asset.id} className="rounded-[8px] border border-[#e2ebe7] bg-white p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#edf5f1] px-2 py-1 text-xs font-semibold capitalize text-[#315f51]">
                    {asset.type.replace(/_/g, " ")}
                  </span>
                  {asset.sectorTags.slice(0, 3).map((tag) => (
                    <span key={tag} className="rounded-full bg-[#f3f7f4] px-2 py-1 text-xs font-semibold text-[#6b817a]">
                      {tag}
                    </span>
                  ))}
                </div>
                <h3 className="mt-4 text-lg font-semibold text-[#14231f]">{asset.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#5b7069]">{asset.copy}</p>
                {asset.mediaUrl ? (
                  <a
                    href={asset.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-4 inline-flex text-sm font-semibold text-[#315f51] hover:text-[#24483d]"
                  >
                    Open proof asset
                  </a>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">How success will be measured</p>
        <div className="mt-5 overflow-hidden rounded-[8px] border border-[#d8e4df]">
          {successMetrics.map((metric, index) => {
            const [name, target, source] = metric.split("|").map((part) => part.trim());
            return (
              <div key={`${metric}-${index}`} className="grid gap-2 border-b border-[#e2ebe7] p-4 last:border-b-0 md:grid-cols-[1fr_1fr_1fr]">
                <p className="text-sm font-semibold text-[#14231f]">{name || metric}</p>
                <p className="text-sm text-[#5b7069]">{target || "Target to confirm"}</p>
                <p className="text-sm text-[#5b7069]">{source || "Data source to confirm"}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-[#d8e4df] bg-[#f8fbf9] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Roles and responsibilities</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <h3 className="text-lg font-semibold text-[#14231f]">ClinicGrower responsibilities</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#5b7069]">
              {clinicGrowerResponsibilities.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#2f7665]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <h3 className="text-lg font-semibold text-[#14231f]">Client responsibilities</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-[#5b7069]">
              {clientResponsibilities.map((item) => (
                <li key={item} className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-[#2f7665]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="border-t border-[#d8e4df] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Terms summary</p>
        <p className="mt-3 text-sm leading-6 text-[#5b7069]">{termsSummary}</p>
        <p className="mt-4 rounded-[8px] bg-[#fff8ed] p-4 text-sm leading-6 text-[#775a22]">
          Any forecasts or commercial illustrations are based on the available information and stated assumptions. They are not guarantees of future results.
        </p>
      </section>

      <section id="proposal-acceptance" className="border-t border-[#d8e4df] bg-[#f8fbf9] px-6 py-8 sm:px-10">
        <p className="text-sm font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Next steps and acceptance</p>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
          <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <p className="text-base font-semibold text-[#14231f]">Accept proposal</p>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">Confirm the recommendation, commercial terms and preferred start date so onboarding can begin.</p>
          </div>
          <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <p className="text-base font-semibold text-[#14231f]">Ask a question</p>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">Raise any questions around scope, capacity, treatment focus, pricing or responsibilities before approval.</p>
          </div>
          <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
            <p className="text-base font-semibold text-[#14231f]">Book the kickoff call</p>
            <p className="mt-2 text-sm leading-6 text-[#5b7069]">Once accepted, the next step is access setup, tracking confirmation and launch planning.</p>
          </div>
        </div>
        <p className="mt-5 rounded-[8px] bg-white p-4 text-sm leading-6 text-[#5b7069]">
          On acceptance: onboarding call - access setup - tracking confirmed - campaigns live - weekly optimisation - monthly reporting.
        </p>
      </section>

      <footer className="flex flex-col gap-4 border-t border-[#d8e4df] bg-[#14231f] px-6 py-6 text-white sm:px-10 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-semibold">Next step</p>
          <p className="mt-1 text-sm text-white/75">{nextStep}</p>
        </div>
        <div className="inline-flex items-center gap-2 text-sm font-semibold">
          {previewMode ? "Continue in Mission Control" : templateVariant.publicFooter}
          <ArrowRight className="h-4 w-4" />
        </div>
      </footer>
    </article>
  );
}
