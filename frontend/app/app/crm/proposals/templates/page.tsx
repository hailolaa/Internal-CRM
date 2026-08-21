"use client";

import { CheckCircle2, GitCompareArrows, History, Loader2, LockKeyhole, RotateCcw, Send, XCircle } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type {
  ProposalTemplateContent,
  ProposalTemplateRecord,
  ProposalTemplateVersionCompareRecord,
  ProposalTemplateVersionRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

const inputClassName = "mt-1 min-h-10 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const textareaClassName = "mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15";
const cardClassName = "rounded-[8px] border border-[#d8e4df] bg-white p-4";

function statusClass(status: string) {
  if (status === "published") return "bg-[#e6f4ed] text-[#25624d]";
  if (status === "approved") return "bg-[#e8f0fb] text-[#315f7a]";
  if (status === "in_review") return "bg-[#fff2df] text-[#8a5b16]";
  if (status === "rejected") return "bg-[#fbeaec] text-[#91404a]";
  if (status === "superseded") return "bg-[#f1efeb] text-[#6f6a66]";
  return "bg-[#eef7f6] text-[#315f51]";
}

function displayStatus(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function draftFormFromVersion(version: ProposalTemplateVersionRecord | null): ProposalTemplateContent {
  const content = version?.content || {};
  return {
    name: content.name || "",
    description: content.description || "",
    defaultSections: {
      personalIntroduction: content.defaultSections?.personalIntroduction || "",
      diagnosis: content.defaultSections?.diagnosis || "",
      recommendedPlan: content.defaultSections?.recommendedPlan || "",
      nextSteps: content.defaultSections?.nextSteps || "",
      investmentNotes: content.defaultSections?.investmentNotes || "",
    },
    defaultRoadmap: content.defaultRoadmap || [],
    defaultSuccessMetrics: content.defaultSuccessMetrics || [],
  };
}

export default function ProposalTemplatesPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canRead = hasPermission("proposals:read");
  const canWrite = hasPermission("proposals:write") || hasPermission("proposal_templates:write");
  const canApprove = hasPermission("proposal_templates:approve");
  const [templates, setTemplates] = useState<ProposalTemplateRecord[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [versions, setVersions] = useState<ProposalTemplateVersionRecord[]>([]);
  const [selectedVersionId, setSelectedVersionId] = useState("");
  const [draftForm, setDraftForm] = useState<ProposalTemplateContent>({});
  const [changeSummary, setChangeSummary] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [comparison, setComparison] = useState<ProposalTemplateVersionCompareRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [selectedTemplateId, templates],
  );
  const selectedVersion = useMemo(
    () => versions.find((version) => version.id === selectedVersionId) || versions[0] || null,
    [selectedVersionId, versions],
  );
  const editableDraft = selectedVersion?.status === "draft";

  const loadVersions = useCallback(async (templateId: string, nextSelectedVersionId?: string) => {
    if (!token || !templateId) return;
    const rows = await api.proposals.templateVersions(token, templateId);
    setVersions(rows);
    const nextVersion = nextSelectedVersionId
      ? rows.find((version) => version.id === nextSelectedVersionId)
      : rows[0];
    setSelectedVersionId(nextVersion?.id || "");
    setDraftForm(draftFormFromVersion(nextVersion || null));
    setComparison(null);
  }, [token]);

  const loadTemplates = useCallback(async () => {
    if (!token || !canRead) {
      if (token) setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const rows = await api.proposals.templates(token, { includeInactive: true });
      setTemplates(rows);
      const first = rows[0];
      setSelectedTemplateId(first?.id || "");
      if (first) await loadVersions(first.id);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load proposal templates.");
    } finally {
      setIsLoading(false);
    }
  }, [canRead, loadVersions, token]);

  useEffect(() => {
    void Promise.resolve().then(() => loadTemplates());
  }, [loadTemplates]);

  const runAction = async (action: () => Promise<unknown>, success: string, reloadVersionId?: string) => {
    if (!selectedTemplate || !token) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      await action();
      await loadVersions(selectedTemplate.id, reloadVersionId);
      const refreshed = await api.proposals.templates(token, { includeInactive: true });
      setTemplates(refreshed);
      setMessage(success);
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : "Template action failed.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateSection = (key: string, value: string) => {
    setDraftForm((current) => ({
      ...current,
      defaultSections: {
        ...(current.defaultSections || {}),
        [key]: value,
      },
    }));
  };

  const createDraft = async () => {
    if (!selectedTemplate || !token) return;
    setIsSaving(true);
    setError("");
    try {
      const draft = await api.proposals.createTemplateVersion(token, selectedTemplate.id, {
        changeSummary: changeSummary || "Draft created for template revision.",
      });
      await loadVersions(selectedTemplate.id, draft.id);
      setMessage(`Draft version ${draft.versionNumber} created.`);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Could not create draft version.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    if (!selectedTemplate || !selectedVersion || !token) return;
    await runAction(
      () => api.proposals.updateTemplateVersion(token, selectedTemplate.id, selectedVersion.id, {
        content: draftForm,
        expectedContentHash: selectedVersion.contentHash,
        changeSummary,
      }),
      "Draft template version saved.",
      selectedVersion.id,
    );
  };

  const compareLatest = async () => {
    if (!selectedTemplate || versions.length < 2 || !token) return;
    setError("");
    try {
      const result = await api.proposals.compareTemplateVersions(token, selectedTemplate.id, versions[1].id, versions[0].id);
      setComparison(result);
    } catch (compareError) {
      setError(compareError instanceof Error ? compareError.message : "Could not compare template versions.");
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proposal Templates"
        subtitle="Manage reusable proposal template versions before they are used by the existing V19 proposal builder."
        right={<Link href="/app/crm/proposals" className="inline-flex min-h-10 items-center rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51]">Back to proposals</Link>}
      />

      {error ? <AlertBanner title="Template workflow issue" description={error} variant="error" /> : null}
      {message ? <AlertBanner title="Template workflow updated" description={message} variant="success" /> : null}

      {!canRead ? (
        <AlertBanner title="Read-only access required" description="You need proposal read permission to manage proposal templates." variant="error" />
      ) : isLoading ? (
        <div className={cardClassName}><Loader2 className="h-5 w-5 animate-spin" /> Loading proposal templates</div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[320px_1fr]">
          <aside className="space-y-3">
            <div className={cardClassName}>
              <h2 className="text-base font-semibold text-[#14231f]">Templates</h2>
              <div className="mt-3 space-y-2">
                {templates.map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      void loadVersions(template.id);
                    }}
                    className={`w-full rounded-[8px] border p-3 text-left text-sm ${selectedTemplateId === template.id ? "border-[#315f51] bg-[#eef7f6]" : "border-[#d8e4df] bg-white"}`}
                  >
                    <span className="font-semibold text-[#14231f]">{template.name}</span>
                    <span className="mt-1 block text-xs text-[#5b7069]">{template.templateKey}</span>
                    <span className={`mt-2 inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(template.activeVersion?.status || "draft")}`}>
                      {template.activeVersion ? `Published v${template.activeVersion.versionNumber}` : "No published version"}
                    </span>
                  </button>
                ))}
              </div>
            </div>
            <div className={cardClassName}>
              <div className="flex items-center gap-2 text-sm font-semibold text-[#14231f]">
                <LockKeyhole className="h-4 w-4 text-[#315f51]" /> Locked source rules
              </div>
              <p className="mt-2 text-sm leading-6 text-[#5b7069]">
                Package catalogue, pricing, legal terms, proof assets, CRM/client data and V19 structure are not editable here.
              </p>
              <p className="mt-2 text-xs leading-5 text-[#6b817a]">
                Approver permission is explicit: <span className="font-semibold">proposal_templates:approve</span>.
              </p>
            </div>
          </aside>

          <main className="space-y-5">
            <section className={cardClassName}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Active template</p>
                  <h1 className="mt-1 text-2xl font-bold text-[#011418]">{selectedTemplate?.name || "No template selected"}</h1>
                  <p className="mt-1 text-sm text-[#5b7069]">{selectedTemplate?.description || "No description recorded."}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" disabled={!canWrite || isSaving || !selectedTemplate} onClick={() => void createDraft()} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-3 text-sm font-semibold text-white disabled:opacity-50">
                    <History className="h-4 w-4" /> New draft version
                  </button>
                  <button type="button" disabled={versions.length < 2} onClick={() => void compareLatest()} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] disabled:opacity-50">
                    <GitCompareArrows className="h-4 w-4" /> Compare latest
                  </button>
                </div>
              </div>
            </section>

            <section className={cardClassName}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[#14231f]">Version history</h2>
                  <p className="mt-1 text-sm text-[#5b7069]">Drafts are editable. Approved and published payloads are immutable.</p>
                </div>
                {isSaving ? <span className="inline-flex items-center gap-2 text-sm text-[#5b7069]"><Loader2 className="h-4 w-4 animate-spin" /> Working</span> : null}
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {versions.map((version) => (
                  <button
                    key={version.id}
                    type="button"
                    onClick={() => {
                      setSelectedVersionId(version.id);
                      setDraftForm(draftFormFromVersion(version));
                    }}
                    className={`rounded-[8px] border p-3 text-left ${selectedVersionId === version.id ? "border-[#315f51] bg-[#eef7f6]" : "border-[#d8e4df] bg-white"}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[#14231f]">Version {version.versionNumber}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${statusClass(version.status)}`}>{displayStatus(version.status)}</span>
                    </span>
                    <span className="mt-2 block text-xs text-[#5b7069]">Hash {version.contentHash.slice(0, 10)}</span>
                    <span className="mt-1 block text-xs text-[#5b7069]">{version.changeSummary || "No change summary"}</span>
                  </button>
                ))}
              </div>
            </section>

            {selectedVersion ? (
              <section className={cardClassName}>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6b817a]">Selected version</p>
                    <h2 className="mt-1 text-xl font-semibold text-[#14231f]">Version {selectedVersion.versionNumber}</h2>
                    <p className="mt-1 text-sm text-[#5b7069]">Status: {displayStatus(selectedVersion.status)}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" disabled={!editableDraft || !canWrite || isSaving} onClick={() => void saveDraft()} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#315f51] px-3 text-sm font-semibold text-white disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> Save draft
                    </button>
                    <button type="button" disabled={selectedVersion.status !== "draft" || !canWrite || isSaving} onClick={() => void runAction(() => api.proposals.submitTemplateVersion(token!, selectedTemplate!.id, selectedVersion.id), "Template version submitted for review.", selectedVersion.id)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] disabled:opacity-50">
                      <Send className="h-4 w-4" /> Submit
                    </button>
                    <button type="button" disabled={selectedVersion.status !== "in_review" || !canApprove || isSaving} onClick={() => void runAction(() => api.proposals.approveTemplateVersion(token!, selectedTemplate!.id, selectedVersion.id), "Template version approved.", selectedVersion.id)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> Approve
                    </button>
                    <button type="button" disabled={selectedVersion.status !== "approved" || !canApprove || isSaving} onClick={() => void runAction(() => api.proposals.publishTemplateVersion(token!, selectedTemplate!.id, selectedVersion.id), "Template version published.", selectedVersion.id)} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] disabled:opacity-50">
                      <CheckCircle2 className="h-4 w-4" /> Publish
                    </button>
                    <button type="button" disabled={!["approved", "published", "superseded"].includes(selectedVersion.status) || !canApprove || isSaving} onClick={() => void runAction(() => api.proposals.rollbackTemplate(token!, selectedTemplate!.id, selectedVersion.id, changeSummary || `Rollback to version ${selectedVersion.versionNumber}`), "Rollback version published.")} className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 text-sm font-semibold text-[#315f51] disabled:opacity-50">
                      <RotateCcw className="h-4 w-4" /> Roll back to this
                    </button>
                  </div>
                </div>

                {selectedVersion.status === "in_review" ? (
                  <div className="mt-4 rounded-[8px] border border-[#f1d2a6] bg-[#fff9ed] p-3">
                    <label className="text-sm font-semibold text-[#5a3a00]">
                      Rejection reason
                      <textarea rows={2} value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} className={textareaClassName} />
                    </label>
                    <button type="button" disabled={!canApprove || !rejectionReason.trim() || isSaving} onClick={() => void runAction(() => api.proposals.rejectTemplateVersion(token!, selectedTemplate!.id, selectedVersion.id, rejectionReason), "Template version rejected.", selectedVersion.id)} className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-[8px] bg-[#91404a] px-3 text-sm font-semibold text-white disabled:opacity-50">
                      <XCircle className="h-4 w-4" /> Reject with reason
                    </button>
                  </div>
                ) : null}

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <label className="block text-sm font-medium text-[#354943]">
                    Template name
                    <input disabled={!editableDraft} value={draftForm.name || ""} onChange={(event) => setDraftForm((current) => ({ ...current, name: event.target.value }))} className={inputClassName} />
                  </label>
                  <label className="block text-sm font-medium text-[#354943]">
                    Description
                    <input disabled={!editableDraft} value={draftForm.description || ""} onChange={(event) => setDraftForm((current) => ({ ...current, description: event.target.value }))} className={inputClassName} />
                  </label>
                  {([
                    ["personalIntroduction", "Personal introduction"],
                    ["diagnosis", "Diagnosis"],
                    ["recommendedPlan", "Recommended plan"],
                    ["nextSteps", "CTA / next steps"],
                    ["investmentNotes", "Investment notes"],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block text-sm font-medium text-[#354943]">
                      {label}
                      <textarea disabled={!editableDraft} rows={4} value={String(draftForm.defaultSections?.[key] || "")} onChange={(event) => updateSection(key, event.target.value)} className={textareaClassName} />
                    </label>
                  ))}
                  <label className="block text-sm font-medium text-[#354943]">
                    Change summary
                    <textarea rows={3} value={changeSummary} onChange={(event) => setChangeSummary(event.target.value)} className={textareaClassName} />
                  </label>
                </div>
              </section>
            ) : null}

            {comparison ? (
              <section className={cardClassName}>
                <h2 className="text-lg font-semibold text-[#14231f]">Latest comparison</h2>
                <p className="mt-1 text-sm text-[#5b7069]">Version {comparison.fromVersion.versionNumber} to version {comparison.toVersion.versionNumber}</p>
                <div className="mt-4 space-y-2">
                  {comparison.diffs.length ? comparison.diffs.slice(0, 30).map((diff) => (
                    <div key={diff.path} className="rounded-[8px] border border-[#d8e4df] bg-[#fbfdfc] p-3 text-sm">
                      <p className="font-semibold text-[#14231f]">{diff.path}</p>
                      <p className="mt-1 text-[#5b7069]">Before: {String(diff.before || "")}</p>
                      <p className="mt-1 text-[#315f51]">After: {String(diff.after || "")}</p>
                    </div>
                  )) : <p className="text-sm text-[#5b7069]">No content differences.</p>}
                </div>
              </section>
            ) : null}
          </main>
        </div>
      )}
    </div>
  );
}
