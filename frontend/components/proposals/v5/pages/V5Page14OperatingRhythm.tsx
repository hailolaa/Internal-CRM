import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
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

const rhythmStackStyle: CSSProperties = {
  display: "grid",
  gap: "4.5mm",
};

const rhythmRowStyle: CSSProperties = {
  minHeight: "29mm",
  display: "grid",
  gridTemplateColumns: "22mm 42mm 1fr",
  gap: "8mm",
  alignItems: "center",
  padding: "4mm 6mm",
  border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
  background: "#FFFFFF",
};

const numberStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "19pt",
  fontWeight: 700,
};

const rowTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "11.5pt",
  fontWeight: 700,
  lineHeight: 1.1,
  textTransform: "uppercase",
};

const rowTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "11pt",
  lineHeight: 1.24,
};

const closeBandStyle: CSSProperties = {
  minHeight: "17mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  padding: "0 8mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12pt",
  fontWeight: 700,
};

export function getV5Page14MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.operatingRhythm?.morning) missing.push("operatingRhythm.morning");
  if (!snapshot?.operatingRhythm?.weekly) missing.push("operatingRhythm.weekly");
  if (!snapshot?.operatingRhythm?.monthly) missing.push("operatingRhythm.monthly");
  if (!snapshot?.operatingRhythm?.beforeSpend) missing.push("operatingRhythm.beforeSpend");
  return missing;
}

export function V5Page14OperatingRhythm({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page14MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page14OperatingRhythm is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const rows = [
    ["01", "Each morning", snapshot.operatingRhythm.morning],
    ["02", "Each week", snapshot.operatingRhythm.weekly],
    ["03", "Each month", snapshot.operatingRhythm.monthly],
    ["04", "Before more spend", snapshot.operatingRhythm.beforeSpend],
  ];

  return (
    <LightPage
      pageId="V5Page14OperatingRhythm"
      pageNumber={14}
      showHeader={false}
      footerNote={`Prepared exclusively for ${clinicName} - private and confidential`}
    >
      <div data-v5-page-14 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Operating rhythm</span>
        </div>
        <h1 style={headlineStyle}>The same evidence. The same owners. A decision at the right cadence.</h1>
        <p style={ledeStyle}>Keep attention on exceptions, progression and the next commercial choice.</p>
        <div style={rhythmStackStyle}>
          {rows.map(([number, title, text]) => (
            <article key={number} style={rhythmRowStyle}>
              <p style={numberStyle}>{number}</p>
              <h2 style={rowTitleStyle}>{title}</h2>
              <p style={rowTextStyle}>{text}</p>
            </article>
          ))}
        </div>
        <div style={closeBandStyle}>The scorecard exists to trigger a decision - not to decorate a dashboard.</div>
      </div>
    </LightPage>
  );
}
