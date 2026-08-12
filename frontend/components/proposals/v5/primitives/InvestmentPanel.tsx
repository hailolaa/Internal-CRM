import type { CSSProperties } from "react";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5Package } from "../data/proposalV5Types";

export interface InvestmentPanelProps {
  selectedPackage: ProposalV5Package;
}

export function InvestmentPanel({ selectedPackage }: InvestmentPanelProps) {
  const panelStyle: CSSProperties = {
    border: `0.5mm solid ${proposalV5Tokens.colors.teal}`,
    padding: "6mm",
    color: proposalV5Tokens.colors.paper,
  };

  return (
    <section data-v5-investment-panel style={panelStyle}>
      <p style={{ margin: 0, fontSize: proposalV5Tokens.type.legal, color: proposalV5Tokens.colors.rule }}>
        Structural investment panel
      </p>
      <h2 style={{ margin: "4mm 0 0", fontSize: proposalV5Tokens.type.internalHeadline, color: proposalV5Tokens.colors.paper }}>
        {selectedPackage.name}
      </h2>
    </section>
  );
}
