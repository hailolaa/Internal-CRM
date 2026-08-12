import type { CSSProperties } from "react";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5ScopeLine } from "../data/proposalV5Types";

export interface ScopeMatrixProps {
  lines: ProposalV5ScopeLine[];
}

export function ScopeMatrix({ lines }: ScopeMatrixProps) {
  const tableStyle: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    borderTop: `0.55mm solid ${proposalV5Tokens.colors.headingInk}`,
    tableLayout: "fixed",
    fontSize: "8.7pt",
    color: proposalV5Tokens.colors.headingInk,
  };
  const headerCellStyle: CSSProperties = {
    padding: "3mm 2mm 2.5mm 0",
    borderBottom: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
    color: proposalV5Tokens.colors.strongTeal,
    fontSize: "7.8pt",
    fontWeight: 700,
    textAlign: "left",
    textTransform: "uppercase",
  };
  const titleCellStyle: CSSProperties = {
    width: "28%",
    padding: "3.2mm 3mm 3.2mm 0",
    borderBottom: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
    color: proposalV5Tokens.colors.headingInk,
    fontSize: "9.2pt",
    fontWeight: 700,
    lineHeight: 1.15,
    verticalAlign: "top",
    overflowWrap: "anywhere",
  };
  const cellStyle: CSSProperties = {
    width: "24%",
    padding: "3.2mm 3mm 3.2mm 0",
    borderBottom: `0.3mm solid ${proposalV5Tokens.colors.rule}`,
    color: proposalV5Tokens.colors.muted,
    fontSize: "8.5pt",
    lineHeight: 1.18,
    verticalAlign: "top",
    overflowWrap: "anywhere",
  };
  const statusStyle: CSSProperties = {
    margin: "2mm 0 0",
    color: proposalV5Tokens.colors.strongTeal,
    fontSize: "7.5pt",
    fontWeight: 700,
    textTransform: "uppercase",
  };
  const metaStyle: CSSProperties = {
    margin: "1.4mm 0 0",
  };
  const exclusionsStyle: CSSProperties = {
    marginTop: "4.5mm",
    padding: "4.2mm",
    background: proposalV5Tokens.colors.softPanel,
    color: proposalV5Tokens.colors.headingInk,
    fontSize: "8.5pt",
    lineHeight: 1.25,
  };
  const exclusionsLabelStyle: CSSProperties = {
    color: proposalV5Tokens.colors.strongTeal,
    fontWeight: 700,
  };

  const excludedLines = lines.filter((line) => line.inclusionStatus === "excluded");
  const optionalLines = lines.filter((line) => line.isOptionalAddOn);

  function formatDeliveryType(value: ProposalV5ScopeLine["deliveryType"]) {
    if (value === "one_off") return "Initial";
    if (value === "recurring") return "Recurring";
    return null;
  }

  function formatApproval(value: ProposalV5ScopeLine["approvalStatus"]) {
    if (!value || value === "not_required") return null;
    return value.replace(/_/g, " ");
  }

  return (
    <section data-v5-scope-matrix>
      <table style={tableStyle}>
        <thead>
          <tr>
            {["Scope item", "Cadence / limit", "Responsibility", "Exclusions / costs"].map((label) => (
              <th key={label} style={headerCellStyle}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {lines.map((line, index) => (
            <tr key={`${line.title || "scope"}-${index}`}>
              <td style={titleCellStyle}>
                {line.title}
                <p style={statusStyle}>
                  {[line.inclusionStatus, formatDeliveryType(line.deliveryType), line.isOptionalAddOn ? "optional add-on" : null]
                    .filter(Boolean)
                    .join(" / ")}
                </p>
                {line.treatmentsAndLocations ? <p style={metaStyle}>{line.treatmentsAndLocations}</p> : null}
              </td>
              <td style={cellStyle}>{[line.frequency, line.quantityLimit].filter(Boolean).join("; ")}</td>
              <td style={cellStyle}>
                {[line.owner, line.dependency].filter(Boolean).join("; ")}
                {formatApproval(line.approvalStatus) ? <p style={metaStyle}>Approval: {formatApproval(line.approvalStatus)}</p> : null}
              </td>
              <td style={cellStyle}>{[line.exclusion, line.thirdPartyCosts].filter(Boolean).join("; ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {excludedLines.length > 0 || optionalLines.length > 0 ? (
        <div style={exclusionsStyle}>
          <span style={exclusionsLabelStyle}>Decision boundary:</span>{" "}
          {[
            excludedLines.length > 0 ? `${excludedLines.length} excluded item${excludedLines.length === 1 ? "" : "s"}` : null,
            optionalLines.length > 0 ? `${optionalLines.length} optional add-on${optionalLines.length === 1 ? "" : "s"}` : null,
          ].filter(Boolean).join("; ")}
          .
        </div>
      ) : null}
    </section>
  );
}
