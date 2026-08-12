import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";
import { EditorialImage } from "../primitives/EditorialImage";

const clinicGrowerCoverLogoUrl = "/brand/proposal/v5-reference/aesthetic_clinics/p01-img01-6781x1322.png";

const monthNames = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const coverLayoutStyle: CSSProperties = {
  height: "100%",
  display: "grid",
  gridTemplateRows: "22mm 98mm 106mm",
  gap: "9mm",
};

const logoStyle: CSSProperties = {
  width: "112mm",
  height: "22mm",
  backgroundImage: `url("${clinicGrowerCoverLogoUrl}")`,
  backgroundPosition: "left center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
};

const textBlockStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto minmax(0, 1fr) auto auto",
  alignContent: "stretch",
  gap: "4mm",
  minHeight: 0,
};

const eyebrowStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: proposalV5Tokens.type.legal,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
};

const headlineStyle: CSSProperties = {
  maxWidth: "154mm",
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: proposalV5Tokens.type.coverHeadline,
  fontWeight: 700,
  letterSpacing: "0",
  lineHeight: 1.03,
  maxHeight: "53mm",
  overflow: "hidden",
  overflowWrap: "anywhere",
};

const outcomeStyle: CSSProperties = {
  maxWidth: "152mm",
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: proposalV5Tokens.type.lede,
  lineHeight: 1.36,
};

const metaStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(5, 1fr)",
  gap: "4mm",
  paddingTop: "4mm",
  borderTop: `0.35mm solid ${proposalV5Tokens.colors.secondaryDark}`,
};

const metaLabelStyle: CSSProperties = {
  display: "block",
  color: proposalV5Tokens.colors.teal,
  fontSize: proposalV5Tokens.type.legal,
  lineHeight: 1.2,
};

const metaValueStyle: CSSProperties = {
  display: "block",
  marginTop: "1.5mm",
  color: proposalV5Tokens.colors.paper,
  fontSize: proposalV5Tokens.type.legal,
  lineHeight: 1.25,
  overflowWrap: "anywhere",
};

const heroWrapStyle: CSSProperties = {
  width: proposalV5Tokens.page.width,
  height: "106mm",
  marginLeft: `calc(-1 * ${proposalV5Tokens.page.safeMarginX})`,
  overflow: "hidden",
};

function formatCoverDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${date.getUTCDate()} ${monthNames[date.getUTCMonth()]} ${date.getUTCFullYear()}`;
}

function coverHeadlineStyleFor(clinicName: string): CSSProperties {
  const length = clinicName.trim().length;
  if (length > 220) return { ...headlineStyle, fontSize: "13pt", lineHeight: 1.01 };
  if (length > 160) return { ...headlineStyle, fontSize: "16pt", lineHeight: 1.01 };
  if (length > 118) return { ...headlineStyle, fontSize: "20pt", lineHeight: 1.02 };
  if (length > 88) return { ...headlineStyle, fontSize: "23pt", lineHeight: 1.02 };
  if (length > 64) return { ...headlineStyle, fontSize: "27pt", lineHeight: 1.02 };
  if (length > 44) return { ...headlineStyle, fontSize: "30pt", lineHeight: 1.02 };
  return headlineStyle;
}

export function getV5Page01MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.proposal?.reference) missing.push("proposal.reference");
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.clinic?.location?.value) missing.push("clinic.location");
  if (!snapshot?.recipient?.name?.value) missing.push("recipient.name");
  if (!snapshot?.discovery?.goal?.value) missing.push("discovery.goal");
  if (!snapshot?.selectedPackage?.name) missing.push("selectedPackage.name");
  if (!snapshot?.lifecycle?.expiresAt) missing.push("lifecycle.expiresAt");
  if (!snapshot?.assets?.sectorImages?.cover?.url) missing.push("assets.sectorImages.cover.url");
  return missing;
}

export function V5Page01Cover({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page01MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page01Cover is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const proposalReference = snapshot.proposal.reference;
  const clinicLocation = snapshot.clinic.location.value as string;
  const recipientName = snapshot.recipient.name.value as string;
  const desiredOutcome = snapshot.discovery.goal.value as string;
  const packageName = snapshot.selectedPackage.name as string;
  const validUntil = snapshot.lifecycle.expiresAt as string;

  return (
    <DarkPage pageId="V5Page01Cover" pageNumber={1} showHeader={false} contentOverflow="visible">
      <div data-v5-cover-page data-v5-clinic-type={snapshot.clinic.clinicType} style={coverLayoutStyle}>
        <div aria-label="ClinicGrower" role="img" style={logoStyle} />
        <div style={textBlockStyle}>
          <p style={eyebrowStyle}>ClinicGrower OS proposal</p>
          <h1 style={coverHeadlineStyleFor(clinicName)}>{clinicName}</h1>
          <p style={outcomeStyle}>{desiredOutcome}</p>
          <dl style={metaStyle}>
            <div>
              <dt style={metaLabelStyle}>Reference</dt>
              <dd style={metaValueStyle}>{proposalReference}</dd>
            </div>
            <div>
              <dt style={metaLabelStyle}>Prepared for</dt>
              <dd style={metaValueStyle}>{recipientName}</dd>
            </div>
            <div>
              <dt style={metaLabelStyle}>Location</dt>
              <dd style={metaValueStyle}>{clinicLocation}</dd>
            </div>
            <div>
              <dt style={metaLabelStyle}>Programme</dt>
              <dd style={metaValueStyle}>{packageName}</dd>
            </div>
            <div>
              <dt style={metaLabelStyle}>Valid until</dt>
              <dd style={metaValueStyle}>{formatCoverDate(validUntil)}</dd>
            </div>
          </dl>
        </div>
        <div style={heroWrapStyle}>
          <EditorialImage image={snapshot.assets.sectorImages.cover} width={proposalV5Tokens.page.width} height="106mm" />
        </div>
      </div>
    </DarkPage>
  );
}
