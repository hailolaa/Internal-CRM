import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";
import { evidenceStateLabel } from "./pageContentHelpers";

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
  maxWidth: "172mm",
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "29.5pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  maxWidth: "170mm",
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "13pt",
  lineHeight: 1.32,
};

const demoLabelStyle: CSSProperties = {
  justifySelf: "start",
  padding: "2.5mm 5mm",
  background: proposalV5Tokens.colors.secondaryDark,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const responsePanelStyle: CSSProperties = {
  padding: "6mm",
  background: proposalV5Tokens.colors.paper,
  color: proposalV5Tokens.colors.headingInk,
};

const panelHeaderStyle: CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: "8mm",
  marginBottom: "4mm",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "10.5pt",
  fontWeight: 700,
};

const stateGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "3mm",
  marginBottom: "4mm",
};

const stateBoxStyle: CSSProperties = {
  padding: "4mm",
  background: "#FFFFFF",
  textAlign: "center",
};

const stateValueStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "15pt",
  fontWeight: 700,
};

const stateLabelStyle: CSSProperties = {
  margin: "1mm 0 0",
  color: proposalV5Tokens.colors.muted,
  fontSize: "9pt",
};

const tableStyle: CSSProperties = {
  width: "100%",
  borderCollapse: "collapse",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "9.2pt",
};

const thStyle: CSSProperties = {
  padding: "2.5mm 2mm",
  borderTop: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
  borderBottom: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
  color: proposalV5Tokens.colors.muted,
  fontWeight: 500,
  textAlign: "left",
  textTransform: "uppercase",
};

const tdStyle: CSSProperties = {
  padding: "3mm 2mm",
  borderBottom: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
};

const actionBandStyle: CSSProperties = {
  minHeight: "15mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
  fontSize: "12pt",
  fontWeight: 700,
};

const methodGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "4mm",
};

const methodStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.teal}`,
  paddingTop: "4mm",
};

const methodLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "9.5pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const methodTextStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.rule,
  fontSize: "9.5pt",
  lineHeight: 1.22,
};

function headlineService(value: string) {
  const lowered = value.toLowerCase();
  if (lowered.endsWith("s") && !lowered.endsWith("ss")) return lowered.slice(0, -1);
  return lowered;
}

export function getV5Page08MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.priorityServices?.value || snapshot.clinic.priorityServices.value.length < 3) {
    missing.push("clinic.priorityServices.value[2]");
  }
  return missing;
}

export function V5Page08ResponseOwnership({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page08MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page08ResponseOwnership is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const services = snapshot.clinic.priorityServices.value?.slice(0, 3) || [];
  const evidenceState = evidenceStateLabel(snapshot.clinic.priorityServices.state);
  const methods = [
    ["Record", "Capture and start the clock."],
    ["Expose", "Show what is overdue."],
    ["Assign", "Name owner and action."],
    ["Close", "Record the outcome."],
  ];

  return (
    <DarkPage
      pageId="V5Page08ResponseOwnership"
      pageNumber={8}
      showHeader={false}
      footerNote="Source freshness and supported integrations are confirmed before scope."
    >
      <div data-v5-page-08 data-v5-clinic-type={snapshot.clinic.clinicType} style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Response ownership</span>
        </div>
        <h1 style={headlineStyle}>{`A new ${headlineService(services[0])} enquiry has landed. Who owns the response?`}</h1>
        <p style={ledeStyle}>No more &quot;I thought somebody called them.&quot; Elapsed time, owner and next action remain visible.</p>
        <div style={demoLabelStyle}>Evidence state - not clinic performance</div>
        <section style={responsePanelStyle}>
          <div style={panelHeaderStyle}>
            <span>Response Time</span>
            <span>Configured after the response standard is confirmed</span>
          </div>
          <div style={stateGridStyle}>
            {["Average response", "Target met", "Overdue"].map((label) => (
              <div key={label} data-v5-evidence-state={snapshot.clinic.priorityServices.state} style={stateBoxStyle}>
                <p style={stateValueStyle}>{evidenceState}</p>
                <p style={stateLabelStyle}>{label}</p>
              </div>
            ))}
          </div>
          <table style={tableStyle}>
            <thead>
              <tr>
                {["Enquiry", "Source", "Received", "Owner", "Status"].map((label) => (
                  <th key={label} style={thStyle}>{label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {services.map((service, index) => (
                <tr key={`${service}-${index}`} data-v5-evidence-state={snapshot.clinic.priorityServices.state}>
                  <td style={{ ...tdStyle, fontWeight: 700 }}>{service}</td>
                  <td style={tdStyle}>{evidenceState}</td>
                  <td style={tdStyle}>{evidenceState}</td>
                  <td style={tdStyle}>{evidenceState}</td>
                  <td style={tdStyle}>{evidenceState}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <div style={actionBandStyle}>Every enquiry has a clock, an owner and a recorded outcome.</div>
        <div style={methodGridStyle}>
          {methods.map(([label, text], index) => (
            <article key={label} style={methodStyle}>
              <p style={methodLabelStyle}>{`${String(index + 1).padStart(2, "0")} - ${label}`}</p>
              <p style={methodTextStyle}>{text}</p>
            </article>
          ))}
        </div>
      </div>
    </DarkPage>
  );
}
