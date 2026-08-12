import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto",
  gap: "8mm",
  height: "100%",
};

const eyebrowRowStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "7mm",
  color: proposalV5Tokens.colors.teal,
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
  maxWidth: "171mm",
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "30pt",
  fontWeight: 700,
  letterSpacing: "0",
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  maxWidth: "168mm",
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "13.5pt",
  lineHeight: 1.35,
};

const evidenceListStyle: CSSProperties = {
  display: "grid",
  gap: "5mm",
  marginTop: "2mm",
};

const evidenceRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "15mm 1fr",
  gap: "5mm",
  alignItems: "center",
  minHeight: "31mm",
  padding: "7mm",
  background: proposalV5Tokens.colors.secondaryDark,
  border: `0.35mm solid rgba(87, 187, 182, 0.32)`,
};

const numberStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10.5pt",
  fontWeight: 700,
};

const rowTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "13.5pt",
  fontWeight: 700,
  lineHeight: 1.2,
};

const proofLineStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.teal,
  fontSize: "14pt",
  fontWeight: 700,
  lineHeight: 1.3,
  textAlign: "center",
};

const actionBandStyle: CSSProperties = {
  minHeight: "16mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  padding: "0 10mm",
  background: proposalV5Tokens.colors.paper,
  color: proposalV5Tokens.colors.deepInk,
  fontSize: "13pt",
  fontWeight: 700,
  lineHeight: 1.25,
};

export function getV5Page03MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (snapshot?.schemaVersion !== "proposal_v5") missing.push("schemaVersion");
  return missing;
}

export function V5Page03EvidenceTrail({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page03MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page03EvidenceTrail is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const evidenceRows = [
    "Marketing reports leads and cost per enquiry.",
    "Reception and treatment coordinator sees calls, messages and bookings.",
    "The diary and clinic systems hold attendance, care and value.",
  ];

  return (
    <DarkPage
      pageId="V5Page03EvidenceTrail"
      pageNumber={3}
      showHeader={false}
      footerNote="Connected evidence remains source, access and data-quality dependent."
    >
      <div data-v5-page-03 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Evidence before opinion</span>
        </div>
        <h1 style={headlineStyle}>When the numbers conflict, the clinic owner carries the risk.</h1>
        <p style={ledeStyle}>
          A busy diary can still hide slow responses, unowned follow-up, quiet capacity and marketing spend that nobody can defend.
        </p>
        <div style={evidenceListStyle}>
          {evidenceRows.map((row, index) => (
            <div key={row} style={evidenceRowStyle}>
              <p style={numberStyle}>{String(index + 1).padStart(2, "0")}</p>
              <p style={rowTextStyle}>{row}</p>
            </div>
          ))}
        </div>
        <p style={proofLineStyle}>In the first 14 days, we will prove or reject the working diagnosis.</p>
        <div style={actionBandStyle}>One source of truth. One named owner. One next commercial action.</div>
      </div>
    </DarkPage>
  );
}
