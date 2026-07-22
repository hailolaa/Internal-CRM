"use client";

import { Loader2 } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ClinicGrowerProposalTemplate } from "@/components/proposals/clinicgrower-proposal-template";
import { AlertBanner } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ProposalPublicPreviewRecord } from "@/lib/api-types";

function tokenFromParams(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

export default function SharedProposalPage() {
  const params = useParams<{ token?: string | string[] }>();
  const token = tokenFromParams(params.token);
  const [preview, setPreview] = useState<ProposalPublicPreviewRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSharedProposal = useCallback(async () => {
    if (!token) {
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
    void loadSharedProposal();
  }, [loadSharedProposal]);

  return (
    <main className="min-h-screen bg-[#f5f6f1] px-4 py-6 sm:px-6 lg:px-8">
      {isLoading ? (
        <div className="mx-auto flex min-h-[520px] max-w-5xl items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
        </div>
      ) : error ? (
        <div className="mx-auto max-w-3xl">
          <AlertBanner title="Proposal unavailable" description={error} variant="error" />
        </div>
      ) : preview ? (
        <ClinicGrowerProposalTemplate
          proposal={preview.proposal}
          packageRecord={preview.packageRecord}
          previewMode={false}
        />
      ) : null}
    </main>
  );
}
