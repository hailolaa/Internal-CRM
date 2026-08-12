import type { CSSProperties } from "react";
import { getProposalV5ProofReadinessMissingFields, getProposalV5RelevantProofSet, getProposalV5SelectedProofAssets } from "../data/proofValidation";
import type { ProposalV5RendererProps, ProposalV5Snapshot } from "../data/proposalV5Types";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import { LightPage } from "../primitives/LightPage";
import { ProofBand } from "../primitives/ProofBand";

const clinicGrowerLogoUrl = "/brand/clinic-grower-logo-inline.png";

const pageStyle: CSSProperties = {
  display: "grid",
  gridTemplateRows: "auto auto auto auto auto auto",
  gap: "5.5mm",
  height: "100%",
};

const logoStyle: CSSProperties = {
  width: "96mm",
  height: "16.5mm",
  backgroundImage: `url("${clinicGrowerLogoUrl}")`,
  backgroundPosition: "left center",
  backgroundRepeat: "no-repeat",
  backgroundSize: "contain",
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
  maxWidth: "164mm",
  margin: 0,
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "29.5pt",
  fontWeight: 700,
  lineHeight: 1.06,
};

const proofModeStyle: CSSProperties = {
  width: "fit-content",
  maxWidth: "172mm",
  padding: "2.4mm 4mm",
  background: proposalV5Tokens.colors.softPanel,
  color: proposalV5Tokens.colors.headingInk,
  border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
  fontSize: "9pt",
  fontWeight: 700,
  lineHeight: 1.15,
  textTransform: "uppercase",
};

const proofContextGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.35fr 1fr 1fr",
  gap: "4mm",
  padding: "4mm",
  background: proposalV5Tokens.colors.softPanel,
  borderTop: `0.65mm solid ${proposalV5Tokens.colors.teal}`,
};

const proofContextLabelStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.strongTeal,
  fontSize: proposalV5Tokens.type.legal,
  fontWeight: 800,
  textTransform: "uppercase",
};

const proofContextValueStyle: CSSProperties = {
  margin: "1.4mm 0 0",
  color: proposalV5Tokens.colors.headingInk,
  fontSize: "9.6pt",
  fontWeight: 700,
  lineHeight: 1.18,
};

const sourceStyle: CSSProperties = {
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: proposalV5Tokens.type.legal,
  lineHeight: 1.3,
};

const proofStatusStyle: CSSProperties = {
  display: "grid",
  alignContent: "center",
  gap: "5mm",
  minHeight: "118mm",
  padding: "10mm",
  background: proposalV5Tokens.colors.softPanel,
  borderTop: `0.7mm solid ${proposalV5Tokens.colors.strongTeal}`,
  color: proposalV5Tokens.colors.headingInk,
};

const proofStatusTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "20pt",
  fontWeight: 800,
  lineHeight: 1.08,
};

const proofStatusTextStyle: CSSProperties = {
  maxWidth: "128mm",
  margin: 0,
  color: proposalV5Tokens.colors.muted,
  fontSize: "12pt",
  lineHeight: 1.28,
};

function pageDensityForProofCount(count: number) {
  if (count >= 13) return "maximum";
  if (count >= 9) return "dense";
  if (count >= 5) return "compact";
  if (count >= 3) return "balanced";
  return "editorial";
}

function proofContextValue(values: Array<string | null | undefined>) {
  return values.find((value) => Boolean(String(value || "").trim())) || "Shown where available";
}

export function getV5Page17MissingFields(snapshot: Partial<ProposalV5Snapshot> | null | undefined) {
  const missing: string[] = [];
  if (!snapshot?.clinic?.clinicType) missing.push("clinic.clinicType");
  if (!snapshot?.clinic?.proofTags?.length) missing.push("clinic.proofTags");

  return missing;
}

