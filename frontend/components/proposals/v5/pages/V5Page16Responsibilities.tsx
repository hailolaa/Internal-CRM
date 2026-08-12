import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5ScopeLine, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto 1fr auto",
  gap: "5.8mm",
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
  maxWidth: "166mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "30pt",
  fontWeight: 700,
  lineHeight: 1.06,
};

const ledeStyle: CSSProperties = {
  maxWidth: "156mm",
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: proposalV5Tokens.type.lede,
  lineHeight: 1.28,
};

const responsibilityGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "7mm",
};

const responsibilityPanelStyle: CSSProperties = {
  minHeight: "71mm",
  display: "grid",
  alignContent: "start",
  gap: "4.2mm",
  padding: "7mm",
  background: "#FFFFFF",
  border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
};

const panelLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "9.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const panelTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "16pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const responsibilityListStyle: CSSProperties = {
  display: "grid",
  gap: "3.8mm",
  margin: 0,
  padding: 0,
  listStyle: "none",
};

const responsibilityItemStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "6mm 1fr",
  gap: "3mm",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "10.8pt",
  lineHeight: 1.26,
};

const itemDotStyle: CSSProperties = {
  width: "2.8mm",
  height: "2.8mm",
  marginTop: "1.25mm",
  background: proposalV5Tokens.colors.teal,
};

const dependencyTableStyle: CSSProperties = {
  display: "grid",
  gap: 0,
  borderTop: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
  borderBottom: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
};

const dependencyRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "39mm 1fr",
  gap: "6mm",
  minHeight: "15mm",
  alignItems: "center",
  padding: "3mm 0",
  borderTop: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
};

const dependencyFirstRowStyle: CSSProperties = {
  ...dependencyRowStyle,
  borderTop: "none",
};

const dependencyLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const dependencyTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "10.5pt",
  lineHeight: 1.22,
};

const transitionBandStyle: CSSProperties = {
  minHeight: "24mm",
  display: "grid",
  gridTemplateColumns: "34mm 1fr",
  gap: "8mm",
  alignItems: "center",
  padding: "0 8mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
};

const transitionLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const transitionTextStyle: CSSProperties = {
  margin: 0,
  fontSize: "13pt",
  fontWeight: 700,
  lineHeight: 1.16,
};

function present(value: string | null | undefined) {
  return Boolean(value && value.trim());
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(new Set(values.filter((value): value is string => present(value)).map((value) => value.trim())));
}

function joined(values: string[], maxItems = 3) {
  return values.slice(0, maxItems).join("; ");
}

function firstFrequencyLines(scope: ProposalV5ScopeLine[]) {
  return unique(scope.map((line) => line.frequency)).slice(0, 3);
}

export function getV5Page16MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.selectedPackage?.name) missing.push("selectedPackage.name");
  if (!snapshot?.journey?.clinicalBoundary) missing.push("journey.clinicalBoundary");
  if (!snapshot?.narrative?.responsibilities?.lede) missing.push("narrative.responsibilities.lede");
  if (!snapshot?.scope?.length) {
    missing.push("scope");
    return missing;
  }

  const hasDependency = snapshot.scope.some((line) => present(line.dependency));
  const hasClientOwner = snapshot.scope.some((line) => present(line.owner));
  const hasExclusion = snapshot.scope.some((line) => present(line.exclusion));
  const hasFrequency = snapshot.scope.some((line) => present(line.frequency));

  if (!hasDependency) missing.push("scope[].dependency");
  if (!hasClientOwner) missing.push("scope[].owner");
  if (!hasExclusion) missing.push("scope[].exclusion");
  if (!hasFrequency) missing.push("scope[].frequency");
  return missing;
}

export function V5Page16Responsibilities({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page16MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page16Responsibilities is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const packageName = snapshot.selectedPackage.name as string;
  const clinicName = snapshot.clinic.name.value as string;
  const serviceTitles = unique(snapshot.scope.map((line) => line.title));
  const frequencies = firstFrequencyLines(snapshot.scope);
  const dependencies = unique(snapshot.scope.map((line) => line.dependency));
  const clientResponsibilities = unique(snapshot.scope.map((line) => line.owner));
  const exclusions = unique(snapshot.scope.map((line) => line.exclusion));
  const narrative = snapshot.narrative.responsibilities;

  const clinicGrowerResponsibilities = [
    `Deliver the selected ${packageName} scope against the accepted proposal version.`,
    serviceTitles.length > 0 ? `Operate the agreed scope areas: ${joined(serviceTitles)}.` : null,
    frequencies.length > 0 ? `Use the agreed delivery cadence: ${joined(frequencies)}.` : null,
  ].filter((item): item is string => Boolean(item));

  return (
    <LightPage
      pageId="V5Page16Responsibilities"
      pageNumber={16}
      showHeader={false}
      footerNote="Responsibilities are governed by the accepted scope, access provided and approved change control."
    >
      <div data-v5-page-16 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Responsibilities and dependencies</span>
        </div>
        <h1 style={headlineStyle}>Clear responsibilities before the work begins.</h1>
        <p style={ledeStyle}>{narrative.lede}</p>

        <div style={responsibilityGridStyle}>
          <section style={responsibilityPanelStyle}>
            <p style={panelLabelStyle}>{narrative.providerLabel}</p>
            <h2 style={panelTitleStyle}>{narrative.providerTitle}</h2>
            <ul style={responsibilityListStyle}>
              {clinicGrowerResponsibilities.map((item) => (
                <li key={item} style={responsibilityItemStyle}>
                  <span style={itemDotStyle} />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section style={responsibilityPanelStyle}>
            <p style={panelLabelStyle}>{clinicName} owns</p>
            <h2 style={panelTitleStyle}>{narrative.clientTitle}</h2>
            <ul style={responsibilityListStyle}>
              {clientResponsibilities.slice(0, 4).map((item) => (
                <li key={item} style={responsibilityItemStyle}>
                  <span style={itemDotStyle} />
                  <span>{item}.</span>
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div style={dependencyTableStyle}>
          {[
            ["Access and data", joined(dependencies, 4)],
            ["Approvals", joined(clientResponsibilities, 4)],
            ["Human review", snapshot.journey.clinicalBoundary],
            ["Change control", `Excluded unless added through written change control: ${joined(exclusions, 3)}.`],
          ].map(([label, text], index) => (
            <div key={label} style={index === 0 ? dependencyFirstRowStyle : dependencyRowStyle}>
              <p style={dependencyLabelStyle}>{label}</p>
              <p style={dependencyTextStyle}>{text}</p>
            </div>
          ))}
        </div>

        <div style={transitionBandStyle}>
          <p style={transitionLabelStyle}>{narrative.transitionLabel}</p>
          <p style={transitionTextStyle}>{narrative.transitionText}</p>
        </div>
      </div>
    </LightPage>
  );
}
