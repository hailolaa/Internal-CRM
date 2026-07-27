"use client";

import { Loader2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClinicGrowerProposalTemplate } from "@/components/proposals/clinicgrower-proposal-template";
import { AlertBanner } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ProposalPublicPreviewRecord } from "@/lib/api-types";

export function SharedProposalContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token")?.trim() || "";
  const [preview, setPreview] = useState<ProposalPublicPreviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSharedProposal = useCallback(async () => {
    if (!token) {
      setPreview(null);
      setError("This proposal link is invalid.");
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const data = await api.proposals.getShared(token);
      setPreview(data);
    } catch (loadError) {
      setPreview(null);
      setError(loadError instanceof Error ? loadError.message : "This proposal link could not be opened.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadSharedProposal();
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadSharedProposal]);

  if (isLoading) {
    return (
      <div className="mx-auto flex min-h-[520px] max-w-5xl items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
        <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
        <span className="sr-only">Loading proposal</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-3xl">
        <AlertBanner title="Proposal unavailable" description={error} variant="error" />
      </div>
    );
  }

  if (!preview) return null;

  return (
    <ClinicGrowerProposalTemplate
      proposal={preview.proposal}
      packageRecord={preview.packageRecord}
      previewMode={false}
    />
  );
}
