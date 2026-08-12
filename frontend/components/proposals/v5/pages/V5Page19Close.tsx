import type { CSSProperties } from "react";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { DarkPage } from "../primitives/DarkPage";

const clinicGrowerLogoUrl = "/brand/clinic-grower-logo-inline.png";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto 1fr auto auto",
  gap: "6mm",
  height: "100%",
};

const logoStyle: CSSProperties = {
  width: "105mm",
  height: "18mm",
  backgroundImage: `url("${clinicGrowerLogoUrl}")`,
  backgroundPosition: "left center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
  filter: "brightness(0) invert(1)",
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
  maxWidth: "170mm",
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "30pt",
  fontWeight: 700,
  lineHeight: 1.04,
};

const ledeStyle: CSSProperties = {
  maxWidth: "162mm",
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "13.5pt",
  lineHeight: 1.3,
};

const actionGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "5mm",
};

const actionStyle: CSSProperties = {
  minHeight: "45mm",
  display: "grid",
  alignContent: "start",
  gap: "4mm",
  padding: "5.5mm",
  background: proposalV5Tokens.colors.secondaryDark,
  borderTop: `0.7mm solid ${proposalV5Tokens.colors.teal}`,
};

const actionNumberStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "10pt",
  fontWeight: 800,
};

const actionTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12.5pt",
  fontWeight: 800,
  lineHeight: 1.12,
};

const actionTextStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.rule,
  fontSize: "9.8pt",
  lineHeight: 1.28,
};

const outcomeGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(3, 1fr)",
  gap: "5mm",
};

const outcomeStyle: CSSProperties = {
  borderTop: `0.35mm solid ${proposalV5Tokens.colors.teal}`,
  paddingTop: "3.6mm",
};

const outcomeTitleStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.teal,
  fontSize: "9.8pt",
  fontWeight: 800,
  textTransform: "uppercase",
};

const outcomeTextStyle: CSSProperties = {
  margin: "2.5mm 0 0",
  color: proposalV5Tokens.colors.paper,
  fontSize: "11.2pt",
  fontWeight: 700,
  lineHeight: 1.2,
};

const ctaRowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: "5mm",
};

const primaryCtaStyle: CSSProperties = {
  display: "grid",
  minHeight: "13mm",
  alignItems: "center",
  justifyItems: "center",
  padding: "0 6mm",
  background: proposalV5Tokens.colors.teal,
  color: proposalV5Tokens.colors.deepInk,
  fontSize: "10pt",
  fontWeight: 800,
  textDecoration: "none",
  textTransform: "uppercase",
};

const secondaryCtaStyle: CSSProperties = {
  ...primaryCtaStyle,
  background: proposalV5Tokens.colors.paper,
  color: proposalV5Tokens.colors.deepInk,
};

const closeStatementStyle: CSSProperties = {
  minHeight: "18mm",
  display: "grid",
  alignItems: "center",
  padding: "0 7mm",
  background: proposalV5Tokens.colors.secondaryDark,
  color: proposalV5Tokens.colors.paper,
  fontSize: "12.5pt",
  fontWeight: 800,
  lineHeight: 1.18,
};

function firstValue(values: string[] | null | undefined) {
  return values?.find((value) => value && value.trim()) || null;
}

export function getV5Page19MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.name?.value) missing.push("clinic.name");
  if (!snapshot?.recipient?.name?.value) missing.push("recipient.name");
  if (!snapshot?.selectedPackage?.name) missing.push("selectedPackage.name");
  if (!snapshot?.journey?.activeConstraint?.value) missing.push("journey.activeConstraint.value");
  if (!snapshot?.clinic?.priorityServices?.value?.length) missing.push("clinic.priorityServices.value");
  if (!snapshot?.links?.acceptUrl) missing.push("links.acceptUrl");
  if (!snapshot?.links?.questionUrl) missing.push("links.questionUrl");
  if (snapshot?.acceptance?.canAccept !== true) missing.push("acceptance.canAccept");
  return missing;
}

export function V5Page19Close({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page19MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page19Close is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const clinicName = snapshot.clinic.name.value as string;
  const recipientName = snapshot.recipient.name.value as string;
  const packageName = snapshot.selectedPackage.name as string;
  const firstService = firstValue(snapshot.clinic.priorityServices.value) as string;
  const constraint = snapshot.journey.activeConstraint.value as string;

  return (
    <DarkPage pageId="V5Page19Close" pageNumber={19} showHeader={false}>
      <div data-v5-page-19 style={pageStyle}>
        <div aria-label="ClinicGrower" role="img" style={logoStyle} />
        <div style={eyebrowRowStyle}>
          <span style={tealRuleStyle} />
          <span>Your next decision</span>
        </div>
        <h1 style={headlineStyle}>Ready to make the first growth journey accountable?</h1>
        <p style={ledeStyle}>
          {recipientName}, this proposal gives {clinicName} one selected route, one accepted scope and one place to make the next commercial decision.
        </p>

        <div style={actionGridStyle}>
          {[
            ["01", "Review", `Review ${packageName}, its scope and the commercial terms presented in this proposal.`],
            ["02", "Approve", "Approve through the secure online proposal route if the recommendation is accepted."],
            ["03", "Question", "Use the question route if any scope, access or commercial point needs clarifying first."],
          ].map(([number, title, text]) => (
            <article key={number} style={actionStyle}>
              <p style={actionNumberStyle}>{number}</p>
              <h2 style={actionTitleStyle}>{title}</h2>
              <p style={actionTextStyle}>{text}</p>
            </article>
          ))}
        </div>

        <div style={outcomeGridStyle}>
          {[
            ["Known route", `${packageName} remains the selected commercial route.`],
            ["First journey", `${firstService} is the first priority service in view.`],
            ["First constraint", `${constraint} remains the working constraint to resolve.`],
          ].map(([title, text]) => (
            <section key={title} style={outcomeStyle}>
              <p style={outcomeTitleStyle}>{title}</p>
              <p style={outcomeTextStyle}>{text}</p>
            </section>
          ))}
        </div>

        <div style={ctaRowStyle}>
          <a href={snapshot.links.acceptUrl || undefined} style={primaryCtaStyle}>
            Review and accept online
          </a>
          <a href={snapshot.links.questionUrl || undefined} style={secondaryCtaStyle}>
            Ask a question
          </a>
        </div>

        <div style={closeStatementStyle}>
          The next decision is not whether more leads are desirable. It is whether the clinic wants one accountable system for what happens after demand is created.
        </div>
      </div>
    </DarkPage>
  );
}
