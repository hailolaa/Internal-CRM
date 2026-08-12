import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { EditorialImage } from "../primitives/EditorialImage";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto 1fr auto",
  gap: "7mm",
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
  maxWidth: "170mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "29.5pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: proposalV5Tokens.type.lede,
  lineHeight: 1.3,
};

const bodyGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 78mm",
  gap: "9mm",
  alignItems: "start",
};

const stepStackStyle: CSSProperties = {
  display: "grid",
  gap: "4.5mm",
};

const stepStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
  paddingTop: "4mm",
};

const stepLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const stepTitleStyle: CSSProperties = {
  margin: "2mm 0",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "13.5pt",
  fontWeight: 700,
  lineHeight: 1.18,
};

const stepTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.8pt",
  lineHeight: 1.28,
};

const imageWrapStyle: CSSProperties = {
  position: "relative",
};

const imageCaptionStyle: CSSProperties = {
  position: "absolute",
  right: "4mm",
  bottom: "4mm",
  maxWidth: "62mm",
  padding: "4mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "9.5pt",
  lineHeight: 1.25,
};

const closeBandStyle: CSSProperties = {
  minHeight: "23mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  padding: "0 10mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "14pt",
  fontWeight: 700,
  lineHeight: 1.25,
  textAlign: "center",
};

export function getV5Page06MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.clinic?.typeLabel) missing.push("clinic.typeLabel");
  if (!snapshot?.clinic?.priorityServices?.value?.[0]) missing.push("clinic.priorityServices.value[0]");
  if (!snapshot?.discovery?.currentSystems?.value) missing.push("discovery.currentSystems.value");
  if (!snapshot?.assets?.sectorImages?.journey?.url) missing.push("assets.sectorImages.journey.url");
  if (!snapshot?.narrative?.systemsFit?.headline) missing.push("narrative.systemsFit.headline");
  if (!snapshot?.narrative?.systemsFit?.panels?.every((panel) => panel.label && panel.title && panel.text)) {
    missing.push("narrative.systemsFit.panels");
  }
  return missing;
}

export function V5Page06SystemsFit({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page06MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page06SystemsFit is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const narrative = snapshot.narrative.systemsFit;

  return (
    <LightPage
      pageId="V5Page06SystemsFit"
      pageNumber={6}
      showHeader={false}
      footerNote={`Prepared exclusively for ${clinicName} - ${narrative.footerNote}`}
    >
      <div data-v5-page-06 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>{narrative.eyebrow}</span>
        </div>
        <h1 style={headlineStyle}>{narrative.headline}</h1>
        <p style={ledeStyle}>{narrative.lede}</p>
        <div style={bodyGridStyle}>
          <div style={stepStackStyle}>
            {narrative.panels.map((panel, index) => (
              <article
                key={panel.label}
                data-v5-evidence-state={index === 0 ? snapshot.discovery.currentSystems.state : snapshot.clinic.priorityServices.state}
                style={stepStyle}
              >
                <p style={stepLabelStyle}>{panel.label}</p>
                <h2 style={stepTitleStyle}>{panel.title}</h2>
                <p style={stepTextStyle}>{panel.text}</p>
              </article>
            ))}
          </div>
          <div style={imageWrapStyle}>
            <EditorialImage image={snapshot.assets.sectorImages.journey} width="78mm" height="114mm" />
            <div style={imageCaptionStyle}>{narrative.imageCaption}</div>
          </div>
        </div>
        <div style={closeBandStyle}>{narrative.closeStatement}</div>
      </div>
    </LightPage>
  );
}
