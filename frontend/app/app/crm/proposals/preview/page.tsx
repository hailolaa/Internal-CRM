"use client";

import { ArrowLeft, ExternalLink, Loader2, Printer, RefreshCw } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AlertBanner, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import { SALES_NAV } from "@/lib/section-nav";
import { api } from "@/lib/api-client";
import type { GrowthPackageRecord, ProposalRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { ClinicGrowerProposalTemplate } from "@/components/proposals/clinicgrower-proposal-template";

const sampleProposal: ProposalRecord = {
  id: "preview",
  contactId: null,
  dealId: null,
  clientAccountProfileId: null,
  proposalName: "Growth Engine Proposal",
  templateKey: "clinicgrower_standard",
  packageName: "Growth Engine",
  recommendedPackageId: null,
  ownerId: null,
  ownerName: "ClinicGrower Sales",
  status: "draft",
  valueCents: 199500,
  currency: "GBP",
  followUpAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  readyAt: null,
  sentAt: null,
  viewedAt: null,
  acceptedAt: null,
  wonAt: null,
  lostAt: null,
  expiresAt: null,
  proposalUrl: null,
  notes: "Internal preview generated from Mission Control.",
  sectionContent: null,
  draftSavedAt: null,
  contactName: "Practice Owner",
  contactEmail: "owner@exampleclinic.co.uk",
  accountName: "Example Growth Clinic",
  dealTitle: "Example Growth Clinic - Growth Engine",
  clientAccountName: null,
  createdBy: null,
  updatedBy: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

const samplePackage: GrowthPackageRecord = {
  id: "growth-engine-preview",
  name: "Growth Engine",
  priceCents: 199500,
  currency: "GBP",
  billingFrequency: "monthly",
  setupFeeCents: null,
  includedFeatures: [
    "Clinic Growth Score and commercial opportunity map",
    "Website conversion plan and landing page direction",
    "SEO, GBP and paid acquisition priorities",
    "Tracking, reporting and lead-source visibility",
    "Lead handling and follow-up recommendations",
    "Monthly action plan and performance review rhythm",
  ],
  internalNotes: null,
  proposalWording:
    "Growth Engine is designed for clinics ready to scale acquisition with a controlled website, SEO, ads, tracking and lead handling operating system.",
  sortOrder: 50,
  status: "active",
  isDefault: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

function findMatchingPackage(proposal: ProposalRecord, packages: GrowthPackageRecord[]) {
  if (proposal.recommendedPackageId) {
    const selected = packages.find((item) => item.id === proposal.recommendedPackageId);
    if (selected) return selected;
  }
  const target = (proposal.packageName || proposal.proposalName || "").toLowerCase();
  return packages.find((item) => target.includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(target)) || null;
}

export default function ProposalPreviewPage() {
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const [proposal, setProposal] = useState<ProposalRecord | null>(proposalId ? null : sampleProposal);
  const [packages, setPackages] = useState<GrowthPackageRecord[]>(proposalId ? [] : [samplePackage]);
  const [isLoading, setIsLoading] = useState(Boolean(proposalId));
  const [error, setError] = useState("");

  const loadPreview = useCallback(async () => {
    if (!token || !proposalId) {
      setProposal(sampleProposal);
      setPackages([samplePackage]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const [proposalRecord, packageRecords] = await Promise.all([
        api.proposals.get(token, proposalId),
        api.packages.list(token, { includeInactive: true }),
      ]);
      setProposal(proposalRecord);
      setPackages(packageRecords);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load proposal preview.");
      setProposal(null);
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, token]);

  useEffect(() => {
    void loadPreview();
  }, [loadPreview]);

  const packageRecord = useMemo(
    () => (proposal ? findMatchingPackage(proposal, packages) || (proposalId ? null : samplePackage) : null),
    [packages, proposal, proposalId],
  );

  return (
    <div className="min-h-screen bg-[#f5f6f1]">
      <PageHeader
        title="Proposal Preview"
        subtitle="Preview the internal ClinicGrower proposal template without Better Proposals."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href={proposalId ? `/app/crm/proposals/edit?id=${encodeURIComponent(proposalId)}` : "/app/crm/proposals/edit"}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Edit
            </Link>
            <button
              type="button"
              onClick={() => void loadPreview()}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d]"
            >
              <Printer className="h-4 w-4" />
              Print
            </button>
          </div>
        }
      />
      <SubNav items={SALES_NAV} />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        {!proposalId && (
          <div className="mx-auto mb-4 max-w-5xl">
            <AlertBanner
              title="Preview sample"
              description="Add a proposal id in the URL to preview a real CRM proposal. The reusable template is ready for the proposal builder and send flow."
              variant="info"
            />
          </div>
        )}

        {error && (
          <div className="mx-auto mb-4 max-w-5xl">
            <AlertBanner title="Proposal could not be loaded" description={error} variant="error" />
          </div>
        )}

        {isLoading ? (
          <div className="mx-auto flex min-h-[420px] max-w-5xl items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
            <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
          </div>
        ) : proposal ? (
          <>
            <div className="mx-auto mb-4 flex max-w-5xl justify-end">
              {proposal.proposalUrl ? (
                <a
                  href={proposal.proposalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 text-sm font-semibold text-[#315f51] hover:text-[#24483d]"
                >
                  Open linked proposal URL
                  <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            <ClinicGrowerProposalTemplate proposal={proposal} packageRecord={packageRecord} />
          </>
        ) : null}
      </main>
    </div>
  );
}
