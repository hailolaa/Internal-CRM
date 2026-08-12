"use client";

import { useSearchParams } from "next/navigation";
import { ProposalV5RealRecordPreviewContent } from "./v5-real-record-preview";

export default function ProposalPreviewPage() {
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("id") || searchParams.get("proposalId") || "";
  const rendererParam = searchParams.get("renderer") || "v5";

  return (
    <ProposalV5RealRecordPreviewContent
      proposalId={proposalId}
      rendererParam={rendererParam}
      basePath="/app/crm/proposals/preview"
    />
  );
}
