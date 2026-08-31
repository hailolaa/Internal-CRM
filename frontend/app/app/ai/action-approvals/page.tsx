"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Pencil, ShieldCheck, XCircle } from "lucide-react";
import { AlertBanner, Card, EmptyState, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { AiActionApprovalRecord, AiActionApprovalStatus } from "@/lib/api-types";

const statuses: Array<AiActionApprovalStatus | "all"> = ["pending", "approved", "rejected", "committed", "all"];

function statusTone(status: AiActionApprovalStatus) {
  if (status === "committed") return "text-[#08766F] bg-[#E4F6F3]";
  if (status === "approved") return "text-[#2F6C3B] bg-[#EAF7ED]";
  if (status === "rejected") return "text-[#9A5524] bg-[#FBEDE4]";
  return "text-[#8A6428] bg-[#FFF2D8]";
}

function formatDate(value: string | null) {
  if (!value) return "Not yet";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function payloadPreview(value: unknown) {
  if (value === null || value === undefined) return "No payload";
  return JSON.stringify(value, null, 2);
}

export default function AiActionApprovalsPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canReview = hasPermission("ai_actions:review");
  const [status, setStatus] = useState<AiActionApprovalStatus | "all">("pending");
  const [records, setRecords] = useState<AiActionApprovalRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ tone: "success" | "error" | "info"; text: string } | null>(null);
  const [drafts, setDrafts] = useState<Record<string, { title: string; summary: string; reviewNote: string; payload: string; rejectionReason: string }>>({});

  const loadApprovals = useCallback(async (selectedStatus = status) => {
    if (!token || !canReview) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await api.ai.listActionApprovals(token, { status: selectedStatus });
      setRecords(data);
      setDrafts(Object.fromEntries(data.map((record) => [
        record.id,
        {
          title: record.title,
          summary: record.summary || "",
          reviewNote: record.reviewNote || "",
          payload: payloadPreview(record.reviewedPayload ?? record.proposedPayload),
          rejectionReason: record.rejectionReason || "",
        },
      ])));
      setNotice(null);
    } catch (error) {
      console.error("Failed to load AI action approvals", error);
      setNotice({ tone: "error", text: "AI action approvals could not be loaded." });
    } finally {
      setLoading(false);
    }
  }, [canReview, status, token]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadApprovals();
    }, 0);
    return () => window.clearTimeout(handle);
  }, [loadApprovals]);

  const counts = useMemo(() => ({
    pending: records.filter((record) => record.status === "pending").length,
    approved: records.filter((record) => record.status === "approved").length,
    rejected: records.filter((record) => record.status === "rejected").length,
    committed: records.filter((record) => record.status === "committed").length,
  }), [records]);

  async function runAction(record: AiActionApprovalRecord, action: "save" | "approve" | "reject" | "commit") {
    if (!token || savingId) return;
    const draft = drafts[record.id];
    setSavingId(record.id);
    setNotice(null);
    try {
      if (action === "save") {
        let reviewedPayload: unknown = undefined;
        if (draft.payload.trim()) reviewedPayload = JSON.parse(draft.payload);
        await api.ai.updateActionApproval(token, record.id, {
          title: draft.title,
          summary: draft.summary,
          reviewNote: draft.reviewNote,
          reviewedPayload,
        });
      }
      if (action === "approve") {
        let reviewedPayload: unknown = undefined;
        if (draft.payload.trim()) reviewedPayload = JSON.parse(draft.payload);
        await api.ai.approveActionApproval(token, record.id, {
          reviewNote: draft.reviewNote,
          reviewedPayload,
        });
      }
      if (action === "reject") {
        await api.ai.rejectActionApproval(token, record.id, {
          rejectionReason: draft.rejectionReason || "Rejected during human review.",
        });
      }
      if (action === "commit") {
        await api.ai.commitActionApproval(token, record.id);
      }
      setNotice({ tone: "success", text: "AI action approval updated." });
      await loadApprovals();
    } catch (error) {
      console.error("Failed to update AI action approval", error);
      setNotice({
        tone: "error",
        text: error instanceof SyntaxError ? "Reviewed payload must be valid JSON." : "AI action approval could not be updated.",
      });
    } finally {
      setSavingId(null);
    }
  }

  if (!canReview) {
    return (
      <div className="space-y-6">
        <PageHeader title="Action Approvals" subtitle="Human review for post-call AI actions." icon={ShieldCheck} />
        <EmptyState
          icon={ShieldCheck}
          title="Approval access required"
          description="This queue is only available to users with AI action review permission."
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Action Approvals"
        subtitle="Review post-call AI suggestions before anything is committed."
        icon={ClipboardCheck}
      />

      {notice && <AlertBanner title={notice.text} variant={notice.tone === "error" ? "error" : "success"} />}

      <div className="grid gap-3 sm:grid-cols-4">
        {(["pending", "approved", "rejected", "committed"] as AiActionApprovalStatus[]).map((key) => (
          <Card key={key} padding="p-4">
            <p className="text-xs font-semibold uppercase text-[#5e8a8d]">{key}</p>
            <p className="mt-2 text-2xl font-bold text-[#151f21]">{counts[key]}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {statuses.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setStatus(option)}
            className={`rounded-xl px-3 py-2 text-sm font-semibold ${status === option ? "bg-[#08766F] text-white" : "bg-[#FFFCF9] text-[#5e8a8d] border border-[rgba(21,31,33,0.08)]"}`}
          >
            {option === "all" ? "All" : option[0].toUpperCase() + option.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <Card><p className="text-sm text-[#5e8a8d]">Loading approval queue...</p></Card>
      ) : records.length === 0 ? (
        <EmptyState icon={ClipboardCheck} title="No AI actions need review" description="Post-call AI suggestions will appear here before any action is committed." />
      ) : (
        <div className="space-y-4">
          {records.map((record) => {
            const draft = drafts[record.id];
            const isPending = record.status === "pending";
            const isApproved = record.status === "approved";
            const isCommitted = record.status === "committed";
            return (
              <Card key={record.id} className="space-y-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold uppercase ${statusTone(record.status)}`}>{record.status}</span>
                      <span className="text-xs font-semibold uppercase text-[#5e8a8d]">{record.sourceType} / {record.actionType}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-bold text-[#151f21]">{record.title}</h2>
                    <p className="mt-1 text-sm leading-6 text-[#5e8a8d]">{record.summary || "No summary supplied."}</p>
                  </div>
                  <div className="text-xs text-[#7A746A]">
                    <p>Created {formatDate(record.createdAt)}</p>
                    <p>Reviewed {formatDate(record.reviewedAt)}</p>
                    <p>Committed {formatDate(record.committedAt)}</p>
                  </div>
                </div>

                {isPending && draft ? (
                  <div className="grid gap-3 lg:grid-cols-2">
                    <label className="space-y-1 text-sm font-semibold text-[#151f21]">
                      Title
                      <input
                        value={draft.title}
                        onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...draft, title: event.target.value } }))}
                        className="w-full rounded-xl border border-[rgba(21,31,33,0.1)] bg-white px-3 py-2 text-sm font-normal text-[#151f21]"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-[#151f21]">
                      Review note
                      <input
                        value={draft.reviewNote}
                        onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...draft, reviewNote: event.target.value } }))}
                        className="w-full rounded-xl border border-[rgba(21,31,33,0.1)] bg-white px-3 py-2 text-sm font-normal text-[#151f21]"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-[#151f21] lg:col-span-2">
                      Reviewed payload
                      <textarea
                        value={draft.payload}
                        onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...draft, payload: event.target.value } }))}
                        rows={8}
                        className="w-full rounded-xl border border-[rgba(21,31,33,0.1)] bg-white px-3 py-2 font-mono text-xs font-normal text-[#151f21]"
                      />
                    </label>
                    <label className="space-y-1 text-sm font-semibold text-[#151f21] lg:col-span-2">
                      Rejection reason
                      <input
                        value={draft.rejectionReason}
                        onChange={(event) => setDrafts((current) => ({ ...current, [record.id]: { ...draft, rejectionReason: event.target.value } }))}
                        className="w-full rounded-xl border border-[rgba(21,31,33,0.1)] bg-white px-3 py-2 text-sm font-normal text-[#151f21]"
                      />
                    </label>
                  </div>
                ) : (
                  <pre className="max-h-64 overflow-auto rounded-xl bg-[#F4F1EA] p-3 text-xs text-[#151f21]">{payloadPreview(record.reviewedPayload ?? record.proposedPayload)}</pre>
                )}

                <div className="flex flex-wrap gap-2">
                  {isPending && (
                    <>
                      <button type="button" disabled={savingId === record.id} onClick={() => runAction(record, "save")} className="inline-flex items-center gap-2 rounded-xl border border-[rgba(21,31,33,0.08)] bg-white px-3 py-2 text-sm font-semibold text-[#5e8a8d]">
                        <Pencil className="h-4 w-4" /> Save review edits
                      </button>
                      <button type="button" disabled={savingId === record.id} onClick={() => runAction(record, "approve")} className="inline-flex items-center gap-2 rounded-xl bg-[#08766F] px-3 py-2 text-sm font-semibold text-white">
                        <CheckCircle2 className="h-4 w-4" /> Approve
                      </button>
                      <button type="button" disabled={savingId === record.id} onClick={() => runAction(record, "reject")} className="inline-flex items-center gap-2 rounded-xl bg-[#FBEDE4] px-3 py-2 text-sm font-semibold text-[#9A5524]">
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <button type="button" disabled={savingId === record.id} onClick={() => runAction(record, "commit")} className="inline-flex items-center gap-2 rounded-xl bg-[#08766F] px-3 py-2 text-sm font-semibold text-white">
                      <ClipboardCheck className="h-4 w-4" /> Commit approved action
                    </button>
                  )}
                  {isCommitted && (
                    <span className="rounded-xl bg-[#E4F6F3] px-3 py-2 text-sm font-semibold text-[#08766F]">Committed and locked</span>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
