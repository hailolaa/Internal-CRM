import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5ScopeLine, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { LightPage } from "../primitives/LightPage";
import { ScopeMatrix } from "../primitives/ScopeMatrix";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto 1fr auto",
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
  maxWidth: "168mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "30pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const boundaryStyle: CSSProperties = {
  minHeight: "15mm",
  display: "grid",
  alignItems: "center",
  padding: "0 7mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12pt",
  fontWeight: 700,
};

const boundaryLabelStyle: CSSProperties = {
  color: proposalV5Tokens.colors.teal,
};

export function getV5Page15MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.scope?.length) {
    missing.push("scope");
    return missing;
  }
  snapshot.scope.forEach((line: Partial<ProposalV5ScopeLine>, index) => {
    if (!line.title) missing.push(`scope[${index}].title`);
    if (!line.inclusionStatus) missing.push(`scope[${index}].inclusionStatus`);
    if (!line.deliveryType) missing.push(`scope[${index}].deliveryType`);
    if (!line.frequency && !line.quantityLimit) missing.push(`scope[${index}].frequency_or_quantityLimit`);
    if (!line.owner) missing.push(`scope[${index}].owner`);
    if (!line.dependency) missing.push(`scope[${index}].dependency`);
    if (!line.exclusion) missing.push(`scope[${index}].exclusion`);
  });
  return missing;
}

export function V5Page15ScopeMatrix({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page15MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page15ScopeMatrix is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  return (
    <LightPage
      pageId="V5Page15ScopeMatrix"
      pageNumber={15}
      showHeader={false}
      footerNote="The accepted proposal version and signed service agreement control the final delivery scope."
    >
      <div data-v5-page-15 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Written scope</span>
        </div>
        <h1 style={headlineStyle}>Exactly what the selected route includes.</h1>
        <div style={boundaryStyle}>
          <span>
            <span style={boundaryLabelStyle}>Selected boundary:</span> the package scope below controls what is included.
          </span>
        </div>
        <ScopeMatrix lines={snapshot.scope} />
      </div>
    </LightPage>
  );
}
