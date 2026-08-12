import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { EditorialImage } from "../primitives/EditorialImage";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto 1fr auto",
  gap: "8mm",
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
  fontSize: "29.5pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: proposalV5Tokens.type.lede,
  lineHeight: 1.28,
};

const splitStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 80mm",
  gap: "8mm",
  alignItems: "start",
};

const statementStyle: CSSProperties = {
  margin: "0 0 6mm",
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "20pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ownerBlockStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
  paddingTop: "4mm",
  marginTop: "5mm",
};

const labelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "9.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const titleStyle: CSSProperties = {
  margin: "1.2mm 0 2.5mm",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "13pt",
  fontWeight: 700,
  lineHeight: 1.1,
};

const textStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.8pt",
  lineHeight: 1.3,
};

const imageWrapStyle: CSSProperties = {
  position: "relative",
};

const imageCaptionStyle: CSSProperties = {
  position: "absolute",
  right: "4mm",
  bottom: "4mm",
  maxWidth: "64mm",
  padding: "4mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "9.8pt",
  lineHeight: 1.22,
};

const closeBandStyle: CSSProperties = {
  minHeight: "25mm",
  display: "grid",
  alignItems: "center",
  padding: "0 7mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "14pt",
  fontWeight: 700,
  lineHeight: 1.25,
};

export function getV5Page10MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.journey?.clinicalBoundary) missing.push("journey.clinicalBoundary");
  if (!snapshot?.assets?.sectorImages?.proof?.url) missing.push("assets.sectorImages.proof.url");
  return missing;
}

export function V5Page10CommercialAccountability({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page10MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page10CommercialAccountability is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  return (
    <LightPage
      pageId="V5Page10CommercialAccountability"
      pageNumber={10}
      showHeader={false}
      footerNote="Care, diagnosis, consent and suitability remain with the clinic."
    >
      <div data-v5-page-10 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Care stays with the clinic</span>
        </div>
        <h1 style={headlineStyle}>Commercial accountability without turning the clinic into a sales floor.</h1>
        <p style={ledeStyle}>The team owns the next action. The clinician retains clinical decisions.</p>
        <div style={splitStyle}>
          <div>
            <h2 style={statementStyle}>Clear commercial ownership. Clear clinical boundaries.</h2>
            <article style={ownerBlockStyle}>
              <p style={labelStyle}>ClinicGrower owns</p>
              <h3 style={titleStyle}>The supported commercial journey</h3>
              <p style={textStyle}>Demand, source visibility, response, overdue follow-up and agreed growth actions.</p>
            </article>
            <article style={ownerBlockStyle}>
              <p style={labelStyle}>The clinic owns</p>
              <h3 style={titleStyle}>Suitability, consent and care</h3>
              <p style={textStyle}>{snapshot.journey.clinicalBoundary}</p>
            </article>
          </div>
          <div style={imageWrapStyle}>
            <EditorialImage image={snapshot.assets.sectorImages.proof} width="80mm" height="136mm" />
            <div style={imageCaptionStyle}>The OS supports the team. It does not replace clinical judgement or patient care.</div>
          </div>
        </div>
        <div style={closeBandStyle}>
          <span>
            <span style={{ color: proposalV5Tokens.colors.teal }}>No pressured selling.</span> No automated clinical advice. Clinical responsibility stays with the clinic.
          </span>
        </div>
      </div>
    </LightPage>
  );
}
