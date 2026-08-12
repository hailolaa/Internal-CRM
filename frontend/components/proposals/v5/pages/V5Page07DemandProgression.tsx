import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { EditorialImage } from "../primitives/EditorialImage";
import { LightPage } from "../primitives/LightPage";
import type { ProposalV5EvidenceState } from "../data/proposalV5Types";
import { normaliseText } from "./pageContentHelpers";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto auto",
  gap: "5.5mm",
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

const compareGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "7mm",
};

const compareStyle: CSSProperties = {
  borderTop: `0.45mm solid ${proposalV5Tokens.colors.rule}`,
  paddingTop: "4mm",
};

const activeCompareStyle: CSSProperties = {
  ...compareStyle,
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
};

const compareLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const compareTitleStyle: CSSProperties = {
  margin: "2mm 0",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "13.5pt",
  fontWeight: 700,
  lineHeight: 1.18,
};

const compareTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.2pt",
  lineHeight: 1.22,
};

const demoLabelStyle: CSSProperties = {
  justifySelf: "start",
  padding: "2.6mm 5mm",
  background: proposalV5Tokens.colors.softPanel,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const decisionBandStyle: CSSProperties = {
  minHeight: "15mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
  fontSize: "12.5pt",
  fontWeight: 700,
};

const stepGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "4mm",
};

const stepStyle: CSSProperties = {
  minHeight: "25mm",
  border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
  padding: "5mm",
  color: proposalV5Tokens.colors.headingInk,
};

const stepNumberStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
};

const stepTitleStyle: CSSProperties = {
  margin: "3mm 0 1.5mm",
  fontSize: "11pt",
  lineHeight: 1.1,
};

const stepTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "9.5pt",
  lineHeight: 1.16,
};

function activeSide(snapshot: ProposalV5Snapshot) {
  const activeConstraint = snapshot.journey.activeConstraint.value;
  const activeIndex = snapshot.journey.stages.findIndex((stage) => normaliseText(stage) === normaliseText(activeConstraint || ""));
  return activeIndex >= 0 && activeIndex <= 1 ? "demand" : "progression";
}

function startLabel(side: "demand" | "progression", state: ProposalV5EvidenceState) {
  if (state === "known") return `Confirmed start - ${side}`;
  if (state === "provisional") return `Provisional start - ${side}`;
  if (state === "to_confirm") return `To confirm - ${side}`;
  return `Working start - ${side}`;
}

export function getV5Page07MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.journey?.demandQuestion) missing.push("journey.demandQuestion");
  if (!snapshot?.journey?.progressionQuestion) missing.push("journey.progressionQuestion");
  if (!snapshot?.journey?.activeConstraint?.value) missing.push("journey.activeConstraint.value");
  if (
    snapshot?.journey?.activeConstraint?.value &&
    !snapshot?.journey?.stages?.some((stage) => normaliseText(stage) === normaliseText(snapshot.journey?.activeConstraint?.value || ""))
  ) {
    missing.push("journey.activeConstraint.value matching journey.stages");
  }
  if (!snapshot?.assets?.osScreens?.[0]?.url) missing.push("assets.osScreens[0].url");
  return missing;
}

export function V5Page07DemandProgression({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page07MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page07DemandProgression is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const currentSide = activeSide(snapshot);
  const steps = [
    ["Sources", "Which routes create suitable demand?"],
    ["Performance", "Which services need more demand?"],
    ["Progression", "Where do patients stop?"],
    ["Decision", "Increase, repair or hold?"],
  ];

  return (
    <LightPage
      pageId="V5Page07DemandProgression"
      pageNumber={7}
      showHeader={false}
      footerNote="Revenue views require supported spend and recorded-value data. Recorded value is not cash received."
    >
      <div data-v5-page-07 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Demand or progression?</span>
        </div>
        <h1 style={headlineStyle}>Does the next pound belong in demand, or patient progression?</h1>
        <p style={ledeStyle}>Prove the first constraint before increasing budget.</p>
        <div style={compareGridStyle}>
          <article data-v5-evidence-state={currentSide === "demand" ? snapshot.journey.activeConstraint.state : "to_confirm"} style={currentSide === "demand" ? activeCompareStyle : compareStyle}>
            <p style={compareLabelStyle}>{currentSide === "demand" ? startLabel("demand", snapshot.journey.activeConstraint.state) : "Demand"}</p>
            <h2 style={compareTitleStyle}>{snapshot.journey.demandQuestion}</h2>
            <p style={compareTextStyle}>Visibility, message, source, spend and suitability establish whether acquisition is the first constraint.</p>
          </article>
          <article data-v5-evidence-state={currentSide === "progression" ? snapshot.journey.activeConstraint.state : "to_confirm"} style={currentSide === "progression" ? activeCompareStyle : compareStyle}>
            <p style={compareLabelStyle}>{currentSide === "progression" ? startLabel("progression", snapshot.journey.activeConstraint.state) : "Progression"}</p>
            <h2 style={compareTitleStyle}>{snapshot.journey.progressionQuestion}</h2>
            <p style={compareTextStyle}>Response, booking, attendance, follow-up and value establish whether the hand-off is the first constraint.</p>
          </article>
        </div>
        <div style={demoLabelStyle}>Connected demonstration - scope confirmed first</div>
        <EditorialImage image={snapshot.assets.osScreens[0]} height="77mm" />
        <div style={decisionBandStyle}>Know whether to increase, repair or hold spend.</div>
        <div style={stepGridStyle}>
          {steps.map(([title, text], index) => (
            <article key={title} style={stepStyle}>
              <p style={stepNumberStyle}>{String(index + 1).padStart(2, "0")}</p>
              <h3 style={stepTitleStyle}>{title}</h3>
              <p style={stepTextStyle}>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </LightPage>
  );
}
