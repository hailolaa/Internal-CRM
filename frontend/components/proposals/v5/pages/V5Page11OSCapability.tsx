import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";
import { EditorialImage } from "../primitives/EditorialImage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto 1fr",
  gap: "5.8mm",
  height: "100%",
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
  maxWidth: "174mm",
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "30pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  maxWidth: "168mm",
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "14pt",
  lineHeight: 1.3,
};

const panelGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "7mm",
};

const imageFrameStyle: CSSProperties = {
  margin: "0 0 1mm",
};

const lightPanelStyle: CSSProperties = {
  minHeight: "70mm",
  padding: "8mm",
  background: "#FFFFFF",
  color: proposalV5Tokens.colors.headingInk,
};

const darkPanelStyle: CSSProperties = {
  minHeight: "70mm",
  padding: "8mm",
  border: `0.35mm solid ${proposalV5Tokens.colors.strongTeal}`,
  background: proposalV5Tokens.colors.secondaryDark,
  color: proposalV5Tokens.colors.paper,
};

const panelLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const panelTitleStyle: CSSProperties = {
  margin: "4mm 0 5mm",
  fontSize: "17pt",
  lineHeight: 1.1,
};

const listStyle: CSSProperties = {
  margin: 0,
  paddingLeft: "5mm",
  display: "grid",
  gap: "2.4mm",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "10.8pt",
  lineHeight: 1.25,
};

const darkListStyle: CSSProperties = {
  ...listStyle,
  color: proposalV5Tokens.colors.paper,
};

const capabilityGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  columnGap: "6mm",
  rowGap: "7mm",
};

const capabilityStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.teal}`,
  paddingTop: "4mm",
};

const capabilityTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "11.4pt",
  fontWeight: 700,
};

const capabilityTextStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.rule,
  fontSize: "10pt",
  lineHeight: 1.25,
};

const closeStyle: CSSProperties = {
  maxWidth: "172mm",
  justifySelf: "center",
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "15.5pt",
  fontWeight: 700,
  lineHeight: 1.18,
  textAlign: "center",
};

export function getV5Page11MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.assets?.osScreens?.length) missing.push("assets.osScreens");
  if (!snapshot?.narrative?.osCapability?.headline) missing.push("narrative.osCapability.headline");
  if (!snapshot?.narrative?.osCapability?.capabilities?.length) missing.push("narrative.osCapability.capabilities");
  return missing;
}

export function V5Page11OSCapability({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page11MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page11OSCapability is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const narrative = snapshot.narrative.osCapability;

  return (
    <DarkPage
      pageId="V5Page11OSCapability"
      pageNumber={11}
      showHeader={false}
      footerNote={narrative.footerNote}
    >
      <div data-v5-page-11 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>{narrative.eyebrow}</span>
        </div>
        <h1 style={headlineStyle}>{narrative.headline}</h1>
        <p style={ledeStyle}>{narrative.lede}</p>
        <div style={imageFrameStyle}>
          <EditorialImage image={snapshot.assets.osScreens[0]} height="49mm" />
        </div>
        <div style={panelGridStyle}>
          <section style={lightPanelStyle}>
            <p style={panelLabelStyle}>Available in the OS</p>
            <h2 style={panelTitleStyle}>{narrative.availableTitle}</h2>
            <ul style={listStyle}>
              {narrative.availableItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
          <section style={darkPanelStyle}>
            <p style={panelLabelStyle}>Connection dependent</p>
            <h2 style={panelTitleStyle}>{narrative.dependentTitle}</h2>
            <ul style={darkListStyle}>
              {narrative.dependentItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </section>
        </div>
        <div style={capabilityGridStyle}>
          {narrative.capabilities.map(({ title, text }) => (
            <article key={title} style={capabilityStyle}>
              <h3 style={capabilityTitleStyle}>{title}</h3>
              <p style={capabilityTextStyle}>{text}</p>
            </article>
          ))}
        </div>
        <p style={closeStyle}>{narrative.closeStatement}</p>
      </div>
    </DarkPage>
  );
}
