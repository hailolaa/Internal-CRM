import type { ReactNode } from "react";
import { A4Page } from "./A4Page";
import type { ProposalV5PageId } from "../data/proposalV5Types";

export interface DarkPageProps {
  pageId: ProposalV5PageId;
  pageNumber: number;
  children: ReactNode;
  sectionLabel?: string;
  showHeader?: boolean;
  contentOverflow?: "visible" | "hidden";
  footerNote?: ReactNode;
}

export function DarkPage({ pageId, pageNumber, children, sectionLabel, showHeader, contentOverflow, footerNote }: DarkPageProps) {
  return (
    <A4Page
      pageId={pageId}
      pageNumber={pageNumber}
      theme="dark"
      sectionLabel={sectionLabel}
      showHeader={showHeader}
      contentOverflow={contentOverflow}
      footerNote={footerNote}
    >
      {children}
    </A4Page>
  );
}