export function V5Page17Proof({ snapshot }: ProposalV5RendererProps) {
  const missingFields = getV5Page17MissingFields(snapshot);
  if (missingFields.length > 0) {
    throw new Error(`V5Page17Proof is missing required snapshot data: ${missingFields.join(", ")}`);
  }

  const selectedProofAssets = getProposalV5SelectedProofAssets(snapshot);
  const { performanceResults } = getProposalV5RelevantProofSet(snapshot);
  const proofMissingFields = getProposalV5ProofReadinessMissingFields(snapshot);
  const proofScope = proofContextValue([
    performanceResults[0]?.proofScope,
    performanceResults[0]?.proofMode,
    selectedProofAssets[0]?.proofScope,
    selectedProofAssets[0]?.proofMode,
  ]);
  const proofSource = proofContextValue(selectedProofAssets.map((asset) => asset.source));
  const proofTimeframe = proofContextValue(selectedProofAssets.map((asset) => asset.timeframe));
  const proofDisclaimer = proofContextValue(selectedProofAssets.map((asset) => asset.disclaimer));
  const hasSelectedProof = selectedProofAssets.length > 0;
  const hasReadyProof = proofMissingFields.length === 0;
  const pageDensity = pageDensityForProofCount(selectedProofAssets.length);
  const maximumDensity = pageDensity === "maximum";
  const denseDensity = pageDensity === "dense";
  const compactDensity = pageDensity === "compact";
  const adaptivePageStyle: CSSProperties = {
    ...pageStyle,
    gap: maximumDensity ? "2.3mm" : denseDensity ? "2.8mm" : compactDensity ? "3.6mm" : pageStyle.gap,
  };
  const adaptiveLogoStyle: CSSProperties = {
    ...logoStyle,
    width: maximumDensity ? "54mm" : denseDensity ? "64mm" : compactDensity ? "78mm" : logoStyle.width,
    height: maximumDensity ? "9.5mm" : denseDensity ? "11mm" : compactDensity ? "13mm" : logoStyle.height,
  };
  const adaptiveEyebrowStyle: CSSProperties = {
    ...eyebrowRowStyle,
    fontSize: maximumDensity ? "7.2pt" : denseDensity ? "8pt" : compactDensity ? "9pt" : eyebrowRowStyle.fontSize,
    gap: maximumDensity ? "3mm" : denseDensity ? "4mm" : eyebrowRowStyle.gap,
  };
  const adaptiveHeadlineStyle: CSSProperties = {
    ...headlineStyle,
    maxWidth: maximumDensity ? "148mm" : denseDensity ? "154mm" : headlineStyle.maxWidth,
    fontSize: maximumDensity ? "17.8pt" : denseDensity ? "20pt" : compactDensity ? "24pt" : headlineStyle.fontSize,
    lineHeight: maximumDensity ? 1.02 : denseDensity ? 1.03 : headlineStyle.lineHeight,
  };
  const adaptiveContextGridStyle: CSSProperties = {
    ...proofContextGridStyle,
    gap: maximumDensity ? "2mm" : denseDensity ? "2.8mm" : proofContextGridStyle.gap,
    padding: maximumDensity ? "2mm 2.4mm" : denseDensity ? "2.7mm" : compactDensity ? "3.2mm" : proofContextGridStyle.padding,
  };
  const adaptiveContextValueStyle: CSSProperties = {
    ...proofContextValueStyle,
    margin: maximumDensity ? "0.7mm 0 0" : proofContextValueStyle.margin,
    fontSize: maximumDensity ? "7.2pt" : denseDensity ? "8pt" : compactDensity ? "8.8pt" : proofContextValueStyle.fontSize,
    lineHeight: maximumDensity ? 1.08 : denseDensity ? 1.12 : proofContextValueStyle.lineHeight,
  };
  const adaptiveContextLabelStyle: CSSProperties = {
    ...proofContextLabelStyle,
    fontSize: maximumDensity ? "5.8pt" : denseDensity ? "6.5pt" : proofContextLabelStyle.fontSize,
  };
  const adaptiveSourceStyle: CSSProperties = {
    ...sourceStyle,
    fontSize: maximumDensity ? "6.4pt" : denseDensity ? "7pt" : sourceStyle.fontSize,
    lineHeight: maximumDensity ? 1.12 : sourceStyle.lineHeight,
  };

  return (
    <LightPage
      pageId="V5Page17Proof"
      pageNumber={17}
      showHeader={false}
      footerNote={hasSelectedProof ? proofDisclaimer : "Proof is attached to the proposal version when selected."}
    >
      <div data-v5-page-17 data-v5-page-17-proof-count={selectedProofAssets.length} data-v5-page-17-density={pageDensity} style={adaptivePageStyle}>
        <div aria-label="ClinicGrower" role="img" style={adaptiveLogoStyle} />
        <div style={adaptiveEyebrowStyle}>
          <span style={tealRuleStyle} />
          <span>Proof before price</span>
        </div>
        <h1 style={adaptiveHeadlineStyle}>Managed marketing expertise. A complete OS for what happens next.</h1>
        {hasSelectedProof ? (
          <>
            <div style={adaptiveContextGridStyle}>
              <div>
                <p style={adaptiveContextLabelStyle}>Proof scope</p>
                <p style={adaptiveContextValueStyle}>{proofScope}</p>
              </div>
              <div>
                <p style={adaptiveContextLabelStyle}>Source</p>
                <p style={adaptiveContextValueStyle}>{proofSource}</p>
              </div>
              <div>
                <p style={adaptiveContextLabelStyle}>Timeframe</p>
                <p style={adaptiveContextValueStyle}>{proofTimeframe}</p>
              </div>
            </div>

            <ProofBand assets={selectedProofAssets} />
            <p style={adaptiveSourceStyle}>
              {hasReadyProof
                ? `Proof requirements are complete. ${proofDisclaimer}`
                : `Selected proof is shown with source, timeframe and media where available. ${proofDisclaimer}`}
            </p>
          </>
        ) : (
          <section data-v5-proof-status="not-ready" style={proofStatusStyle}>
            <p style={proofModeStyle}>Proof status</p>
            <h2 style={proofStatusTitleStyle}>No proof assets are attached to this proposal version.</h2>
            <p style={proofStatusTextStyle}>
              Proof will appear here once it has been selected for {snapshot.clinic.typeLabel}.
            </p>
          </section>
        )}
      </div>
    </LightPage>
  );
}
