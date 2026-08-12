import type { ReactNode } from "react";
import { A4Page } from "./A4Page";
import type { ProposalV5PageId } from "../data/proposalV5Types";

export interface LightPageProps {
  pageId: ProposalV5PageId;
  pageNumber: number;
  children: ReactNode;
  sectionLabel?: string;
  showHeader?: boolean;
  contentOverflow?: "visible" | "hidden";
  footerNote?: ReactNode;
}

export function LightPage({ pageId, pageNumber, children, sectionLabel, showHeader, contentOverflow, footerNote }: LightPageProps) {
  return (
    <A4Page
      pageId={pageId}
      pageNumber={pageNumber}
      theme="light"
      sectionLabel={sectionLabel}
      showHeader={showHeader}
      contentOverflow={contentOverflow}
      footerNote={footerNote}
    >
      {children}
    </A4Page>
  );
}
