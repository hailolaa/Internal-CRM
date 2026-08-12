import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto 1fr",
  gap: "10mm",
  height: "100%",
};

const eyebrowRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7mm",
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.5pt",
  fontWeight: 700,
  letterSpacing: "0",
  textTransform: "uppercase",
};

const tealRuleStyle: CSSProperties = {
  width: "13mm",
  height: "0.7mm",
  background: proposalV5Tokens.colors.teal,
};

const headlineStyle: CSSProperties = {
  maxWidth: "168mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "31pt",
  fontWeight: 700,
  letterSpacing: "0",
  lineHeight: 1.08,
};

const decisionBandStyle: CSSProperties = {
  display: "grid",
  minHeight: "16mm",
  alignItems: "center",
  justifyItems: "center",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12pt",
  fontWeight: 700,
  lineHeight: 1.25,
};

const questionsStyle: CSSProperties = {
  display: "grid",
  alignContent: "start",
};

const questionRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "16mm 1fr",
  gap: "5mm",
  minHeight: "33mm",
  alignItems: "start",
  padding: "10mm 0 8mm",
  borderBottom: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
};

const numberStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "11.5pt",
  fontWeight: 700,
  lineHeight: 1.25,
};

const questionTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "14pt",
  fontWeight: 700,
  letterSpacing: "0",
  lineHeight: 1.22,
};

function pluralise(value: string) {
  return value.trim().endsWith("s") ? value.trim() : `${value.trim()}s`;
}

export function getV5Page02MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.economics?.economicUnit) missing.push("economics.economicUnit");
  if (!snapshot?.clinic?.priorityServices?.value?.[0]) missing.push("clinic.priorityServices.value[0]");
  return missing;
}

export function V5Page02EvidenceQuestions({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page02MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page02EvidenceQuestions is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const economicUnit = snapshot.economics.economicUnit as string;
  const priorityService = snapshot.clinic.priorityServices.value?.[0] as string;
  const questions = [
    `Of 100 suitable enquiries, how many were contacted, booked, attended and progressed to ${pluralise(economicUnit)}?`,
    `What is the verified gross contribution per ${economicUnit}, after relevant variable delivery costs?`,
    `How much ${priorityService.toLowerCase()} opportunity value is open, overdue or has no named next action?`,
    "Which paid-for capacity is quiet, and what evidence explains the gap?",
  ];

  return (
    <LightPage
      pageId="V5Page02EvidenceQuestions"
      pageNumber={2}
      showHeader={false}
      footerNote="Suitable means clinic-agreed fit. Contribution and patient value must be confirmed by the clinic."
    >
      <div data-v5-page-02 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>The owner test</span>
        </div>
        <h1 style={headlineStyle}>Could you answer these four questions, with evidence, by 10am today?</h1>
        <div style={decisionBandStyle}>If not, you are deciding blind.</div>
        <div style={questionsStyle}>
          {questions.map((question, index) => (
            <div key={question} style={questionRowStyle}>
              <p style={numberStyle}>{String(index + 1).padStart(2, "0")}</p>
              <p style={questionTextStyle}>{question}</p>
            </div>
          ))}
        </div>
      </div>
    </LightPage>
  );
}
