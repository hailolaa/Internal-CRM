"use client";

import { useEffect, useMemo, useState } from "react";
import {
  MessageSquare,
  Send,
  Copy,
  CheckCircle2,
  AlertTriangle,
  Gauge,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import {
  AiGenerationProvenance,
  coerceAiRunProvenance,
  PageHeader,
  Card,
} from "@/components/ui";
import { FormField } from "@/components/ui/forms";
import { useFormFields, useClipboard } from "@/hooks";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import {
  getAiModulePageAccess,
  loadOptionalPageResource,
} from "@/lib/ai-page-access";
import type {
  AiRunRecord,
  AiSalesAssistantFollowUp,
  AiSalesAssistantOutput,
  ContactRecord,
} from "@/lib/api-types";

const SALES_ASSISTANT_AGENT_KEY = "sales_assistant";

function getSalesAssistantOutput(run: AiRunRecord | null) {
  const output = run?.output;
  if (!output || typeof output !== "object") return null;

  const maybeOutput = output as Partial<AiSalesAssistantOutput>;
  if (
    typeof maybeOutput.recommendation === "string" &&
    typeof maybeOutput.summary === "string" &&
    maybeOutput.scores &&
    Array.isArray(maybeOutput.followUps)
  ) {
    return maybeOutput as AiSalesAssistantOutput;
  }

  return null;
}

function formatRunDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export default function SalesAssistantPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const { fields, updateField } = useFormFields({
    contactId: "",
    treatment: "",
    context: "",
  });
  const { copied, copy } = useClipboard();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [runs, setRuns] = useState<AiRunRecord[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(true);
  const [isContactsLoading, setIsContactsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [contactsError, setContactsError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<{
    tone: "success" | "error" | "info";
    text: string;
  } | null>(null);
  const salesRuns = useMemo(
    () => runs.filter((run) => run.agentKey === SALES_ASSISTANT_AGENT_KEY),
    [runs],
  );
  const selectedRun =
    salesRuns.find((run) => run.id === selectedRunId) ?? salesRuns[0] ?? null;
  const output = useMemo(
    () => getSalesAssistantOutput(selectedRun),
    [selectedRun],
  );
  const truthfulScores = output?.scores as
    | (AiSalesAssistantOutput["scores"] & {
        followUpFrictionScore?: number;
        followUpPriorityScore?: number;
        followUpReadinessScore?: number;
      })
    | undefined;
  const frictionScore =
    truthfulScores?.followUpFrictionScore ?? truthfulScores?.coldLeadScore;
  const readinessScore =
    truthfulScores?.followUpReadinessScore ??
    truthfulScores?.conversionProbability;
  const priorityScore =
    truthfulScores?.followUpPriorityScore ?? readinessScore;
  const primaryFollowUp = output?.followUps[0] ?? null;
  const selectedContact = contacts.find(
    (contact) => contact.id === fields.contactId,
  );
  const access = getAiModulePageAccess(hasPermission, "contacts:read");
  const canGenerate = Boolean(
    token &&
      access.canGenerate &&
      selectedContact &&
      !isContactsLoading,
  );
  const generationPermissionMessage = !access.canReadSource
    ? "Contacts read access is required to select a CRM contact."
    : !access.canWriteReports
      ? "Reports write access is required to generate and save a follow-up."
      : null;

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadHistory() {
      queueMicrotask(() => {
        if (!cancelled) setIsHistoryLoading(access.canReadHistory);
      });
      const result = await loadOptionalPageResource(
        access.canReadHistory,
        () =>
          api.ai.listRuns(authToken, {
            agentKey: SALES_ASSISTANT_AGENT_KEY,
          }),
      );
      if (cancelled) return;

      if (result.status === "loaded") {
        setRuns(result.data);
        setHistoryNotice(null);
      } else if (result.status === "skipped") {
        setRuns([]);
        setHistoryNotice(
          "Saved follow-up history requires Reports read access. You can still generate a new result with Contacts read and Reports write access.",
        );
      } else {
        console.error("Failed to load sales assistant history", result.error);
        setRuns([]);
        setHistoryNotice(
          "Saved follow-up history could not be loaded. Available CRM contacts are unaffected, so you can still generate a new result.",
        );
      }

      setIsHistoryLoading(false);
    }

    async function loadContacts() {
      queueMicrotask(() => {
        if (!cancelled) setIsContactsLoading(access.canReadSource);
      });
      const result = await loadOptionalPageResource(
        access.canReadSource,
        () =>
          api.contacts.list(authToken, {
            page: 1,
            pageSize: 100,
            sortBy: "updatedAt",
            sortDir: "desc",
          }),
      );
      if (cancelled) return;

      if (result.status === "loaded") {
        setContacts(result.data.contacts);
        setContactsError(null);
      } else if (result.status === "skipped") {
        setContacts([]);
        setContactsError(
          "CRM contacts are hidden because this role does not have Contacts read access.",
        );
      } else {
        console.error("Failed to load CRM contacts", result.error);
        setContacts([]);
        setContactsError(
          result.error instanceof Error
            ? `CRM contacts could not be loaded: ${result.error.message}`
            : "CRM contacts could not be loaded.",
        );
      }

      setIsContactsLoading(false);
    }

    void loadHistory();
    void loadContacts();

    return () => {
      cancelled = true;
    };
  }, [
    access.canReadHistory,
    access.canReadSource,
    token,
  ]);

  const handleRun = async () => {
    if (!token || !access.canGenerate || isGenerating || !selectedContact) {
      return;
    }

    setIsGenerating(true);
    setStatusMessage(null);
    try {
      const generated = await api.ai.generateSalesAssistant(token, {
        contactId: selectedContact?.id,
        treatment: fields.treatment.trim() || undefined,
        context: fields.context.trim() || undefined,
      });

      setRuns((current) => [
        {
          id: generated.id,
          projectId: null,
          agentName: "Sales Assistant",
          agentKey: generated.agentKey,
          task: `Generated follow-up suggestions for ${selectedContact?.name || "CRM contact"}`,
          input: generated.input,
          output: generated.output,
          status: generated.status,
          tokens: 0,
          createdAt: generated.createdAt,
        },
        ...current.filter((run) => run.id !== generated.id),
      ]);
      setSelectedRunId(generated.id);
      setStatusMessage({
        tone: "success",
        text: access.canReadHistory
          ? "Rules-based follow-up suggestions generated and saved to history."
          : "Rules-based follow-up suggestions generated and saved. This result is available now; reopening saved history requires Reports read access.",
      });
    } catch (error) {
      console.error("Failed to generate sales assistant recommendation", error);
      setStatusMessage({
        tone: "error",
        text:
          error instanceof Error
            ? error.message
            : "Unable to generate follow-up suggestions.",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyFollowUp = (followUp: AiSalesAssistantFollowUp) => {
    const text = followUp.subject
      ? `${followUp.subject}\n\n${followUp.body}`
      : followUp.body;
    copy(text);
  };

  const statusClasses =
    statusMessage?.tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
      : statusMessage?.tone === "error"
        ? "border-red-200 bg-red-50 text-red-700"
        : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales Assistant"
        subtitle="Select a live CRM contact, review a rules-based readiness score, and copy a follow-up. Direct sending is not supported here."
        icon={MessageSquare}
        iconColor="text-[#315F5C]"
        iconBg="bg-[rgba(96,180,175,0.1)]"
      />

      {generationPermissionMessage && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {generationPermissionMessage}
        </div>
      )}

      {contactsError && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {contactsError}
        </div>
      )}

      {statusMessage && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${statusClasses}`}>
          {statusMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Input Panel */}
        <div className="space-y-4">
          <Card>
            <h2 className="font-semibold mb-4" style={{ color: "#151F21" }}>
              Generate Follow-up
            </h2>
            <div className="space-y-4">
              <FormField
                label="CRM contact"
                value={fields.contactId}
                onChange={(value) => {
                  updateField("contactId")(value);
                  const contact = contacts.find((item) => item.id === value);
                  updateField("treatment")(
                    contact?.treatmentInterests[0] || "",
                  );
                }}
                type="select"
                options={[
                  {
                    value: "",
                    label: isContactsLoading
                      ? "Loading contacts..."
                      : contactsError
                        ? "Contacts unavailable"
                        : contacts.length
                          ? "Select a CRM contact"
                          : "No CRM contacts available",
                  },
                  ...contacts.map((contact) => ({
                    value: contact.id,
                    label: `${contact.name}${contact.email ? ` · ${contact.email}` : contact.phone ? ` · ${contact.phone}` : ""}`,
                  })),
                ]}
              />
              {selectedContact && (
                <div className="rounded-xl border border-[#E5E7EB] bg-[#FAF9F7] p-3 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-[#151F21]">
                        {selectedContact.name}
                      </p>
                      <p className="text-xs text-[#5E6E70]">
                        {selectedContact.status} ·{" "}
                        {selectedContact.source || "source not recorded"}
                      </p>
                    </div>
                    <Link
                      href={`/app/crm/contacts/detail?id=${encodeURIComponent(selectedContact.id)}`}
                      className="text-xs font-semibold text-[#315F5C] hover:underline"
                    >
                      Open contact
                    </Link>
                  </div>
                </div>
              )}
              <FormField
                label="Service/package override (optional)"
                value={fields.treatment}
                onChange={updateField("treatment")}
                placeholder="Uses the contact's first service or package interest by default"
              />
              <FormField
                label="Context (optional)"
                value={fields.context}
                onChange={updateField("context")}
                type="textarea"
                rows={3}
                placeholder="e.g. Had consultation last week, asked about pricing..."
              />
            </div>
            <button
              type="button"
              onClick={handleRun}
              disabled={!canGenerate || isGenerating}
              title={generationPermissionMessage || undefined}
              className="w-full mt-4 bg-[#9A5524] text-white font-medium py-3 rounded-xl flex items-center justify-center gap-2 transition-colors hover:bg-[#151F21] disabled:opacity-50"
              style={{
                border: "1px solid rgba(154,85,36, 0.25)",
              }}
            >
              <Send className="w-4 h-4" />
              {isGenerating ? "Generating..." : "Generate Follow-up"}
            </button>
          </Card>

          {/* Cold Leads */}
          <Card>
            <h3
              className="font-semibold mb-3 flex items-center gap-2"
              style={{ color: "#151F21" }}
            >
              <AlertTriangle className="w-4 h-4 text-[#9A5524]" /> Follow-up
              friction
            </h3>
            {output ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm" style={{ color: "#5E6E70" }}>
                    Rules score
                  </span>
                  <span className="text-2xl font-semibold text-[#151F21]">
                    {frictionScore} / 100
                  </span>
                </div>
                <span
                  className={[
                    "inline-flex rounded-full border px-2 py-1 text-xs font-medium",
                    output.scores.urgency === "high"
                      ? "border-red-200 bg-red-50 text-red-700"
                      : output.scores.urgency === "medium"
                        ? "border-amber-200 bg-amber-50 text-amber-700"
                        : "border-emerald-200 bg-emerald-50 text-emerald-700",
                  ].join(" ")}
                >
                  {output.scores.urgency} follow-up priority
                </span>
                <div className="space-y-2">
                  {output.scores.reasons.slice(0, 4).map((reason) => (
                    <p key={reason} className="text-sm" style={{ color: "#5E6E70" }}>
                      {reason}
                    </p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
                Select a CRM contact and generate suggestions to see the
                deterministic friction score. It is not a calibrated lead
                quality or conversion prediction.
              </p>
            )}
          </Card>
        </div>

        {/* Output Panel */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold" style={{ color: "#151F21" }}>
                Follow-up suggestions
              </h2>
              {primaryFollowUp && (
                <button
                  type="button"
                  aria-label="Copy recommendation to clipboard"
                  onClick={() => copyFollowUp(primaryFollowUp)}
                  className="p-2 rounded-lg transition-colors hover:bg-[#FAF9F7]"
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-[#315F5C]" />
                  ) : (
                    <Copy className="w-4 h-4 text-[#5E6E70]" />
                  )}
                </button>
              )}
            </div>
            {isHistoryLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 rounded-xl bg-[rgba(96,180,175,0.08)] animate-pulse"
                  />
                ))}
              </div>
            ) : output ? (
              <div className="space-y-5">
                <AiGenerationProvenance
                  provenance={coerceAiRunProvenance(selectedRun)}
                  generatedAt={selectedRun?.createdAt}
                />
                {output.lead.contactId && (
                  <Link
                    href={`/app/crm/contacts/detail?id=${encodeURIComponent(output.lead.contactId)}`}
                    className="inline-flex items-center gap-2 rounded-xl border border-[rgba(96,180,175,0.2)] bg-[rgba(96,180,175,0.08)] px-3 py-2 text-sm font-semibold text-[#315F5C]"
                  >
                    <UserRound className="h-4 w-4" />
                    Linked to {output.lead.name}
                  </Link>
                )}
                <p className="text-sm leading-relaxed" style={{ color: "#151F21" }}>
                  {output.summary}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {output.followUps.map((followUp) => (
                    <div
                      key={followUp.channel}
                      className="rounded-xl border border-[#E5E7EB] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase text-[#5E6E70]">
                          {followUp.channel}
                        </span>
                        <button
                          type="button"
                          onClick={() => copyFollowUp(followUp)}
                          className="rounded-lg p-1.5 hover:bg-[#FAF9F7]"
                          aria-label={`Copy ${followUp.channel} follow-up`}
                        >
                          <Copy className="w-4 h-4 text-[#5E6E70]" />
                        </button>
                      </div>
                      {followUp.subject && (
                        <p className="mb-2 text-sm font-medium text-[#151F21]">
                          {followUp.subject}
                        </p>
                      )}
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#5E6E70]">
                        {followUp.body}
                      </p>
                    </div>
                  ))}
                </div>
                {output.unavailableActions.length > 0 && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
                    {output.unavailableActions[0].reason}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16" style={{ color: "#5E6E70" }}>
                <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p>No saved follow-up suggestion is selected.</p>
              </div>
            )}
          </Card>

          {/* Readiness heuristic */}
          <Card>
            <h3
              className="font-semibold mb-4 flex items-center gap-2"
              style={{ color: "#151F21" }}
            >
              <Gauge className="w-4 h-4 text-[#4A9A95]" /> Rules-based
              readiness
            </h3>
            {output ? (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-xs text-[#5E6E70]">Readiness score</p>
                  <p className="text-2xl font-semibold text-[#151F21]">
                    {readinessScore} / 100
                  </p>
                  <p className="mt-1 text-xs text-[#5E6E70]">
                    Heuristic, not a probability
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-xs text-[#5E6E70]">Follow-up priority</p>
                  <p className="text-2xl font-semibold text-[#151F21]">
                    {priorityScore} / 100
                  </p>
                  <p className="mt-1 text-xs text-[#5E6E70]">
                    Rules-based ordering aid
                  </p>
                </div>
                <div className="rounded-xl border border-[#E5E7EB] p-3">
                  <p className="text-xs text-[#5E6E70]">Supported action</p>
                  <Link
                    href="/app/comms/inbox"
                    className="mt-1 inline-block text-left text-sm font-medium text-[#315F5C] hover:underline"
                  >
                    Open Communications to review
                  </Link>
                </div>
              </div>
            ) : (
              <p className="text-sm leading-relaxed" style={{ color: "#5E6E70" }}>
                Generate suggestions to see the rules-based readiness score and
                supported next step.
              </p>
            )}
          </Card>

          <Card>
            <h3 className="font-semibold mb-3" style={{ color: "#151F21" }}>
              Sales Assistant History
            </h3>
            {historyNotice && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
                {historyNotice}
              </div>
            )}
            {isHistoryLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-12 rounded-xl bg-[rgba(96,180,175,0.08)] animate-pulse"
                  />
                ))}
              </div>
            ) : salesRuns.length ? (
              <div className="space-y-2">
                {salesRuns.slice(0, 8).map((run) => {
                  const runOutput = getSalesAssistantOutput(run);
                  return (
                    <div
                      key={run.id}
                      className={[
                        "rounded-xl border p-3 text-sm",
                        run.id === selectedRun?.id
                          ? "border-[rgba(96,180,175,0.45)] bg-[rgba(96,180,175,0.08)]"
                          : "border-[#E5E7EB]",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedRunId(run.id)}
                        className="w-full text-left"
                      >
                        <p className="font-medium" style={{ color: "#151F21" }}>
                          {runOutput?.lead.name || run.task}
                        </p>
                        <p className="text-xs" style={{ color: "#5E6E70" }}>
                          {formatRunDate(run.createdAt)} | {run.status} |{" "}
                          {run.tokens.toLocaleString()} tokens
                        </p>
                      </button>
                      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                        <AiGenerationProvenance
                          compact
                          provenance={coerceAiRunProvenance(run)}
                          generatedAt={run.createdAt}
                        />
                        {runOutput?.lead.contactId && (
                          <Link
                            href={`/app/crm/contacts/detail?id=${encodeURIComponent(runOutput.lead.contactId)}`}
                            className="text-xs font-semibold text-[#315F5C] hover:underline"
                          >
                            Open CRM contact
                          </Link>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-center py-6" style={{ color: "#5E6E70" }}>
                No saved Sales Assistant runs found.
              </p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
