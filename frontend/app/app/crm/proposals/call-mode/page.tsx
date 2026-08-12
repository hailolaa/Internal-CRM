"use client";

import { ArrowLeft, CheckCircle2, FileText, Loader2, Save, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AlertBanner } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  GrowthPackageRecord,
  ProposalDataState,
  ProposalDiscoveryAnswer,
  ProposalDiscoveryAnswers,
  ProposalDiscoveryGuideField,
  ProposalDiscoverySessionRecord,
} from "@/lib/api-types";
import { proposalClinicTypeVariants } from "@/lib/proposal-clinic-variants";

const stateOptions: Array<{ value: ProposalDataState; label: string }> = [
  { value: "known", label: "Confirmed on call" },
  { value: "working_diagnosis", label: "Working diagnosis" },
  { value: "provisional", label: "Provisional" },
  { value: "to_confirm", label: "To confirm" },
];

const inputClass =
  "w-full rounded-lg border border-[#cbded9] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#2F9E99] focus:ring-2 focus:ring-[#BFE8E4]";
const smallInputClass =
  "w-full rounded-lg border border-[#d8e8e4] bg-white px-2.5 py-2 text-xs text-[#14231f] outline-none focus:border-[#2F9E99] focus:ring-2 focus:ring-[#BFE8E4]";

function answerFor(answers: ProposalDiscoveryAnswers, key: string): ProposalDiscoveryAnswer {
  return answers[key] || {
    value: "",
    state: "to_confirm",
    sourceLabel: "Live discovery call",
    sourceAt: new Date().toISOString(),
    customerWording: "",
    notes: "",
  };
}

