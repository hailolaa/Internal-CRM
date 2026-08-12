import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";
import { EditorialImage } from "../primitives/EditorialImage";

const clinicGrowerLogoUrl = "/brand/clinic-grower-logo-inline.png";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "23mm auto auto auto auto auto",
  gap: "6mm",
  height: "100%",
};

const logoStyle: CSSProperties = {
  width: "88mm",
  height: "18mm",
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

const headlineStyle: CSSProperties = {
  maxWidth: "172mm",
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "29.5pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  maxWidth: "172mm",
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "12.6pt",
  lineHeight: 1.28,
};

const videoBlockStyle: CSSProperties = {
  display: "grid",
  gap: "4mm",
};

const founderLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const videoCtaStyle: CSSProperties = {
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  minHeight: "14mm",
  background: proposalV5Tokens.colors.paper,
  color: proposalV5Tokens.colors.deepInk,
  fontSize: "12pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const credentialStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10.5pt",
  fontWeight: 700,
  textAlign: "center",
  lineHeight: 1.25,
};

export function getV5Page05MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.links?.videoUrl) missing.push("links.videoUrl");
  if (!snapshot?.assets?.founderVideoThumbnail?.url) missing.push("assets.founderVideoThumbnail.url");
  if (!snapshot?.narrative?.partnerProposition?.headline) missing.push("narrative.partnerProposition.headline");
  if (!snapshot?.narrative?.partnerProposition?.lede) missing.push("narrative.partnerProposition.lede");
  return missing;
}

export function V5Page05PartnerProposition({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page05MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page05PartnerProposition is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const narrative = snapshot.narrative.partnerProposition;

  return (
    <DarkPage
      pageId="V5Page05PartnerProposition"
      pageNumber={5}
      showHeader={false}
      footerNote={narrative.footerNote}
    >
      <div data-v5-page-05 style={pageStyle}>
        <div aria-label="ClinicGrower" role="img" style={logoStyle} />
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>{narrative.eyebrow}</span>
        </div>
        <h1 style={headlineStyle}>{narrative.headline}</h1>
        <p style={ledeStyle}>{narrative.lede}</p>
        <div style={videoBlockStyle}>
          <EditorialImage image={snapshot.assets.founderVideoThumbnail} height="93mm" />
          <p style={founderLabelStyle}>{narrative.founderLabel}</p>
        </div>
        <a href={snapshot.links.videoUrl || undefined} style={videoCtaStyle}>
          {narrative.videoCtaLabel}
        </a>
        <p style={credentialStyle}>{narrative.credentialStatement}</p>
      </div>
    </DarkPage>
  );
}
