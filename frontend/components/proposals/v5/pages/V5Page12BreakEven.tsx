import type { CSSProperties } from "react";
import { calculateProposalV5BreakEven, formatProposalV5Money } from "../data/breakEven";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { LightPage } from "../primitives/LightPage";
import { evidenceStateLabel } from "./pageContentHelpers";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto auto",
  gap: "6mm",
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

const topGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "7mm",
};

const confirmPanelStyle: CSSProperties = {
  minHeight: "53mm",
  display: "grid",
  alignContent: "start",
  gap: "4mm",
  padding: "8mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
};

const proposalPanelStyle: CSSProperties = {
  ...confirmPanelStyle,
  border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
  background: "#FFFFFF",
  color: proposalV5Tokens.colors.headingInk,
};

const panelLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const amountStyle: CSSProperties = {
  margin: 0,
  fontSize: "22pt",
  fontWeight: 700,
  lineHeight: 1.05,
};

const amountTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "11pt",
  lineHeight: 1.25,
};

const darkAmountTextStyle: CSSProperties = {
  ...amountTextStyle,
  color: proposalV5Tokens.colors.rule,
};

const formulaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 10mm 1fr 10mm 1fr",
  gap: "5mm",
  alignItems: "center",
};

const formulaBoxStyle: CSSProperties = {
  minHeight: "35mm",
  display: "grid",
  alignContent: "center",
  justifyItems: "center",
  padding: "5mm",
  border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
  background: "#FFFFFF",
  color: proposalV5Tokens.colors.headingInk,
  textAlign: "center",
};

const formulaResultStyle: CSSProperties = {
  ...formulaBoxStyle,
  border: "none",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
};

const operatorStyle: CSSProperties = {
  justifySelf: "center",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "18pt",
  fontWeight: 700,
};

const formulaValueStyle: CSSProperties = {
  margin: 0,
  fontSize: "19pt",
  fontWeight: 700,
  lineHeight: 1,
};

const formulaLabelStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.muted,
  fontSize: "9.8pt",
  lineHeight: 1.12,
};

const resultLabelStyle: CSSProperties = {
  ...formulaLabelStyle,
  color: proposalV5Tokens.colors.rule,
};

const ruleBandStyle: CSSProperties = {
  minHeight: "24mm",
  display: "grid",
  gridTemplateColumns: "38mm 1fr",
  gap: "8mm",
  alignItems: "center",
  padding: "0 8mm",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
};

const ruleLabelStyle: CSSProperties = {
  margin: 0,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const ruleTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "12.5pt",
  fontWeight: 700,
  lineHeight: 1.18,
};

const inputGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "6mm",
};

const inputStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
  paddingTop: "4mm",
};

const inputTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "10.8pt",
  fontWeight: 700,
};

const inputTextStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.muted,
  fontSize: "10pt",
  lineHeight: 1.22,
};

export function getV5Page12MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.economics?.economicUnit) missing.push("economics.economicUnit");
  return missing;
}

function unitsLabel(units: number | null) {
  return units === null ? "______" : String(units);
}

export function V5Page12BreakEven({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page12MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page12BreakEven is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const calculation = calculateProposalV5BreakEven(snapshot);
  const economicUnit = snapshot.economics.economicUnit as string;
  const contributionState = evidenceStateLabel(snapshot.economics.contribution.state);
  const mediaState = evidenceStateLabel(snapshot.economics.selectedMediaSpend.state);
  const canDisplayValues = calculation.canCalculate && snapshot.readiness.breakEven.canDisplayValues;
  const readinessState = evidenceStateLabel(snapshot.readiness.breakEven.state);
  const recurringBreakEven = snapshot.economics.recurringBreakEvenUnits ?? calculation.recurringBreakEvenUnits;

  return (
    <LightPage pageId="V5Page12BreakEven" pageNumber={12} showHeader={false} footerNote="Decision arithmetic only - not a forecast or guarantee.">
      <div data-v5-page-12 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Your break-even</span>
        </div>
        <h1 style={headlineStyle}>Confirm the economics before any number becomes a promise.</h1>
        <p style={ledeStyle}>Break-even needs clinic-confirmed contribution after variable delivery costs.</p>
        <div style={topGridStyle}>
          <section data-v5-evidence-state={snapshot.economics.contribution.state} style={confirmPanelStyle}>
            <p style={panelLabelStyle}>Clinic confirms</p>
            <h2 style={amountStyle}>{formatProposalV5Money(canDisplayValues ? calculation.contributionCents : null)} contribution</h2>
            <p style={darkAmountTextStyle}>{`Per ${economicUnit}, plus capacity and journey time. ${contributionState}. Break-even display: ${readinessState}.`}</p>
          </section>
          <section data-v5-evidence-state={snapshot.economics.selectedMediaSpend.state} style={proposalPanelStyle}>
            <p style={panelLabelStyle}>Proposal confirms</p>
            <h2 style={amountStyle}>{formatProposalV5Money(canDisplayValues ? calculation.relevantMonthlyInvestmentCents : null)} investment</h2>
            <p style={amountTextStyle}>{`Fees plus relevant platform media. ${mediaState}. Break-even display: ${readinessState}.`}</p>
          </section>
        </div>
        <div style={formulaGridStyle}>
          <div style={formulaBoxStyle}>
            <p style={formulaValueStyle}>{formatProposalV5Money(canDisplayValues ? calculation.relevantMonthlyInvestmentCents : null)}</p>
            <p style={formulaLabelStyle}>relevant monthly investment</p>
          </div>
          <div style={operatorStyle}>{"\u00f7"}</div>
          <div style={formulaBoxStyle}>
            <p style={formulaValueStyle}>{formatProposalV5Money(canDisplayValues ? calculation.contributionCents : null)}</p>
            <p style={formulaLabelStyle}>{`confirmed contribution per ${economicUnit}`}</p>
          </div>
          <div style={operatorStyle}>=</div>
          <div style={formulaResultStyle}>
            <p style={formulaValueStyle}>{unitsLabel(canDisplayValues ? recurringBreakEven : null)}</p>
            <p style={resultLabelStyle}>{`additional ${economicUnit}s required`}</p>
          </div>
        </div>
        <div style={ruleBandStyle}>
          <p style={ruleLabelStyle}>The rule</p>
          <p style={ruleTextStyle}>Round up to a whole outcome. Then check capacity and payback time.</p>
        </div>
        <div style={inputGridStyle}>
          {[
            ["Clinic input", "Contribution, capacity and latency."],
            ["Proposal input", "Selected fees and platform media."],
            ["Mission Control", "Calculate after inputs are confirmed and version-locked."],
          ].map(([title, text]) => (
            <article key={title} style={inputStyle}>
              <h3 style={inputTitleStyle}>{title}</h3>
              <p style={inputTextStyle}>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </LightPage>
  );
}
