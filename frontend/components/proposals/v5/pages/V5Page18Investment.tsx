import type { CSSProperties } from "react";
import { formatProposalV5Money } from "../data/breakEven";
import type { PackageBillingFrequency } from "@/lib/api-types/packages";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";
import { evidenceStateLabel } from "./pageContentHelpers";

const clinicGrowerLogoUrl = "/brand/clinic-grower-logo-inline.png";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto",
  gap: "4.1mm",
  height: "100%",
};

const logoStyle: CSSProperties = {
  width: "82mm",
  height: "11mm",
  backgroundImage: `url("${clinicGrowerLogoUrl}")`,
  backgroundPosition: "left center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
  filter: "brightness(0) invert(1)",
};

const eyebrowRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7mm",
  color: proposalV5Tokens.colors.teal,
  fontSize: "10.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const tealRuleStyle: CSSProperties = {
  width: "13mm",
  height: "0.7mm",
  background: proposalV5Tokens.colors.teal,
};

const mainGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "72mm 1fr",
  gap: "7mm",
  alignItems: "start",
};

const headlineStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "28pt",
  fontWeight: 700,
  lineHeight: 1.04,
};

const packageLabelStyle: CSSProperties = {
  margin: "4mm 0 0",
  color: proposalV5Tokens.colors.teal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const packageNameStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.paper,
  fontSize: "16pt",
  fontWeight: 700,
  lineHeight: 1.12,
};

const priceStyle: CSSProperties = {
  margin: "4mm 0 0",
  color: proposalV5Tokens.colors.teal,
  fontSize: "32pt",
  fontWeight: 800,
  lineHeight: 1,
};

const priceSubStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.rule,
  fontSize: "11pt",
  lineHeight: 1.25,
};

const rationaleStyle: CSSProperties = {
  display: "grid",
  gap: "3.2mm",
  padding: "5.2mm",
  background: proposalV5Tokens.colors.secondaryDark,
  border: `0.35mm solid rgba(87, 187, 182, 0.36)`,
};

const rationaleLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "9.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const rationaleTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12.4pt",
  fontWeight: 700,
  lineHeight: 1.23,
};

const supportingTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "10pt",
  lineHeight: 1.3,
};

const lightPanelSupportingTextStyle: CSSProperties = {
  ...supportingTextStyle,
  color: proposalV5Tokens.colors.muted,
};

const detailGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "4mm",
};

const detailStyle: CSSProperties = {
  minHeight: "20mm",
  padding: "3.8mm",
  borderTop: `0.6mm solid ${proposalV5Tokens.colors.teal}`,
  background: proposalV5Tokens.colors.secondaryDark,
};

const detailLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "8.8pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const detailValueStyle: CSSProperties = {
  margin: "2.5mm 0 0",
  color: proposalV5Tokens.colors.paper,
  fontSize: "12pt",
  fontWeight: 700,
  lineHeight: 1.18,
};

const billingGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "4mm",
};

const billingPanelStyle: CSSProperties = {
  minHeight: "25mm",
  display: "grid",
  gap: "2mm",
  alignContent: "center",
  padding: "4mm 5mm",
  background: proposalV5Tokens.colors.paper,
  color: proposalV5Tokens.colors.deepInk,
};

const billingValueStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "14pt",
  fontWeight: 800,
  lineHeight: 1.12,
};

const ctaBandStyle: CSSProperties = {
  minHeight: "17mm",
  display: "grid",
  gridTemplateColumns: "40mm 1fr",
  gap: "6mm",
  alignItems: "center",
  padding: "0 6mm",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
};

const ctaLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "10pt",
  fontWeight: 800,
  textTransform: "uppercase",
};

const ctaTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "11.8pt",
  fontWeight: 800,
  lineHeight: 1.14,
};

function formatVatStatus(status: string | null) {
  if (!status) return null;
  const lower = status.toLowerCase();
  if (lower.includes("plus") || lower.includes("exclusive")) return "+ VAT";
  if (lower.includes("included") || lower.includes("inclusive")) return "VAT included";
  return status;
}

function formatBillingFrequency(frequency: PackageBillingFrequency | null) {
  if (frequency === "monthly") return "monthly";
  if (frequency === "one_off") return "one-off";
  if (frequency === "quarterly") return "quarterly";
  if (frequency === "annual") return "annual";
  if (frequency === "bespoke") return "bespoke";
  return null;
}

function formatDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function firstDiagnosedLeak(snapshot: ProposalV5Snapshot) {
  const value = snapshot.journey.diagnosedLeaks.value?.[0] || null;
  if (!value) return null;
  const [title, detail] = value.split("|").map((part) => part.trim()).filter(Boolean);
  return detail ? `${title}: ${detail}` : title;
}

