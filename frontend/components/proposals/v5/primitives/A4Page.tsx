import type { CSSProperties, ReactNode } from "react";
import { proposalV5Tokens } from "../design/proposalV5Tokens";
import type { ProposalV5PageId, ProposalV5Theme } from "../data/proposalV5Types";

export interface A4PageProps {
  pageId: ProposalV5PageId;
  pageNumber: number;
  theme: ProposalV5Theme;
  children: ReactNode;
  sectionLabel?: string;
  showHeader?: boolean;
  contentOverflow?: CSSProperties["overflow"];
  footerNote?: ReactNode;
}

export function A4Page({
  pageId,
  pageNumber,
  theme,
  children,
  sectionLabel,
  showHeader = true,
  contentOverflow = "hidden",
  footerNote,
}: A4PageProps) {
  const isDark = theme === "dark";
  const pageStyle: CSSProperties = {
    width: proposalV5Tokens.page.width,
    height: proposalV5Tokens.page.height,
    maxHeight: proposalV5Tokens.page.height,
    boxSizing: "border-box",
    overflow: "hidden",
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: "7mm",
    padding: `${proposalV5Tokens.page.safeMarginY} ${proposalV5Tokens.page.safeMarginX} 16mm`,
    background: isDark ? proposalV5Tokens.colors.deepInk : proposalV5Tokens.colors.paper,
    color: isDark ? proposalV5Tokens.colors.paper : proposalV5Tokens.colors.headingInk,
    fontFamily: proposalV5Tokens.font.family,
    pageBreakAfter: "always",
    breakAfter: "page",
  };
  const headerStyle: CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: "7mm",
    color: isDark ? proposalV5Tokens.colors.teal : proposalV5Tokens.colors.strongTeal,
    fontSize: proposalV5Tokens.type.legal,
    fontWeight: 800,
    letterSpacing: "0.06em",
    lineHeight: 1,
    textTransform: "uppercase",
  };
  const contentStyle: CSSProperties = {
    width: proposalV5Tokens.page.contentWidth,
    flex: "1 1 auto",
    minHeight: 0,
    overflow: contentOverflow,
  };
  const footerStyle: CSSProperties = {
    position: "absolute",
    right: proposalV5Tokens.page.safeMarginX,
    bottom: "9mm",
    color: isDark ? proposalV5Tokens.colors.rule : proposalV5Tokens.colors.muted,
    fontSize: proposalV5Tokens.type.legal,
    lineHeight: 1,
  };
  const footerNoteStyle: CSSProperties = {
    position: "absolute",
    left: proposalV5Tokens.page.safeMarginX,
    bottom: "9mm",
    maxWidth: "142mm",
    color: isDark ? proposalV5Tokens.colors.muted : proposalV5Tokens.colors.muted,
    fontSize: proposalV5Tokens.type.legal,
    lineHeight: 1.25,
  };

  return (
    <section
      aria-label={`${pageId} page ${pageNumber}`}
      data-v5-page-id={pageId}
      data-v5-page-number={pageNumber}
      data-v5-page-theme={theme}
      style={pageStyle}
    >
      {showHeader ? (
        <header style={headerStyle}>
          <span>ClinicGrower</span>
          {sectionLabel ? <span>{sectionLabel}</span> : null}
        </header>
      ) : null}
      <div style={contentStyle}>{children}</div>
      {footerNote ? <div style={footerNoteStyle}>{footerNote}</div> : null}
      <footer style={footerStyle}>{pageNumber}</footer>
    </section>
  );
}
