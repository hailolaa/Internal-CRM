import type { CSSProperties } from "react";
import type { ProposalV5EvidenceState, ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto",
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

const pathGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  columnGap: "9mm",
  rowGap: "6mm",
};

const pathItemStyle: CSSProperties = {
  minHeight: "19mm",
  paddingTop: "5mm",
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
};

const pathItemActiveStyle: CSSProperties = {
  ...pathItemStyle,
  padding: "5mm 4mm 4mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  borderTop: "0",
};

const pathTitleStyle: CSSProperties = {
  margin: 0,
  color: "inherit",
  fontSize: "11.5pt",
  fontWeight: 700,
  lineHeight: 1.14,
};

const pathStateStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.muted,
  fontSize: "10pt",
  lineHeight: 1.2,
};

const activeStateStyle: CSSProperties = {
  ...pathStateStyle,
  color: proposalV5Tokens.colors.teal,
};

const leakGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "4mm",
};

const leakStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
  paddingTop: "4mm",
};

const leakLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "9.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const leakTitleStyle: CSSProperties = {
  margin: "1.2mm 0 2mm",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "13pt",
  fontWeight: 700,
  lineHeight: 1.1,
};

const leakDetailStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.5pt",
  lineHeight: 1.25,
};

const actionBandStyle: CSSProperties = {
  minHeight: "15mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

function normalise(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");
}

function evidenceLabel(state: ProposalV5EvidenceState) {
  if (state === "known") return "Confirmed constraint";
  if (state === "working_diagnosis") return "Working constraint";
  if (state === "provisional") return "Provisional constraint";
  return "To confirm";
}

function splitLeak(value: string) {
  const [title, ...detailParts] = value.split("|").map((part) => part.trim()).filter(Boolean);
  return {
    title: title || value,
    detail: detailParts.join(" "),
  };
}

export function getV5Page04MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  const stages = snapshot?.journey?.stages || [];
  const activeConstraint = snapshot?.journey?.activeConstraint?.value || null;
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (stages.length < 8) missing.push("journey.stages[8]");
  if (!activeConstraint) missing.push("journey.activeConstraint.value");
  if (activeConstraint && !stages.some((stage) => normalise(stage) === normalise(activeConstraint))) {
    missing.push("journey.activeConstraint.value matching journey.stages");
  }
  if ((snapshot?.journey?.diagnosedLeaks?.value || []).length < 3) missing.push("journey.diagnosedLeaks.value[3]");
  return missing;
}

export function V5Page04CommercialDiagnosis({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page04MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page04CommercialDiagnosis is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const activeConstraint = snapshot.journey.activeConstraint.value as string;
  const activeConstraintState = snapshot.journey.activeConstraint.state;
  const activeConstraintKey = normalise(activeConstraint);
  const leaks = (snapshot.journey.diagnosedLeaks.value || []).slice(0, 3).map(splitLeak);

  return (
    <LightPage
      pageId="V5Page04CommercialDiagnosis"
      pageNumber={4}
      showHeader={false}
      footerNote={`Prepared exclusively for ${clinicName} - private and confidential`}
    >
      <div data-v5-page-04 data-v5-clinic-type={snapshot.clinic.clinicType} style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>The money path</span>
        </div>
        <h1 style={headlineStyle}>{`Where is ${clinicName}'s money getting stuck?`}</h1>
        <p style={ledeStyle}>One broken hand-off wastes demand, time and capacity.</p>
        <div style={pathGridStyle}>
          {snapshot.journey.stages.slice(0, 8).map((stage) => {
            const isActive = normalise(stage) === activeConstraintKey;
            return (
              <div key={stage} data-v5-evidence-state={isActive ? activeConstraintState : "to_confirm"} style={isActive ? pathItemActiveStyle : pathItemStyle}>
                <p style={pathTitleStyle}>{stage}</p>
                <p style={isActive ? activeStateStyle : pathStateStyle}>
                  {isActive ? evidenceLabel(activeConstraintState) : "Evidence required"}
                </p>
              </div>
            );
          })}
        </div>
        <div style={leakGridStyle}>
          {leaks.map((leak, index) => (
            <article key={`${leak.title}-${index}`} data-v5-evidence-state={snapshot.journey.diagnosedLeaks.state} style={leakStyle}>
              <p style={leakLabelStyle}>{`Leak ${String(index + 1).padStart(2, "0")}`}</p>
              <h2 style={leakTitleStyle}>{leak.title}</h2>
              {leak.detail ? <p style={leakDetailStyle}>{leak.detail}</p> : null}
            </article>
          ))}
        </div>
        <div style={actionBandStyle}>Source - timestamp - status - owner - next action</div>
      </div>
    </LightPage>
  );
}
