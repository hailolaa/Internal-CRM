import type { CSSProperties } from "react";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5ProofAsset } from "../data/proposalV5Types";

export interface ProofBandProps {
  assets: ProposalV5ProofAsset[];
}

type ProofBandDensity = "editorial" | "balanced" | "compact" | "dense" | "maximum";

function proofTypeLabel(type: ProposalV5ProofAsset["type"]) {
  return String(type || "proof").replace(/_/g, " ");
}

function isRenderableProofImageUrl(url: string | null | undefined) {
  const value = String(url || "").trim();
  if (!value) return false;
  if (value.startsWith("/")) return true;
  return /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?(#.*)?$/i.test(value);
}

function safeExternalProofHref(url: string | null | undefined) {
  if (!url || url.startsWith("/")) return undefined;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" ? url : undefined;
  } catch {
    return undefined;
  }
}

function proofBandDensity(count: number): ProofBandDensity {
  if (count >= 13) return "maximum";
  if (count >= 10) return "dense";
  if (count >= 7) return "compact";
  if (count >= 4) return "balanced";
  return "editorial";
}

function proofBandColumns(density: ProofBandDensity, count: number) {
  if (density === "maximum") return 4;
  if (density === "dense") return 3;
  if (density === "compact" || density === "balanced") return 2;
  return Math.max(1, Math.min(2, count));
}

export function ProofBand({ assets }: ProofBandProps) {
  const density = proofBandDensity(assets.length);
  const columns = proofBandColumns(density, assets.length);
  const maxDensity = density === "maximum";
  const denseDensity = density === "dense";
  const compactDensity = density === "compact";
  const balancedDensity = density === "balanced";
  const mediaSize = maxDensity ? "10mm" : denseDensity ? "13mm" : compactDensity ? "18mm" : balancedDensity ? "26mm" : "38mm";

  const bandStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: maxDensity ? "2mm" : denseDensity ? "2.4mm" : compactDensity ? "3mm" : balancedDensity ? "3.6mm" : "5mm",
    fontSize: proposalV5Tokens.type.legal,
    color: proposalV5Tokens.colors.headingInk,
    minHeight: 0,
  };

  const articleStyle: CSSProperties = {
    display: "grid",
    gridTemplateColumns: `${mediaSize} minmax(0, 1fr)`,
    gap: maxDensity ? "1.4mm" : denseDensity ? "1.7mm" : compactDensity ? "2.4mm" : "3.2mm",
    alignItems: "stretch",
    borderTop: `0.45mm solid ${proposalV5Tokens.colors.rule}`,
    boxSizing: "border-box",
    minHeight: maxDensity ? "13.5mm" : denseDensity ? "17mm" : compactDensity ? "21mm" : balancedDensity ? "30mm" : "43mm",
    paddingTop: maxDensity ? "1.3mm" : denseDensity ? "1.6mm" : compactDensity ? "2.1mm" : balancedDensity ? "2.8mm" : "3.6mm",
    minWidth: 0,
  };

  const mediaStyle: CSSProperties = {
    height: mediaSize,
    minHeight: mediaSize,
    backgroundColor: proposalV5Tokens.colors.softPanel,
    backgroundPosition: "center center",
    backgroundRepeat: "no-repeat",
    backgroundSize: "contain",
    border: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
    boxSizing: "border-box",
  };

  const emptyMediaStyle: CSSProperties = {
    ...mediaStyle,
    display: "grid",
    alignContent: "center",
    justifyItems: "center",
    padding: "2mm",
    color: proposalV5Tokens.colors.muted,
    fontSize: maxDensity ? "5.8pt" : denseDensity ? "6.4pt" : proposalV5Tokens.type.legal,
    fontWeight: 700,
    lineHeight: 1.15,
    textAlign: "center",
    textTransform: "uppercase",
    overflowWrap: "anywhere",
  };

  const titleStyle: CSSProperties = {
    margin: maxDensity ? "0.4mm 0" : denseDensity ? "0.6mm 0" : "1mm 0",
    color: proposalV5Tokens.colors.headingInk,
    fontSize: maxDensity ? "7.2pt" : denseDensity ? "8pt" : compactDensity ? "8.8pt" : balancedDensity ? "10.4pt" : "12pt",
    fontWeight: 800,
    lineHeight: maxDensity ? 1.08 : denseDensity ? 1.15 : 1.16,
    overflowWrap: "anywhere",
  };

  const copyStyle: CSSProperties = {
    margin: 0,
    color: proposalV5Tokens.colors.headingInk,
    fontSize: maxDensity ? "6.4pt" : denseDensity ? "7.1pt" : compactDensity ? "7.7pt" : balancedDensity ? "8.7pt" : "9.8pt",
    lineHeight: maxDensity ? 1.08 : denseDensity ? 1.14 : compactDensity ? 1.22 : 1.26,
    overflowWrap: "anywhere",
  };

  const metaStyle: CSSProperties = {
    margin: maxDensity ? "0.7mm 0 0" : denseDensity ? "1mm 0 0" : "1.5mm 0 0",
    color: proposalV5Tokens.colors.muted,
    fontSize: maxDensity ? "5.8pt" : denseDensity ? "6.4pt" : compactDensity ? "7.3pt" : "8pt",
    lineHeight: maxDensity ? 1.08 : 1.2,
    overflowWrap: "anywhere",
  };

  const typeStyle: CSSProperties = {
    margin: 0,
    color: proposalV5Tokens.colors.strongTeal,
    fontSize: maxDensity ? "5.8pt" : denseDensity ? "6.4pt" : compactDensity ? proposalV5Tokens.type.legal : "7.8pt",
    fontWeight: 800,
    lineHeight: 1.05,
    textTransform: "uppercase",
  };

  return (
    <section data-v5-proof-band data-v5-proof-count={assets.length} data-v5-proof-density={density} style={bandStyle}>
      {assets.map((asset, index) => {
        const proofHref = safeExternalProofHref(asset.mediaUrl);
        const hasImage = isRenderableProofImageUrl(asset.mediaUrl);
        const metaParts = maxDensity
          ? [asset.source, asset.timeframe]
          : [asset.source, asset.timeframe, asset.disclaimer];

        return (
          <article
            key={`${asset.type || "proof"}-${asset.title || "untitled"}-${index}`}
            data-v5-proof-pair
            data-v5-proof-type={asset.type || "proof"}
            style={articleStyle}
          >
            {hasImage ? (
              <div
                aria-label={asset.title || "ClinicGrower proof media"}
                role="img"
                style={{
                  ...mediaStyle,
                  backgroundImage: `url("${asset.mediaUrl}")`,
                }}
              />
            ) : proofHref ? (
              <a href={proofHref} style={{ ...emptyMediaStyle, textDecoration: "none" }}>
                Open proof
              </a>
            ) : (
              <div data-v5-proof-media-status="missing" style={emptyMediaStyle}>
                Evidence summary
              </div>
            )}
            <div>
              <p style={typeStyle}>
                {proofTypeLabel(asset.type)}
              </p>
              <h3 style={titleStyle}>{asset.title}</h3>
              <p style={copyStyle}>{asset.copy}</p>
              <p style={metaStyle}>
                {metaParts.filter(Boolean).join(" | ")}
              </p>
            </div>
        </article>
        );
      })}
    </section>
  );
}
