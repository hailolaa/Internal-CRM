import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { EditorialImage } from "../primitives/EditorialImage";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto",
  gap: "6.2mm",
  height: "100%",
};

const eyebrowRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7mm",
  color: proposalV5Tokens.colors.muted,
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
  maxWidth: "174mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "30pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: proposalV5Tokens.type.lede,
  lineHeight: 1.3,
};

const checkpointGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  columnGap: "8mm",
  rowGap: "8mm",
};

const checkpointStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
  paddingTop: "4mm",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "2mm 0 1.5mm",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "13.2pt",
  fontWeight: 700,
  lineHeight: 1.1,
};

const textStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.6pt",
  lineHeight: 1.22,
};

const imageWrapStyle: CSSProperties = {
  position: "relative",
};

const imageCaptionStyle: CSSProperties = {
  position: "absolute",
  left: "4mm",
  right: "4mm",
  bottom: "4mm",
  padding: "4mm 5mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "9.8pt",
  lineHeight: 1.2,
};

const decisionBandStyle: CSSProperties = {
  minHeight: "16mm",
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "8mm",
  alignItems: "center",
  padding: "0 7mm",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
};

const decisionTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "11.5pt",
  fontWeight: 700,
};

const decisionTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "11.5pt",
  fontWeight: 700,
  textAlign: "right",
};

export function getV5Page13MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.clinic?.priorityServices?.value?.[0]) missing.push("clinic.priorityServices.value[0]");
  if (!snapshot?.journey?.activeConstraint?.value) missing.push("journey.activeConstraint.value");
  if (snapshot?.economics?.capacity?.value === null || snapshot?.economics?.capacity?.value === undefined) {
    missing.push("economics.capacity.value");
  }
  if (snapshot?.economics?.capacity?.state !== "known") missing.push("economics.capacity.state");
  if (!snapshot?.assets?.implementationImage?.url) missing.push("assets.implementationImage.url");
  if (!snapshot?.narrative?.implementation?.checkpoints?.every((checkpoint) => checkpoint.label && checkpoint.title && checkpoint.text)) {
    missing.push("narrative.implementation.checkpoints");
  }
  return missing;
}

export function V5Page13Implementation({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page13MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page13Implementation is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const narrative = snapshot.narrative.implementation;

  return (
    <LightPage
      pageId="V5Page13Implementation"
      pageNumber={13}
      showHeader={false}
      footerNote={`Prepared exclusively for ${clinicName} - ${narrative.footerNote}`}
    >
      <div data-v5-page-13 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>{narrative.eyebrow}</span>
        </div>
        <h1 style={headlineStyle}>{narrative.headline}</h1>
        <p style={ledeStyle}>{narrative.lede}</p>
        <div style={checkpointGridStyle}>
          {narrative.checkpoints.map(({ label, title, text }) => (
            <article key={label} style={checkpointStyle}>
              <p style={labelStyle}>{label}</p>
              <h2 style={titleStyle}>{title}</h2>
              <p style={textStyle}>{text}</p>
            </article>
          ))}
        </div>
        <div style={imageWrapStyle}>
          <EditorialImage image={snapshot.assets.implementationImage} height="62mm" />
          <div style={imageCaptionStyle}>{narrative.imageCaption}</div>
        </div>
        <div style={decisionBandStyle}>
          <p style={decisionTitleStyle}>{narrative.decisionTitle}</p>
          <p style={decisionTextStyle}>{narrative.decisionText}</p>
        </div>
      </div>
    </LightPage>
  );
}