export function getV5Page18MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.selectedPackage?.name) missing.push("selectedPackage.name");
  if (snapshot?.commercial?.monthlyFeeCents === null || snapshot?.commercial?.monthlyFeeCents === undefined) {
    missing.push("commercial.monthlyFeeCents");
  }
  if (snapshot?.commercial?.setupFeeCents === null || snapshot?.commercial?.setupFeeCents === undefined) {
    missing.push("commercial.setupFeeCents");
  }
  if (!snapshot?.commercial?.vatStatus) missing.push("commercial.vatStatus");
  if (!snapshot?.commercial?.mediaSpendRule) missing.push("commercial.mediaSpendRule");
  if (!snapshot?.commercial?.billingFrequency) missing.push("commercial.billingFrequency");
  if (!snapshot?.commercial?.minimumTermMonths) missing.push("commercial.minimumTermMonths");
  if (!snapshot?.commercial?.noticePeriodDays) missing.push("commercial.noticePeriodDays");
  if (!snapshot?.commercial?.proposedStartDate) missing.push("commercial.proposedStartDate");
  if (!snapshot?.commercial?.expiresAt) missing.push("commercial.expiresAt");
  if (snapshot?.commercial?.mediaSpend?.value === null || snapshot?.commercial?.mediaSpend?.value === undefined) {
    missing.push("commercial.mediaSpend.value");
  }
  if (snapshot?.commercial?.mediaSpend?.state !== "known") missing.push("commercial.mediaSpend.state");
  if (!snapshot?.journey?.diagnosedLeaks?.value?.length) missing.push("journey.diagnosedLeaks.value");
  return missing;
}

export function V5Page18Investment({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page18MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page18Investment is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const packageName = snapshot.selectedPackage.name as string;
  const monthlyFee = snapshot.commercial.monthlyFeeCents as number;
  const setupFee = snapshot.commercial.setupFeeCents as number;
  const mediaSpend = snapshot.commercial.mediaSpend.value as number;
  const vatLabel = formatVatStatus(snapshot.commercial.vatStatus) as string;
  const billingFrequency = formatBillingFrequency(snapshot.commercial.billingFrequency) as string;
  const pricePeriod = billingFrequency === "monthly" ? "per month" : billingFrequency;
  const proposedStartDate = formatDate(snapshot.commercial.proposedStartDate);
  const expiresAt = formatDate(snapshot.commercial.expiresAt);
  const initialInvoice = monthlyFee + setupFee;
  const diagnosedLeak = firstDiagnosedLeak(snapshot) as string;

  return (
    <DarkPage
      pageId="V5Page18Investment"
      pageNumber={18}
      showHeader={false}
      footerNote="Investment is shown separately from platform media and remains subject to accepted terms."
    >
      <div data-v5-page-18 style={pageStyle}>
        <div aria-label="ClinicGrower" role="img" style={logoStyle} />
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Recommended investment</span>
        </div>

        <div style={mainGridStyle}>
          <section>
            <h1 style={headlineStyle}>One recommended route.</h1>
            <p style={packageLabelStyle}>Selected package</p>
            <h2 style={packageNameStyle}>{packageName}</h2>
            <p style={priceStyle}>{formatProposalV5Money(monthlyFee)}</p>
            <p style={priceSubStyle}>
              {pricePeriod} {vatLabel}. Media spend is separate from ClinicGrower fees.
            </p>
          </section>

          <section style={rationaleStyle}>
            <p style={rationaleLabelStyle}>Why this route</p>
            <p style={rationaleTextStyle}>{diagnosedLeak}</p>
            <p style={supportingTextStyle}>
              The commercial page follows scope, responsibilities and proof so price is judged against the diagnosed constraint.
            </p>
          </section>
        </div>

        <div style={detailGridStyle}>
          {[
            ["Setup", `${formatProposalV5Money(setupFee)} ${vatLabel}`],
            ["Selected media", `${formatProposalV5Money(mediaSpend)} per month`],
            ["Initial term", `${snapshot.commercial.minimumTermMonths} months`],
            ["Notice", `${snapshot.commercial.noticePeriodDays} days`],
            ["Billing", billingFrequency],
            ["Start and validity", `Start ${proposedStartDate}; valid until ${expiresAt}`],
          ].map(([label, value]) => (
            <article key={label} style={detailStyle}>
              <p style={detailLabelStyle}>{label}</p>
              <p style={detailValueStyle}>{value}</p>
            </article>
          ))}
        </div>

        <div style={billingGridStyle}>
          <section style={billingPanelStyle}>
            <p style={detailLabelStyle}>First invoice</p>
            <p style={billingValueStyle}>
              {formatProposalV5Money(initialInvoice)} {vatLabel}
            </p>
            <p style={lightPanelSupportingTextStyle}>
              Includes first {billingFrequency} fee and setup. Media is paid separately according to the selected media rule.
            </p>
          </section>
          <section style={billingPanelStyle}>
            <p style={detailLabelStyle}>Media control</p>
            <p style={billingValueStyle}>{snapshot.commercial.mediaSpendRule}</p>
            <p style={lightPanelSupportingTextStyle}>
              Media state: {evidenceStateLabel(snapshot.commercial.mediaSpend.state)}.
            </p>
          </section>
        </div>

        <div style={ctaBandStyle}>
          <p style={ctaLabelStyle}>Decision point</p>
          <p style={ctaTextStyle}>Approve the selected route only if the scope, proof, responsibilities and commercial terms match the clinic decision.</p>
        </div>
      </div>
    </DarkPage>
  );
}