function formatDateTime(value: string | null) {
  if (!value) return "Not saved yet";
  return new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function prefillLabel(session: ProposalDiscoverySessionRecord | null) {
  const contact = session?.prefillSnapshot?.contact as Record<string, unknown> | null | undefined;
  const account = session?.prefillSnapshot?.account as Record<string, unknown> | null | undefined;
  return String(contact?.accountName || account?.name || contact?.name || "Proposal discovery");
}

export default function ProposalCallModePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session } = useAuth();
  const token = session?.token || "";
  const [record, setRecord] = useState<ProposalDiscoverySessionRecord | null>(null);
  const [answers, setAnswers] = useState<ProposalDiscoveryAnswers>({});
  const [freeNotes, setFreeNotes] = useState("");
  const [packages, setPackages] = useState<GrowthPackageRecord[]>([]);
  const [activeSection, setActiveSection] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadSession = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const sessionId = searchParams.get("sessionId");
      const next = sessionId
        ? await api.proposals.getDiscoverySession(token, sessionId)
        : await api.proposals.startDiscoverySession(token, {
          contactId: searchParams.get("contactId"),
          dealId: searchParams.get("dealId"),
          clientAccountProfileId: searchParams.get("clientAccountProfileId"),
          proposalId: searchParams.get("proposalId"),
        });
      const packageRecords = await api.packages.list(token, { includeInactive: false });
      setPackages(packageRecords);
      setRecord(next);
      setAnswers(next.answers || {});
      setFreeNotes(next.freeNotes || "");
      setDirty(false);
      if (!sessionId) {
        router.replace(`/app/crm/proposals/call-mode?sessionId=${encodeURIComponent(next.id)}`);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not open proposal call mode.");
    } finally {
      setIsLoading(false);
    }
  }, [router, searchParams, token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadSession();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadSession]);

  const saveSession = useCallback(async (status?: ProposalDiscoverySessionRecord["status"]) => {
    if (!token || !record || isSaving) return null;
    setIsSaving(true);
    setError(null);
    try {
      const selectedPackageId = answers.recommendedPackageId?.value || record.recommendedPackageId;
      const updated = await api.proposals.updateDiscoverySession(token, record.id, {
        status,
        clinicType: answers.clinicType?.value || record.clinicType,
        recommendedPackageId: selectedPackageId || null,
        activeConstraintId: answers.workingConstraint?.value || record.activeConstraintId,
        answers,
        freeNotes,
        callOutcome: answers.callOutcome?.value || record.callOutcome,
        nextAction: answers.nextAction?.value || record.nextAction,
        nextActionOwnerId: record.nextActionOwnerId,
        nextActionDueAt: answers.nextActionDueDate?.value || record.nextActionDueAt,
      });
      setRecord(updated);
      setAnswers(updated.answers || answers);
      setFreeNotes(updated.freeNotes || "");
      setDirty(false);
      setMessage(status === "completed" ? "Call saved as completed." : "Autosaved.");
      return updated;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save discovery session.");
      return null;
    } finally {
      setIsSaving(false);
    }
  }, [answers, freeNotes, isSaving, record, token]);

  useEffect(() => {
    if (!dirty || !record) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveSession();
    }, 900);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [dirty, record, saveSession]);

  const guide = record?.guide || [];
  const currentSection = guide[activeSection] || guide[0];
  const selectedVariant = proposalClinicTypeVariants.find((variant) => variant.id === answers.clinicType?.value);
  const selectedPackage = packages.find((item) => item.id === answers.recommendedPackageId?.value || item.id === record?.recommendedPackageId);

  const updateAnswer = (field: ProposalDiscoveryGuideField, patch: Partial<ProposalDiscoveryAnswer>) => {
    setAnswers((current) => {
      const existing = answerFor(current, field.key);
      return {
        ...current,
        [field.key]: {
          ...existing,
          ...patch,
          sourceLabel: patch.sourceLabel ?? existing.sourceLabel ?? "Live discovery call",
          sourceAt: patch.sourceAt ?? existing.sourceAt ?? new Date().toISOString(),
        },
      };
    });
    setDirty(true);
  };

  const handleGenerateDraft = async () => {
    if (!token || !record || isGenerating) return;
    const saved = dirty ? await saveSession("completed") : record;
    if (!saved) return;
    setIsGenerating(true);
    setError(null);
    try {
      const result = await api.proposals.generateDiscoveryDraft(token, saved.id);
      setRecord(result.session);
      setMessage("Draft proposal created from the saved discovery call.");
      router.push(`/app/crm/proposals/edit?id=${encodeURIComponent(result.proposal.id)}`);
    } catch (draftError) {
      setError(draftError instanceof Error ? draftError.message : "Could not create draft proposal.");
    } finally {
      setIsGenerating(false);
    }
  };

  const requiredCount = record?.missingFields.length || 0;
  const blockingCount = record?.conflicts.filter((item) => item.severity === "blocking").length || 0;

  if (isLoading) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[#F4FAFA]">
        <div className="flex items-center gap-3 rounded-xl border border-[#d8e8e4] bg-white px-5 py-4 text-sm font-semibold text-[#315f62]">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening proposal call mode
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F4FAFA] p-4 text-[#14231f] md:p-6">
      <div className="mx-auto flex max-w-7xl flex-col gap-4">
        <div className="flex flex-col gap-3 rounded-2xl border border-[#cfe3df] bg-white p-4 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <Link href="/app/crm/proposals" className="mb-2 inline-flex items-center gap-2 text-sm font-semibold text-[#2F7F7B]">
              <ArrowLeft className="h-4 w-4" /> Proposals
            </Link>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#5F777B]">Live discovery call</p>
            <h1 className="mt-1 text-2xl font-bold text-[#011418] md:text-3xl">Start proposal call: {prefillLabel(record)}</h1>
            <p className="mt-1 max-w-3xl text-sm text-[#5F777B]">
              Capture the commercial discovery once, keep unknowns visible, and generate a draft only after review.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#E6F4F2] px-3 py-1.5 text-xs font-semibold text-[#315f62]">
              {isSaving ? "Saving..." : `Saved ${formatDateTime(record?.lastAutosavedAt || null)}`}
            </span>
            <button
              type="button"
              onClick={() => void saveSession()}
              className="inline-flex items-center gap-2 rounded-lg border border-[#cbded9] bg-white px-3 py-2 text-sm font-semibold text-[#315f62] hover:bg-[#edf7f5]"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save
            </button>
            <button
              type="button"
              onClick={() => void handleGenerateDraft()}
              disabled={isGenerating}
              className="inline-flex items-center gap-2 rounded-lg bg-[#011418] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0C2A30] disabled:opacity-60"
            >
              {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
              Create Draft Proposal
            </button>
          </div>
        </div>

        {error && <AlertBanner variant="error" title="Call mode issue" description={error} />}
        {message && !error && <AlertBanner variant="success" title="Saved" description={message} />}

        <section className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_330px]">
          <aside className="rounded-2xl border border-[#d8e8e4] bg-white p-3 shadow-sm">
            <p className="px-2 pb-2 text-xs font-bold uppercase tracking-[0.18em] text-[#5F777B]">Call guide</p>
            <div className="space-y-1">
              {guide.map((section, index) => (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(index)}
                  className={`w-full rounded-xl px-3 py-2 text-left text-sm font-semibold transition ${
                    index === activeSection ? "bg-[#DFF1EF] text-[#011418]" : "text-[#50676b] hover:bg-[#F4FAFA]"
                  }`}
                >
                  <span className="mr-2 text-xs text-[#2F9E99]">{index + 1}</span>
                  {section.title}
                </button>
              ))}
            </div>
          </aside>

          <section className="rounded-2xl border border-[#d8e8e4] bg-white p-4 shadow-sm">
            {currentSection ? (
              <>
                <div className="mb-4 border-b border-[#e0ece9] pb-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5F777B]">Section {activeSection + 1}</p>
                  <h2 className="mt-1 text-xl font-bold text-[#011418]">{currentSection.title}</h2>
                  <p className="mt-1 text-sm text-[#5F777B]">{currentSection.purpose}</p>
                </div>
                <div className="space-y-4">
                  {currentSection.fields.map((field) => {
                    const answer = answerFor(answers, field.key);
                    return (
                      <div key={field.key} className="rounded-xl border border-[#e0ece9] bg-[#fbfefe] p-3">
                        <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                          <div>
                            <label className="text-sm font-bold text-[#14231f]">{field.label}</label>
                            {field.requiredForIssue && <span className="ml-2 rounded-full bg-[#fff3da] px-2 py-0.5 text-[11px] font-bold text-[#8a5a00]">Required before issue</span>}
                            <p className="mt-0.5 text-xs text-[#5F777B]">{field.prompt}</p>
                          </div>
                          <select
                            value={answer.state}
                            onChange={(event) => updateAnswer(field, { state: event.target.value as ProposalDataState })}
                            className="rounded-lg border border-[#cbded9] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#315f62]"
                          >
                            {stateOptions.map((option) => (
                              <option key={option.value} value={option.value}>{option.label}</option>
                            ))}
                          </select>
                        </div>
                        {field.key === "clinicType" ? (
                          <select
                            value={answer.value || ""}
                            onChange={(event) => updateAnswer(field, { value: event.target.value, state: event.target.value ? "known" : "to_confirm" })}
                            className={inputClass}
                          >
                            <option value="">Select clinic type</option>
                            {proposalClinicTypeVariants.map((variant) => (
                              <option key={variant.id} value={variant.id}>{variant.label}</option>
                            ))}
                          </select>
                        ) : field.key === "recommendedPackageId" ? (
                          <select
                            value={answer.value || ""}
                            onChange={(event) => updateAnswer(field, { value: event.target.value, state: event.target.value ? "known" : "to_confirm" })}
                            className={inputClass}
                          >
                            <option value="">Select approved package</option>
                            {packages.map((item) => (
                              <option key={item.id} value={item.id}>
                                {item.name} {item.priceCents === null ? "" : `- £${Math.round(item.priceCents / 100).toLocaleString("en-GB")}/${item.billingFrequency === "monthly" ? "month" : item.billingFrequency}`}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <textarea
                            value={answer.value || ""}
                            onChange={(event) => updateAnswer(field, { value: event.target.value })}
                            rows={field.key.includes("Wording") || field.key.includes("Boundary") || field.key.includes("Limitations") ? 4 : 2}
                            className={inputClass}
                          />
                        )}
                        <div className="mt-2 grid gap-2 md:grid-cols-2">
                          <input
                            value={answer.customerWording || ""}
                            onChange={(event) => updateAnswer(field, { customerWording: event.target.value })}
                            placeholder="Customer wording, if useful"
                            className={smallInputClass}
                          />
                          <input
                            value={answer.sourceLabel || ""}
                            onChange={(event) => updateAnswer(field, { sourceLabel: event.target.value })}
                            placeholder="Source, e.g. live call / CRM / proposal review"
                            className={smallInputClass}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <p className="text-sm text-[#5F777B]">No guide sections loaded.</p>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#d8e8e4] bg-white p-4 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F777B]">Live summary</p>
              <dl className="mt-3 space-y-3 text-sm">
                <div>
                  <dt className="font-semibold text-[#5F777B]">Clinic type</dt>
                  <dd className="font-bold text-[#011418]">{selectedVariant?.label || "To confirm"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#5F777B]">First journey</dt>
                  <dd className="text-[#14231f]">{answers.firstJourney?.value || selectedVariant?.firstJourneyEmphasis || "To confirm"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#5F777B]">Economic unit</dt>
                  <dd className="text-[#14231f]">{answers.economicUnit?.value || selectedVariant?.economicUnit || "To confirm"}</dd>
                </div>
                <div>
                  <dt className="font-semibold text-[#5F777B]">Package preview</dt>
                  <dd className="font-bold text-[#011418]">{selectedPackage?.name || "No package selected"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-2xl border border-[#d8e8e4] bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F777B]">Issue readiness</p>
                <span className={`rounded-full px-2 py-1 text-xs font-bold ${requiredCount || blockingCount ? "bg-[#fff3da] text-[#8a5a00]" : "bg-[#E6F4F2] text-[#2F7F7B]"}`}>
                  {requiredCount + blockingCount} open
                </span>
              </div>
              <div className="mt-3 space-y-2">
                {record?.topMissingFields.length ? record.topMissingFields.map((item) => (
                  <div key={item.fieldKey} className="rounded-lg bg-[#fff8ed] p-2 text-xs text-[#76510a]">
                    <strong>{item.label}:</strong> {item.message}
                  </div>
                )) : (
                  <div className="flex items-center gap-2 rounded-lg bg-[#ecf8f6] p-2 text-xs font-semibold text-[#2F7F7B]">
                    <CheckCircle2 className="h-4 w-4" /> No top missing fields.
                  </div>
                )}
                {record?.conflicts.slice(0, 4).map((item) => (
                  <div key={item.code} className="rounded-lg bg-[#fff1f0] p-2 text-xs text-[#9b2c1c]">
                    <strong>{item.severity === "blocking" ? "Blocking" : "Warning"}:</strong> {item.message}
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-[#d8e8e4] bg-white p-4 shadow-sm">
              <label className="text-xs font-bold uppercase tracking-[0.18em] text-[#5F777B]">Free notes</label>
              <textarea
                value={freeNotes}
                onChange={(event) => {
                  setFreeNotes(event.target.value);
                  setDirty(true);
                }}
                rows={8}
                className={`${inputClass} mt-2`}
                placeholder="Internal notes. Do not include patient-identifiable or unnecessary clinical data."
              />
            </div>

            {record?.proposalId ? (
              <Link
                href={`/app/crm/proposals/edit?id=${encodeURIComponent(record.proposalId)}`}
                className="flex items-center justify-center gap-2 rounded-xl border border-[#cbded9] bg-white px-4 py-3 text-sm font-bold text-[#315f62] hover:bg-[#edf7f5]"
              >
                <FileText className="h-4 w-4" /> Open linked draft
              </Link>
            ) : null}
          </aside>
        </section>
      </div>
    </main>
  );
}
