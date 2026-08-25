import type { CSSProperties, ReactNode } from "react";
import { formatProposalV5Money } from "../data/breakEven";
import type { ProposalV5PageId, ProposalV5RenderableRendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { isProposalV5RenderableSnapshot } from "../renderer/ProposalV5Renderer";
import { evidenceStateLabel } from "../pages/pageContentHelpers";
import { formatV19Date, includedScope, primaryService, safeV19Href, scopeByKeywords, selectedProof, statedText } from "../pages/v19PageHelpers";
import { proposalV5MobileSections, type ProposalV5MobileSectionId } from "./mobileSectionRegistry";

const colors = proposalV5Tokens.colors;

const styles = {
  root: {
    background: colors.paper,
    color: colors.headingInk,
    fontFamily: proposalV5Tokens.font.family,
    lineHeight: 1.55,
    margin: "0 auto",
    maxWidth: "760px",
    overflowX: "hidden",
    width: "100%",
  } as CSSProperties,
  section: {
    borderTop: `1px solid ${colors.rule}`,
    padding: "30px 20px",
  } as CSSProperties,
  darkSection: {
    background: colors.deepInk,
    borderTop: `1px solid ${colors.secondaryDark}`,
    color: colors.paper,
  } as CSSProperties,
  eyebrow: {
    color: colors.strongTeal,
    fontSize: "0.72rem",
    fontWeight: 850,
    letterSpacing: "0.12em",
    margin: "0 0 10px",
    textTransform: "uppercase",
  } as CSSProperties,
  darkEyebrow: {
    color: colors.teal,
  } as CSSProperties,
  h1: {
    color: "inherit",
    fontSize: "clamp(2rem, 10vw, 4rem)",
    fontWeight: 850,
    letterSpacing: 0,
    lineHeight: 0.98,
    margin: 0,
    overflowWrap: "anywhere",
  } as CSSProperties,
  h2: {
    color: "inherit",
    fontSize: "clamp(1.7rem, 7vw, 2.55rem)",
    fontWeight: 850,
    letterSpacing: 0,
    lineHeight: 1.04,
    margin: 0,
    overflowWrap: "anywhere",
  } as CSSProperties,
  body: {
    color: "inherit",
    fontSize: "1rem",
    margin: "14px 0 0",
  } as CSSProperties,
  muted: {
    color: colors.muted,
    fontSize: "0.92rem",
    margin: "10px 0 0",
  } as CSSProperties,
  darkMuted: {
    color: "#C9DDDA",
  } as CSSProperties,
  grid: {
    display: "grid",
    gap: "12px",
    marginTop: "18px",
  } as CSSProperties,
  panel: {
    borderTop: `1px solid ${colors.rule}`,
    paddingTop: "14px",
  } as CSSProperties,
  darkPanel: {
    borderTop: `1px solid rgba(210, 222, 218, 0.28)`,
  } as CSSProperties,
} as const;

const TANJA_PROOF_IMAGE = "/brand/proposal/v5-reference/tanja-testimonial.jpg";

function proofText(asset: { title?: string | null; copy?: string | null; type?: string | null; sectorTags?: string[]; source?: string | null; timeframe?: string | null } | null | undefined) {
  return `${asset?.title || ""} ${asset?.copy || ""} ${asset?.type || ""} ${(asset?.sectorTags || []).join(" ")} ${asset?.source || ""} ${asset?.timeframe || ""}`.toLowerCase();
}

function findProofAsset<T extends { title?: string | null; copy?: string | null; type?: string | null; sectorTags?: string[]; source?: string | null; timeframe?: string | null }>(proof: T[], terms: string[]) {
  const normalizedTerms = terms.map((term) => term.toLowerCase());
  return proof.find((asset) => {
    const haystack = proofText(asset);
    return normalizedTerms.some((term) => haystack.includes(term));
  });
}

function imageBlock(url: string | null | undefined, alt: string, dark = false, fit: "cover" | "contain" = "cover") {
  if (!url) return null;
  return (
    <figure
      aria-label={alt}
      role="img"
      style={{
        aspectRatio: "16 / 9",
        backgroundColor: dark ? colors.secondaryDark : colors.softPanel,
        backgroundImage: `url("${url}")`,
        backgroundPosition: "center center",
        backgroundRepeat: "no-repeat",
        backgroundSize: fit,
        border: `1px solid ${dark ? "rgba(210, 222, 218, 0.28)" : colors.rule}`,
        margin: "18px 0 0",
      }}
    />
  );
}

function money(value: number | null | undefined) {
  return typeof value === "number" ? formatProposalV5Money(value) : "To confirm";
}

function investmentDisplayName(snapshot: ProposalV5Snapshot) {
  const packageId = String(snapshot.selectedPackage.id || "");
  const names: Record<string, string> = {
    "free-clinic-growth-audit": "Free Clinic Growth Audit",
    "growth-diagnostic": "Clinic Growth Diagnostic",
    "clinic-growth-diagnostic": "Clinic Growth Diagnostic",
    "lead-concierge": "Clinic Growth",
    "performance-os": "Clinic Growth",
    "growth-engine": "Clinic Growth",
    "clinic-growth-engine": "Clinic Growth",
    "growth-engine-plus": "Market Leader",
    "treatment-growth": "Treatment Growth",
    "clinic-growth": "Clinic Growth",
    "market-leader": "Market Leader",
  };
  return names[packageId] || snapshot.selectedPackage.name;
}

function ownerFirstName(snapshot: ProposalV5Snapshot) {
  const words = snapshot.recipient.name.value?.trim().split(/\s+/).filter(Boolean) || [];
  if (/^(dr|mr|mrs|ms|miss|prof|professor)$/i.test(words[0] || "") && words[1]) {
    return words.slice(0, 2).join(" ");
  }
  return words[0] || "you";
}

function termPhrase(months: number | null | undefined) {
  const value = months || 6;
  return value === 6 ? "six-month" : `${value}-month`;
}

function termEnd(months: number | null | undefined) {
  const value = months || 6;
  return value === 6 ? "six" : String(value);
}

function termText(months: number | null | undefined) {
  const value = months || 6;
  return value === 6 ? "six months" : `${value} months`;
}

function panel(title: ReactNode, text?: ReactNode, dark = false, key?: string) {
  return (
    <div key={key} style={{ ...styles.panel, ...(dark ? styles.darkPanel : null) }}>
      <strong style={{ display: "block", fontSize: "1rem", lineHeight: 1.24 }}>{title}</strong>
      {text ? <p style={{ ...styles.muted, ...(dark ? styles.darkMuted : null) }}>{text}</p> : null}
    </div>
  );
}

function bulletList(items: ReactNode[], dark = false) {
  return (
    <ul style={{ display: "grid", gap: "9px", listStyle: "none", margin: "16px 0 0", padding: 0 }}>
      {items.map((item, index) => (
        <li key={`${index}-${String(item).slice(0, 18)}`} style={{ display: "grid", gridTemplateColumns: "24px 1fr", gap: "10px" }}>
          <span style={{ color: dark ? colors.teal : colors.strongTeal, fontWeight: 850 }}>{index + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

function sectionData(snapshot: ProposalV5Snapshot): Array<{
  id: ProposalV5MobileSectionId;
  pageId: ProposalV5PageId;
  eyebrow: string;
  title: ReactNode;
  body?: ReactNode;
  dark?: boolean;
  content: ReactNode;
}> {
  const proof = selectedProof(snapshot);
  const tanjaProof = findProofAsset(proof, ["dr tanja", "tanja phillips", "permissioned clinic owner testimonial"]);
  const publishedResults = [
    ["+262.73%", "PPC conversions", "versus previous year", findProofAsset(proof, ["262.73", "high-intent"])],
    ["-31.41%", "PPC cost per lead", "period not published", findProofAsset(proof, ["31.41", "cost-per-enquiry", "cost per enquiry", "cost per lead"])],
    ["+100.6%", "Organic traffic", "reaching 2.6K monthly users", findProofAsset(proof, ["100.6", "organic traffic", "consultation demand"])],
  ] as const;
  const publishedRows = [
    ["DREAMAMED", "+163%", "lead conversions | period not published", findProofAsset(proof, ["dreamamed", "163"])],
    ["MEDISKIN", "+205%", "conversions | Jan-May 2024", findProofAsset(proof, ["mediskin", "205"])],
  ] as const;
  const paidSearchScope = scopeByKeywords(snapshot, ["google ads", "paid search", "ppc", "campaign", "media"], 4);
  const organicScope = scopeByKeywords(snapshot, ["seo", "google business", "website", "landing", "content", "gbp"], 4);
  const scope = includedScope(snapshot, 5);
  const service = primaryService(snapshot);
  const clinicName = snapshot.clinic.name.value || "the clinic";
  const ownerFirst = ownerFirstName(snapshot);
  const monthlyFee = money(snapshot.commercial.monthlyFeeCents);
  const setupFee = money(snapshot.commercial.setupFeeCents);
  const mediaSpend = money(snapshot.commercial.mediaSpend.value);
  const noticeDays = snapshot.commercial.noticePeriodDays || 90;
  const minimumTerm = snapshot.commercial.minimumTermMonths || 6;
  const commercialValues = [
    panel(investmentDisplayName(snapshot), `${monthlyFee} + VAT per month`, true, "monthly-fee"),
    panel("Monthly billing", "One recurring service fee. Excludes VAT, setup and Google media.", true, "monthly-billing"),
    panel("One-off setup", `${setupFee} + VAT once. First invoice only. Not recurring.`, true, "setup-fee"),
    panel("Media", snapshot.commercial.mediaSpendRule || "Separate from ClinicGrower fees", true, "media-rule"),
  ];

  return [
    {
      id: "mobile-page-01",
      pageId: "V5Page01Cover",
      eyebrow: "Growth partnership",
      title: snapshot.clinic.name.value,
      body: snapshot.discovery.goal.value,
      dark: true,
      content: (
        <>
          {imageBlock(snapshot.assets.sectorImages.cover.url, snapshot.assets.sectorImages.cover.alt || "Proposal cover", true)}
          <div style={styles.grid}>
            {panel("Prepared for", snapshot.recipient.name.value, true, "prepared-for")}
            {panel("Package", snapshot.selectedPackage.name, true, "package")}
            {panel("Reference", snapshot.proposal.reference, true, "reference")}
          </div>
        </>
      ),
    },
    {
      id: "mobile-page-02",
      pageId: "V5Page02Recommendation",
      eyebrow: "Recommendation",
      title: "The partnership in one page",
      body: statedText(snapshot.discovery.workingDiagnosis),
      content: bulletList([
        statedText(snapshot.discovery.goal),
        statedText(snapshot.discovery.whyNow),
        `${service} is the first priority journey.`,
      ]),
    },
    {
      id: "mobile-page-03",
      pageId: "V5Page03GoogleMediaRoas",
      eyebrow: "Commercial case",
      title: `A ${snapshot.economics.economicUnit.value || "confirmed patient value unit"} has to justify the spend.`,
      body: "Illustrative media ROAS, not a profit forecast or guarantee.",
      dark: true,
      content: (
        <div style={styles.grid}>
          {panel("Contribution", money(snapshot.economics.contribution.value), true, "contribution")}
          {panel("Selected media", money(snapshot.economics.selectedMediaSpend.value), true, "selected-media")}
          {panel("Break-even units", snapshot.economics.recurringBreakEvenUnits ?? evidenceStateLabel(snapshot.economics.contribution.state), true, "break-even")}
        </div>
      ),
    },
    {
      id: "mobile-page-04",
      pageId: "V5Page04GrowthEngine",
      eyebrow: "Growth engine",
      title: "One route from first search to recorded value.",
      body: snapshot.journey.postBookingContinuation,
      content: bulletList(snapshot.journey.stages.slice(0, 8)),
    },
    {
      id: "mobile-page-05",
      pageId: "V5Page05GoogleAds",
      eyebrow: "Demand capture",
      title: "Google Ads demand only where included by the selected package.",
      body: snapshot.commercial.mediaSpendRule || "Media spend is separate from ClinicGrower fees.",
      content: <div style={styles.grid}>{paidSearchScope.map((line, index) => panel(line.title, line.description, false, `paid-${line.title || index}`))}</div>,
    },
    {
      id: "mobile-page-06",
      pageId: "V5Page06LandingConversion",
      eyebrow: "Conversion",
      title: `Turn ${snapshot.clinic.typeShortLabel.toLowerCase()} traffic into qualified enquiries.`,
      body: snapshot.discovery.currentSystems.value,
      dark: true,
      content: imageBlock(snapshot.assets.sectorImages.journey.url, snapshot.assets.sectorImages.journey.alt || "Clinic journey", true),
    },
    {
      id: "mobile-page-07",
      pageId: "V5Page07SeoGbpWebsite",
      eyebrow: "Compounding demand",
      title: "SEO, Google Business Profile and website scope.",
      body: snapshot.journey.demandQuestion,
      content: <div style={styles.grid}>{organicScope.map((line, index) => panel(line.title, line.description, false, `organic-${line.title || index}`))}</div>,
    },
    {
      id: "mobile-page-08",
      pageId: "V5Page08TrackingOptimisation",
      eyebrow: "Tracking and optimisation",
      title: "A lead is not the finish line.",
      body: "Visibility is shown where connected.",
      dark: true,
      content: (
        <>
          {imageBlock(snapshot.assets.osScreens[0]?.url, snapshot.assets.osScreens[0]?.alt || "ClinicGrower OS screen", true)}
          {bulletList(snapshot.journey.stages.slice(0, 7), true)}
        </>
      ),
    },
    {
      id: "mobile-page-09",
      pageId: "V5Page09Roadmap",
      eyebrow: "Roadmap",
      title: "Build, prove, then compound.",
      body: snapshot.narrative.implementation.lede,
      content: <div style={styles.grid}>{snapshot.narrative.implementation.checkpoints.map((item) => panel(`${item.label}: ${item.title}`, item.text, false, item.label))}</div>,
    },
    {
      id: "mobile-page-10",
      pageId: "V5Page10ManagementScope",
      eyebrow: "Management scope",
      title: "The partnership needs clear ownership.",
      body: snapshot.narrative.responsibilities.lede,
      content: <div style={styles.grid}>{scope.map((line, index) => panel(line.title, line.description, false, `scope-${line.title || index}`))}</div>,
    },
    {
      id: "mobile-page-11",
      pageId: "V5Page11PublishedProof",
      eyebrow: "Relevant proof, not a promise",
      title: "Marketing results matter. What happens after the lead matters more.",
      body: tanjaProof?.copy || "\"They have taken the time to help us drill down into the detail to optimise the right leads.\"",
      content: (
        <>
          <article data-v5-proof-pair data-v5-proof-slot="featured-client-story" data-v5-proof-media-url={TANJA_PROOF_IMAGE} style={styles.panel}>
            {imageBlock(TANJA_PROOF_IMAGE, "Dr Tanja Phillips client story", false)}
            <strong>Dr Tanja Phillips</strong>
            <p style={styles.muted}>Client story | 2:43</p>
          </article>
          <div style={styles.grid}>
            {publishedResults.map(([value, label, note], index) => (
              <article key={label} data-v5-proof-pair data-v5-proof-slot={`result-${index + 1}`} style={styles.panel}>
                <strong>{value}</strong>
                <p style={styles.muted}>{label} | {note}</p>
              </article>
            ))}
          </div>
          <div style={styles.grid}>
            {publishedRows.map(([name, value, note], index) => (
              <article key={name} data-v5-proof-pair data-v5-proof-slot={`published-row-${index + 1}`} style={styles.panel}>
                <strong>{name} {value}</strong>
                <p style={styles.muted}>{note}</p>
              </article>
            ))}
          </div>
          <p style={styles.muted}>Cross-sector published clinic evidence. It shows commercial improvement ClinicGrower measures; it is not a forecast or guarantee for {snapshot.clinic.name.value || "this clinic"}.</p>
        </>
      ),
    },
    {
      id: "mobile-page-12",
      pageId: "V5Page12WhyClinicGrower",
      eyebrow: "Why ClinicGrower",
      title: snapshot.narrative.partnerProposition.headline,
      body: snapshot.narrative.partnerProposition.lede,
      dark: true,
      content: imageBlock(snapshot.assets.founderVideoThumbnail?.url, snapshot.assets.founderVideoThumbnail?.alt || "Founder video", true),
    },
    {
      id: "mobile-page-13",
      pageId: "V5Page13PartnershipInvestment",
      eyebrow: "One accountable team | one monthly ClinicGrower fee",
      title: `A joined-up team across marketing and growth operations, billed monthly at ${monthlyFee} + VAT.`,
      body: `${clinicName} gets one team across marketing, the patient journey and commercial optimisation - without disconnected suppliers or reports for ${ownerFirst} to manage.`,
      dark: true,
      content: <div style={styles.grid}>{commercialValues}</div>,
    },
    {
      id: "mobile-page-14",
      pageId: "V5Page14BillingTerms",
      eyebrow: "Monthly delivery | monthly billing | controlled media",
      title: "Billed monthly. Reviewed monthly. Scaled only when the evidence supports it.",
      body: `The ${termPhrase(minimumTerm)} minimum gives the system time to learn and improve. ${clinicName} still sees a clear monthly bill and retains control of every increase in Google media.`,
      content: (
        <div style={styles.grid}>
          {panel("Month 1 | Foundation", `${monthlyFee} + VAT monthly ClinicGrower fee. ${setupFee} + VAT setup once. £0 planned Google media.`, false, "foundation")}
          {panel("Months 2-3 | Optimise + prove", `${monthlyFee} + VAT per month. Google media up to ${mediaSpend} per live month, paid directly.`, false, "optimise")}
          {panel("Term at a glance", `Initial minimum: ${termText(minimumTerm)}. Either party may give ${noticeDays} days' written notice at any time, but it cannot expire before the end of month ${termEnd(minimumTerm)}. Start: ${formatV19Date(snapshot.commercial.proposedStartDate)}. Valid until: ${formatV19Date(snapshot.commercial.expiresAt)}.`, false, "notice")}
          {panel("VAT", snapshot.commercial.vatStatus, false, "vat")}
        </div>
      ),
    },
    {
      id: "mobile-page-15",
      pageId: "V5Page15Decision",
      eyebrow: "The decision requested",
      title: `Growth should make ${clinicName} easier to run. Not harder.`,
      body: `${ownerFirst}, you do not need another supplier that stops at enquiries. You need one accountable team generating demand for ${service}, improving ${clinicName}'s patient route and showing how enquiries lead to attended assessments, accepted plans and paid treatment starts.`,
      content: (
        <div style={styles.grid}>
          {panel("Prepare the final agreement for", null, false, "agreement-label")}
          {bulletList([
            `One initial ${termPhrase(minimumTerm)} Growth Partnership for ${clinicName}'s ${service} patient journey.`,
            `${monthlyFee} + VAT per month for the ClinicGrower service.`,
            `One-off ${setupFee} + VAT setup fee, charged on the first invoice only.`,
            `Google Ads media up to ${mediaSpend} per live month, planned from month two and paid directly by ${clinicName} to Google.`,
            `${noticeDays} days' written notice may be given at any time, but cannot expire before the end of month ${termEnd(minimumTerm)}.`,
          ])}
          <a href={safeV19Href(snapshot.links.acceptUrl || snapshot.links.onlineProposalUrl, "#")} style={{ ...styles.panel, background: colors.headingInk, color: colors.paper, textDecoration: "none" }}>
            {`Yes - prepare ${clinicName}'s Growth Partnership agreement`}
          </a>
          <a href={safeV19Href(snapshot.links.questionUrl, "mailto:hello@clinicgrower.co.uk")} style={{ ...styles.panel, color: colors.headingInk, textDecoration: "none" }}>
            Request a change
          </a>
        </div>
      ),
    },
  ];
}

export function ProposalV5MobileRenderer({ snapshot }: ProposalV5RenderableRendererProps) {
  if (!isProposalV5RenderableSnapshot(snapshot)) {
    throw new Error("ProposalV5MobileRenderer requires ProposalV5Snapshot or ProposalV5PublicSnapshot. Use the frozen V5 snapshot for sent proposals.");
  }

  const renderSnapshot = snapshot as ProposalV5Snapshot;
  const pages = sectionData(renderSnapshot);
  const registeredIds = proposalV5MobileSections.flatMap((section) => section.pageIds);

  return (
    <article
      aria-label={`Mobile ClinicGrower proposal for ${renderSnapshot.clinic.name.value || "clinic"}`}
      className="proposal-v5-mobile-root proposal-v5-mobile-renderer"
      data-v5-mobile-page-count={registeredIds.length}
      style={styles.root}
    >
      {pages.map((page) => {
        const dark = Boolean(page.dark);
        return (
          <section
            key={page.id}
            id={page.pageId}
            data-v5-mobile-section-id={page.id}
            data-v5-page-id={page.pageId}
            data-v5-page-ids={page.pageId}
            style={{
              ...styles.section,
              ...(dark ? styles.darkSection : null),
            }}
          >
            <p style={{ ...styles.eyebrow, ...(dark ? styles.darkEyebrow : null) }}>{page.eyebrow}</p>
            <h1 style={page.pageId === "V5Page01Cover" ? styles.h1 : styles.h2}>{page.title}</h1>
            {page.body ? <p style={{ ...styles.body, ...(dark ? styles.darkMuted : null) }}>{page.body}</p> : null}
            {page.content}
          </section>
        );
      })}
    </article>
  );
}
