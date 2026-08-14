import type { CSSProperties } from "react";
import { formatProposalV5Money } from "../data/breakEven";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5Package } from "../data/proposalV5Types";

export interface InvestmentPanelProps {
  selectedPackage: ProposalV5Package;
}

export function InvestmentPanel({ selectedPackage }: InvestmentPanelProps) {
  const panelStyle: CSSProperties = {
    background: proposalV5Tokens.colors.card,
    border: `0.35mm solid ${proposalV5Tokens.colors.rule}`,
    borderRadius: "3mm",
    boxSizing: "border-box",
    padding: "6mm 7mm",
    color: proposalV5Tokens.colors.headingInk,
    display: "grid",
    gap: "5mm",
  };

  return (
    <section data-v5-investment-panel style={panelStyle}>
      <p style={{ margin: 0, fontSize: proposalV5Tokens.type.legal, color: proposalV5Tokens.colors.strongTeal, fontWeight: 850, letterSpacing: "0.09em", textTransform: "uppercase" }}>
        ClinicGrower managed growth
      </p>
      <h2 style={{ margin: 0, fontSize: proposalV5Tokens.type.internalHeadline, color: proposalV5Tokens.colors.headingInk, lineHeight: 1 }}>
        {selectedPackage.name}
      </h2>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5mm" }}>
        <div>
          <p style={{ margin: 0, color: proposalV5Tokens.colors.muted, fontSize: proposalV5Tokens.type.legal, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>Monthly ClinicGrower fee</p>
          <p style={{ margin: "1.5mm 0 0", color: proposalV5Tokens.colors.headingInk, fontSize: "34pt", fontWeight: 900, lineHeight: 1 }}>
            {formatProposalV5Money(selectedPackage.monthlyFeeCents)}
          </p>
        </div>
        <div>
          <p style={{ margin: 0, color: proposalV5Tokens.colors.muted, fontSize: proposalV5Tokens.type.legal, fontWeight: 800, letterSpacing: "0.06em", textTransform: "uppercase" }}>Setup</p>
          <p style={{ margin: "1.5mm 0 0", color: proposalV5Tokens.colors.strongTeal, fontSize: "24pt", fontWeight: 900, lineHeight: 1 }}>
            {formatProposalV5Money(selectedPackage.setupFeeCents)}
          </p>
        </div>
      </div>
    </section>
  );
}
