"use client";

import { ArrowRight, Download, FilePlus2, FileText, Loader2, RefreshCw, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ProposalRecord, ProposalStatus } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { proposalEditorHref } from "@/lib/proposal-editor-state";
import { saveBlobDownload } from "@/lib/download";

const statusOptions: Array<{ value: ProposalStatus | "all"; label: string }> = [
  { value: "all", label: "All active proposals" },
  { value: "draft", label: "Drafts" },
  { value: "ready", label: "Ready" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "follow_up_due", label: "Follow-up due" },
  { value: "accepted", label: "Accepted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "expired", label: "Expired" },
];

function statusLabel(status: ProposalStatus) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function statusClass(status: ProposalStatus) {
  if (status === "draft") return "bg-[#f1efeb] text-[#6f6a66]";
  if (status === "ready" || status === "sent" || status === "viewed") {
    return "bg-[#e8f0fb] text-[#315f7a]";
  }
  if (status === "follow_up_due" || status === "expired") {
    return "bg-[#fff2df] text-[#8a5b16]";
  }
  if (status === "accepted" || status === "won") {
    return "bg-[#e6f4ed] text-[#25624d]";
  }
  return "bg-[#fbeaec] text-[#91404a]";
}

function formatUpdatedAt(proposal: ProposalRecord) {
  const value = proposal.draftSavedAt || proposal.updatedAt;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Save time unavailable";
  return `Saved ${new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date)}`;
}

function proposalAccountName(proposal: ProposalRecord) {
  return (
    proposal.clientAccountName ||
    proposal.accountName ||
    proposal.contactName ||
    "No account or contact name"
  );
}

export default function ProposalsPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canReadProposals = hasPermission("proposals:read");
  const canWriteProposals = hasPermission("proposals:write");
  const [proposals, setProposals] = useState<ProposalRecord[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProposalStatus | "all">("all");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const loadProposals = useCallback(async () => {
    if (!token || !canReadProposals) {
      if (token) setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError("");
    try {
      const records = await api.proposals.list(token, {
        includeArchived: false,
        limit: 250,
      });
      setProposals(records);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load saved proposals.");
    } finally {
      setIsLoading(false);
    }
  }, [canReadProposals, token]);

  useEffect(() => {
    void Promise.resolve().then(() => loadProposals());
  }, [loadProposals]);

  const visibleProposals = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return proposals.filter((proposal) => {
      if (status !== "all" && proposal.status !== status) return false;
      if (!normalizedQuery) return true;
      return [
        proposal.proposalName,
        proposal.clientAccountName,
        proposal.accountName,
        proposal.contactName,
        proposal.contactEmail,
        proposal.packageName,
        proposal.dealTitle,
        proposal.status,
      ].some((value) => String(value || "").toLowerCase().includes(normalizedQuery));
    });
  }, [proposals, query, status]);

  const draftCount = proposals.filter((proposal) => proposal.status === "draft").length;
  const followUpCount = proposals.filter((proposal) => proposal.status === "follow_up_due").length;
  const completedCount = proposals.filter((proposal) => ["accepted", "won"].includes(proposal.status)).length;

  const handleExport = useCallback(async () => {
    if (!token || !canReadProposals || isExporting) return;

    setIsExporting(true);
    setError("");
    try {
      const result = await api.proposals.exportCsv(token, {
        search: query,
        status,
        includeArchived: true,
        limit: 5000,
      });
      saveBlobDownload(result.blob, result.fileName);
    } catch (exportError) {
      setError(exportError instanceof Error ? exportError.message : "Could not export proposals.");
    } finally {
      setIsExporting(false);
    }
  }, [canReadProposals, isExporting, query, status, token]);

  return (
    <div className="min-h-screen bg-[#f5f6f1]">
      <PageHeader
        title="Proposals"
        subtitle="Find, resume and manage saved proposal drafts and active client proposals."
        right={
          <div className="flex flex-wrap items-center gap-2">
            {canReadProposals ? (
              <button
                type="button"
                onClick={handleExport}
                disabled={isExporting || !token}
                className="inline-flex items-center gap-2 rounded-[8px] border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-4 py-2.5 text-sm font-semibold text-[#315f62] transition hover:bg-[#eaedeb] disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {isExporting ? "Exporting" : "Export CSV"}
              </button>
            ) : null}
            {canReadProposals ? (
              <Link
                href="/app/crm/proposals/templates"
                className="inline-flex items-center gap-2 rounded-[8px] border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-4 py-2.5 text-sm font-semibold text-[#315f62] transition hover:bg-[#eaedeb]"
              >
                <FileText className="h-4 w-4" />
                Templates
              </Link>
            ) : null}
            {canWriteProposals ? (
              <Link
                href="/app/crm/proposals/edit"
                className="inline-flex items-center gap-2 rounded-[8px] bg-[#315f51] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#24483d]"
              >
                <FilePlus2 className="h-4 w-4" />
                New proposal
              </Link>
            ) : null}
          </div>
        }
      />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          {!canReadProposals && token ? (
            <AlertBanner
              title="Proposal access is unavailable"
              description="Your role does not include permission to read proposals."
              variant="warning"
            />
          ) : null}
          {error ? (
            <AlertBanner
              title="Saved proposals could not be loaded"
              description={error}
              variant="error"
            />
          ) : null}

          <section aria-label="Proposal summary" className="grid gap-3 sm:grid-cols-3">
            {[
              ["Saved drafts", draftCount],
              ["Follow-up due", followUpCount],
              ["Accepted / won", completedCount],
            ].map(([label, value]) => (
              <div key={label} className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">{label}</p>
                <p className="mt-2 text-2xl font-semibold text-[#14231f]">{value}</p>
              </div>
            ))}
          </section>

          <section className="rounded-[8px] border border-[#d8e4df] bg-white p-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto]">
              <label className="relative block">
                <span className="sr-only">Search saved proposals</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b817a]" />
                <input
                  id="proposal-search"
                  name="proposalSearch"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search proposal, account, contact or package"
                  className="min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-[#fbfcfa] py-2 pl-10 pr-3 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                />
              </label>
              <label>
                <span className="sr-only">Filter proposals by status</span>
                <select
                  id="proposal-status-filter"
                  name="proposalStatusFilter"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ProposalStatus | "all")}
                  className="min-h-11 w-full rounded-[8px] border border-[#d8e4df] bg-[#fbfcfa] px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => void loadProposals()}
                disabled={isLoading || !canReadProposals}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-4 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                Refresh
              </button>
            </div>
          </section>

          {isLoading ? (
            <div className="flex min-h-64 items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" aria-label="Loading saved proposals" />
            </div>
          ) : visibleProposals.length ? (
            <ul className="grid gap-3">
              {visibleProposals.map((proposal) => (
                <li key={proposal.id}>
                  <Link
                    href={proposalEditorHref(proposal.id)}
                    className="group grid gap-4 rounded-[8px] border border-[#d8e4df] bg-white p-4 transition hover:border-[#8cb8a6] hover:shadow-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
                  >
                    <span className="flex min-w-0 items-start gap-3">
                      <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-[#edf5f1] text-[#315f51]">
                        <FileText className="h-5 w-5" />
                      </span>
                      <span className="min-w-0">
                        <span className="flex flex-wrap items-center gap-2">
                          <span className="break-words text-base font-semibold text-[#14231f]">
                            {proposal.proposalName}
                          </span>
                          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClass(proposal.status)}`}>
                            {statusLabel(proposal.status)}
                          </span>
                        </span>
                        <span className="mt-1 block text-sm text-[#5b7069]">
                          {proposalAccountName(proposal)}
                          {proposal.packageName ? ` · ${proposal.packageName}` : ""}
                        </span>
                        <span className="mt-1 block text-xs text-[#6b817a]">{formatUpdatedAt(proposal)}</span>
                      </span>
                    </span>
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-[#315f51]">
                      {proposal.status === "draft"
                        ? canWriteProposals
                          ? "Resume draft"
                          : "View draft"
                        : "Open proposal"}
                      <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-[8px] border border-dashed border-[#bfcfc8] bg-white px-6 py-12 text-center">
              <FileText className="mx-auto h-8 w-8 text-[#6b817a]" />
              <h2 className="mt-3 text-lg font-semibold text-[#14231f]">No proposals match this view</h2>
              <p className="mt-1 text-sm text-[#5b7069]">
                Clear the search or status filter, or start a new proposal.
              </p>
              {canWriteProposals ? (
                <Link
                  href="/app/crm/proposals/edit"
                  className="mt-4 inline-flex items-center gap-2 rounded-[8px] bg-[#315f51] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#24483d]"
                >
                  <FilePlus2 className="h-4 w-4" />
                  New proposal
                </Link>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
