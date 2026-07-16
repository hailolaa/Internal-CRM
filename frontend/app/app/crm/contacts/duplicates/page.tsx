"use client";

import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AlertBanner, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { ContactDuplicateCandidate } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function submittedLabel(candidate: ContactDuplicateCandidate) {
  const data = candidate.candidateData || {};
  const name = [data.firstName, data.lastName].filter(Boolean).join(" ");
  return String(data.accountName || name || data.email || data.phone || "New submission");
}

function submittedDetail(candidate: ContactDuplicateCandidate, key: string) {
  const value = candidate.candidateData?.[key];
  return typeof value === "string" && value.trim() ? value : null;
}

export default function DuplicateReviewPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canResolve = hasPermission("contacts:write");
  const [candidates, setCandidates] = useState<ContactDuplicateCandidate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadCandidates = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      setCandidates(await api.contacts.getDuplicateCandidates(token));
    } catch (loadError) {
      console.error("Failed to load duplicate candidates", loadError);
      setError(loadError instanceof Error ? loadError.message : "Unable to load duplicate review queue.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (!isMounted) return;
      await loadCandidates();
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [loadCandidates]);

  const resolveCandidate = async (
    candidateId: string,
    status: "merged" | "not_duplicate" | "ignored",
  ) => {
    if (!token || !canResolve) return;
    setResolvingId(candidateId);
    setError("");
    setMessage("");
    try {
      await api.contacts.resolveDuplicate(token, candidateId, status);
      setCandidates((current) => current.filter((candidate) => candidate.id !== candidateId));
      setMessage("Duplicate review item updated.");
    } catch (resolveError) {
      console.error("Failed to resolve duplicate candidate", resolveError);
      setError(resolveError instanceof Error ? resolveError.message : "Unable to update duplicate review item.");
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Duplicate Review"
        subtitle="Review possible duplicate prospects, contacts, and account submissions."
        icon={AlertTriangle}
        right={
          <button
            type="button"
            onClick={loadCandidates}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
            disabled={isLoading}
          >
            <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        }
      />

      {message && <AlertBanner variant="success" title={message} />}
      {error && <AlertBanner variant="error" title="Duplicate review unavailable" description={error} />}

      {isLoading ? (
        <Card className="p-6">
          <div className="flex items-center gap-3 text-sm text-[#5e8a8d]">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading duplicate review queue
          </div>
        </Card>
      ) : candidates.length === 0 ? (
        <Card className="p-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-[#7D8F7A]" />
            <div>
              <h2 className="font-semibold text-[#151f21]">No open duplicate reviews</h2>
              <p className="mt-1 text-sm text-[#5e8a8d]">
                Strong matches are merged into the existing record automatically. Weaker matches will appear here.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {candidates.map((candidate) => {
            const existing = candidate.existingContact;
            const submittedEmail = submittedDetail(candidate, "email");
            const submittedPhone = submittedDetail(candidate, "phone");
            const submittedWebsite = submittedDetail(candidate, "website");
            const isResolving = resolvingId === candidate.id;

            return (
              <Card key={candidate.id} className="p-4 sm:p-5">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="grid flex-1 gap-4 md:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#7A746A]">
                        Existing record
                      </p>
                      {existing ? (
                        <div className="mt-2 space-y-1">
                          <Link
                            href={`/app/crm/contacts/detail?id=${existing.id}`}
                            className="font-semibold text-[#151f21] hover:text-[#60b4af]"
                          >
                            {existing.name}
                          </Link>
                          <p className="text-sm text-[#5e8a8d]">{existing.email || "No email"}</p>
                          <p className="text-sm text-[#5e8a8d]">{existing.phone || "No phone"}</p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-[#5e8a8d]">No existing record attached.</p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#7A746A]">
                        New submission
                      </p>
                      <div className="mt-2 space-y-1">
                        <p className="font-semibold text-[#151f21]">{submittedLabel(candidate)}</p>
                        <p className="text-sm text-[#5e8a8d]">{submittedEmail || "No email"}</p>
                        <p className="text-sm text-[#5e8a8d]">{submittedPhone || "No phone"}</p>
                        {submittedWebsite && <p className="text-sm text-[#5e8a8d]">{submittedWebsite}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="min-w-[220px] space-y-3">
                    <div className="rounded-lg border border-[#E6E1D8] bg-[#FAF8F5] p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-[#7A746A]">
                        Match
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#151f21]">
                        {candidate.matchType.replace(/_/g, " ")} - {candidate.score}%
                      </p>
                      <p className="mt-1 text-xs text-[#5e8a8d]">{formatDate(candidate.createdAt)}</p>
                    </div>

                    {canResolve ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => resolveCandidate(candidate.id, "merged")}
                          disabled={isResolving}
                          className="btn-primary inline-flex items-center gap-2 text-xs"
                        >
                          {isResolving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                          Mark merged
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveCandidate(candidate.id, "not_duplicate")}
                          disabled={isResolving}
                          className="btn-secondary inline-flex items-center gap-2 text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Not duplicate
                        </button>
                        <button
                          type="button"
                          onClick={() => resolveCandidate(candidate.id, "ignored")}
                          disabled={isResolving}
                          className="btn-secondary text-xs"
                        >
                          Ignore
                        </button>
                      </div>
                    ) : (
                      <p className="text-xs text-[#7A746A]">You need contacts:write to resolve this item.</p>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
