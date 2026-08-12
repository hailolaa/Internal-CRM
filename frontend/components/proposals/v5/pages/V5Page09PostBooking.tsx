import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { EditorialImage } from "../primitives/EditorialImage";
import { LightPage } from "../primitives/LightPage";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto auto",
  gap: "5.6mm",
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
  maxWidth: "172mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "29.5pt",
  fontWeight: 700,
  lineHeight: 1.08,
};

const ledeStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "13.4pt",
  lineHeight: 1.28,
};

const demoLabelStyle: CSSProperties = {
  justifySelf: "start",
  padding: "2.5mm 5mm",
  background: proposalV5Tokens.colors.softPanel,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: "10pt",
  fontWeight: 700,
  textTransform: "uppercase",
};

const valueBandStyle: CSSProperties = {
  minHeight: "15mm",
  display: "grid",
  alignItems: "center",
  justifyItems: "center",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
  fontSize: "12pt",
  fontWeight: 700,
};

const metricGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, 1fr)",
  gap: "4mm",
};

const metricStyle: CSSProperties = {
  borderTop: `0.55mm solid ${proposalV5Tokens.colors.strongTeal}`,
  paddingTop: "4mm",
};

const metricTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "10.8pt",
  fontWeight: 700,
};

const metricTextStyle: CSSProperties = {
  margin: "2mm 0 0",
  color: proposalV5Tokens.colors.muted,
  fontSize: "9.7pt",
  lineHeight: 1.18,
};

const closePanelStyle: CSSProperties = {
  display: "grid",
  gap: "3mm",
  padding: "7mm",
  background: proposalV5Tokens.colors.deepInk,
  color: proposalV5Tokens.colors.paper,
};

const closeTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "13pt",
  fontWeight: 700,
};

const closeTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "11pt",
  lineHeight: 1.3,
};

export function getV5Page09MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.journey?.postBookingContinuation) missing.push("journey.postBookingContinuation");
  if (!snapshot?.assets?.postBookingScreenshot?.url) missing.push("assets.postBookingScreenshot.url");
  return missing;
}

export function V5Page09PostBooking({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page09MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page09PostBooking is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const metrics = [
    ["Progression", "Journey stage and last action."],
    ["Priority follow-up", "Overdue next commercial steps."],
    ["Recorded value", "Plan, deposit or service value."],
    ["Accountability", "Named owner and resolution."],
  ];

  return (
    <LightPage
      pageId="V5Page09PostBooking"
      pageNumber={9}
      showHeader={false}
      footerNote={`Prepared exclusively for ${clinicName} - private and confidential`}
    >
      <div data-v5-page-09 style={pageStyle}>
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Beyond the booking</span>
        </div>
        <h1 style={headlineStyle}>They booked. Did they attend, and what happened next?</h1>
        <p style={ledeStyle}>{`For ${clinicName}, the record continues through ${snapshot.journey.postBookingContinuation}.`}</p>
        <div style={demoLabelStyle}>Demonstration data</div>
        <EditorialImage image={snapshot.assets.postBookingScreenshot} height="82mm" />
        <div style={valueBandStyle}>Booking - attendance - follow-up - recorded value.</div>
        <div style={metricGridStyle}>
          {metrics.map(([title, text]) => (
            <article key={title} style={metricStyle}>
              <h2 style={metricTitleStyle}>{title}</h2>
              <p style={metricTextStyle}>{text}</p>
            </article>
          ))}
        </div>
        <section style={closePanelStyle}>
          <h2 style={closeTitleStyle}>A booking is not revenue.</h2>
          <p style={closeTextStyle}>
            Recorded value is not automatically cash received or profit. Data completeness and supported connections control what can be shown.
          </p>
        </section>
      </div>
    </LightPage>
  );
}
