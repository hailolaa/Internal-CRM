"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CalendarClock,
  CheckCircle,
  Clock,
  Edit3,
  ExternalLink,
  Gauge,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertBanner,
  Avatar,
  Card,
  SkeletonLine,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  ClientAccountContactAccountLinkRecord,
  ContactLinkedActivity,
  ContactRecord,
  AuditWorkflowStatus,
  GrowthScoreSnapshotList,
  SalesCallDemoPayload,
} from "@/lib/api-types";

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function labelForTimeline(activity: ContactLinkedActivity["timeline"][number]) {
  const metadata = activity.metadata || {};
  const changes = typeof metadata.changes === "object" && metadata.changes !== null
    ? metadata.changes as Record<string, unknown>
    : {};
  const action = typeof metadata.action === "string" ? metadata.action : "";
  const title = typeof metadata.title === "string" ? metadata.title : "";
  const channel = typeof changes.channel === "string" ? changes.channel : "";

  if (title) return title;
  if (action === "internal_note_added") return "Internal note added";
  if (action === "contact_attempt_recorded") {
    return channel ? `${formatLabel(channel)} contact attempt` : "Contact attempt recorded";
  }
  if (action.startsWith("whatsapp.")) return "WhatsApp activity";
  const rawType = activity.type.toLowerCase();
  if (rawType.includes("appointment")) return "Sales or delivery event";
  if (rawType.includes("form")) return "Lead submission";
  if (rawType.includes("treatment")) return "Service/package update";
  const type = activity.type.replace(/_/g, " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function timelineSummary(activity: ContactLinkedActivity["timeline"][number]) {
  const metadata = activity.metadata || {};
  const changes = typeof metadata.changes === "object" && metadata.changes !== null
    ? metadata.changes as Record<string, unknown>
    : {};
  const note = typeof changes.note === "string" ? changes.note : "";
  const notes = typeof changes.notes === "string" ? changes.notes : "";
  const outcome = typeof changes.outcome === "string" ? changes.outcome : "";
  const channel = typeof changes.channel === "string" ? changes.channel : "";
  const status = typeof metadata.status === "string" ? metadata.status : "";

  return [channel ? formatLabel(channel) : "", outcome || status, note || notes]
    .filter(Boolean)
    .join(" - ");
}

function isInternalTimelineItem(activity: ContactLinkedActivity["timeline"][number]) {
  const metadata = activity.metadata || {};
  const changes = typeof metadata.changes === "object" && metadata.changes !== null
    ? metadata.changes as Record<string, unknown>
    : {};
  return changes.internal === true || changes.visibility === "internal";
}

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E7E1DA] px-4 py-6 text-center text-sm text-[#6F6A66]">
      {label}
    </div>
  );
}

function DetailValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-3">
      <p className="text-xs font-medium text-[#6F6A66]">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-[#151f21]">
        {value || "Not set"}
      </p>
    </div>
  );
}

const growthScoreCategoryLabels = [
  ["websiteVisibility", "Website visibility"],
  ["seo", "SEO"],
  ["gbp", "GBP"],
  ["tracking", "Tracking"],
  ["conversion", "Conversion"],
  ["leadHandling", "Lead handling"],
  ["responseSpeed", "Response speed"],
  ["enquiryVisibility", "Enquiry visibility"],
  ["treatmentPerformance", "Treatment performance"],
  ["revenueLeakage", "Revenue leakage"],
  ["growthOpportunity", "Growth opportunity"],
] as const;

const auditWorkflowOptions: { value: AuditWorkflowStatus; label: string }[] = [
  { value: "audit_requested", label: "Audit requested" },
  { value: "audit_assigned", label: "Audit assigned" },
  { value: "audit_started", label: "Audit started" },
  { value: "audit_completed", label: "Audit completed" },
  { value: "growth_score_created", label: "Growth Score created" },
  { value: "dashboard_access_given", label: "Dashboard access given" },
  { value: "audit_sent", label: "Audit sent" },
  { value: "follow_up_due", label: "Follow-up due" },
];

const salesCallDemoTypeOptions = [
  { value: "discovery_call", label: "Discovery call" },
  { value: "demo", label: "Demo" },
  { value: "audit_review", label: "Audit review" },
  { value: "proposal_call", label: "Proposal call" },
  { value: "follow_up", label: "Follow-up" },
  { value: "other", label: "Other" },
];

function auditStatusLabel(value: AuditWorkflowStatus | null | undefined) {
  return auditWorkflowOptions.find((option) => option.value === value)?.label || "No audit status";
}

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : `${Math.round(value)} / 100`;
}

export default function ContactDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactId = searchParams.get("id") || "";
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canDeleteContacts = hasPermission("contacts:delete");
  const canWriteContacts = hasPermission("contacts:write");
  const canWriteClientAccounts = hasPermission("client_accounts:write");
  const [contact, setContact] = useState<ContactRecord | null>(null);
  const [activity, setActivity] = useState<ContactLinkedActivity | null>(null);
  const [growthScoreHistory, setGrowthScoreHistory] = useState<GrowthScoreSnapshotList | null>(null);
  const [linkedAccountLinks, setLinkedAccountLinks] = useState<ClientAccountContactAccountLinkRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionName, setActionName] = useState<"contacted" | "pipeline" | "convert" | "note" | "attempt" | "call-demo" | "audit" | "delete" | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [auditDraft, setAuditDraft] = useState({
    status: "" as AuditWorkflowStatus | "",
    assignedTo: "",
    followUpDueAt: "",
  });
  const [attemptDraft, setAttemptDraft] = useState({
    channel: "call" as "call" | "email" | "sms" | "whatsapp" | "other",
    outcome: "",
    notes: "",
  });
  const [callDemoDraft, setCallDemoDraft] = useState({
    booked: true,
    scheduledAt: "",
    type: "discovery_call",
    packageInterest: "",
    attended: false,
    noShow: false,
    rescheduled: false,
    outcome: "",
    nextStep: "",
    notes: "",
  });

  const loadContact = useCallback(async () => {
    if (!contactId) {
      setContact(null);
      setActivity(null);
      setLoadError("No contact id was provided.");
      setIsLoading(false);
      return;
    }

    if (!token) return;

    try {
      setIsLoading(true);
      const [contactResult, activityResult, historyResult] = await Promise.allSettled([
        api.contacts.get(token, contactId),
        api.contacts.getActivity(token, contactId),
        api.growthScores.listSnapshots(token, { contactId, limit: 5 }),
      ]);

      if (contactResult.status === "rejected") {
        throw contactResult.reason;
      }

      const loadedContact = contactResult.value;
      setContact(loadedContact);
      setAuditDraft({
        status: loadedContact.auditStatus || "",
        assignedTo: loadedContact.auditAssignedTo || "",
        followUpDueAt: toDateTimeLocal(loadedContact.auditFollowUpDueAt),
      });
      setCallDemoDraft((current) => ({
        ...current,
        packageInterest: current.packageInterest || loadedContact.packageInterest || loadedContact.recommendedPackage || "",
      }));
      setLoadError("");
      setActivity(
        activityResult.status === "fulfilled" ? activityResult.value : null,
      );
      setGrowthScoreHistory(
        historyResult.status === "fulfilled" ? historyResult.value : null,
      );
      setActivityError(
        activityResult.status === "rejected"
          ? "Related activity could not be loaded for this contact."
          : "",
      );
    } catch (error) {
      setContact(null);
      setActivity(null);
      setGrowthScoreHistory(null);
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unable to load this contact from the backend.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [contactId, token]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadContact();
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [loadContact]);

  useEffect(() => {
    if (!token || !contact?.id) {
      return;
    }

    let cancelled = false;
    api.clientAccounts
      .listContactLinks(token, contact.id)
      .then((links) => {
        if (cancelled) return;
        setLinkedAccountLinks(links);
      })
      .catch(() => {
        if (!cancelled) setLinkedAccountLinks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [contact?.id, token]);

  const visibleLinkedAccountLinks = useMemo(
    () => (contact?.id ? linkedAccountLinks : []),
    [contact?.id, linkedAccountLinks],
  );

  const contactMethods = useMemo(
    () => [
      {
        icon: BriefcaseBusiness,
        label: "Account",
        value: visibleLinkedAccountLinks.length > 1
          ? `${visibleLinkedAccountLinks.length} linked companies`
          : visibleLinkedAccountLinks[0]?.clientName || contact?.accountName || "Not linked",
      },
      {
        icon: UserRound,
        label: "Role",
        value: contact?.roleTitle || "Not recorded",
      },
      { icon: Mail, label: "Email", value: contact?.email || "Not provided" },
      { icon: Phone, label: "Phone", value: contact?.phone || "Not provided" },
      { icon: ExternalLink, label: "Website", value: contact?.website || "Not provided" },
      { icon: UserRound, label: "Source", value: contact?.source || "Unknown" },
      {
        icon: Clock,
        label: "Last contacted",
        value: formatDateTime(contact?.lastContactAt),
      },
    ],
    [contact, visibleLinkedAccountLinks],
  );

  const relatedRecordLinks = useMemo(
    () => [
      { label: "Lead list", href: "/app/leads" },
      { label: "Pipeline", href: "/app/crm/pipeline" },
      { label: "Tasks", href: `/app/crm/tasks?contactId=${encodeURIComponent(contact?.id || "")}` },
      { label: "Audits", href: "/app/ops/growth-scores" },
      { label: "Proposals", href: `/app/crm/proposals/edit?contactId=${encodeURIComponent(contact?.id || "")}&accountName=${encodeURIComponent(contact?.accountName || contact?.name || "")}&packageName=${encodeURIComponent(contact?.recommendedPackage || contact?.packageInterest || contact?.treatmentInterests?.[0] || "")}` },
      { label: "Notes", href: `/app/crm/contacts/detail?id=${encodeURIComponent(contact?.id || "")}#contact-notes` },
    ],
    [
      contact?.accountName,
      contact?.id,
      contact?.name,
      contact?.packageInterest,
      contact?.recommendedPackage,
      contact?.treatmentInterests,
    ],
  );

  const handleMarkContacted = useCallback(async () => {
    if (!token || !contact || !canWriteContacts) return;

    setActionName("contacted");
    setActionError("");
    setActionMessage("");
    try {
      await api.contacts.markContacted(token, contact.id);
      await loadContact();
      setActionMessage(`${contact.name} marked as contacted.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not mark contact as contacted.",
      );
    } finally {
      setActionName(null);
    }
  }, [canWriteContacts, contact, loadContact, token]);

  const handleAddToPipeline = useCallback(async () => {
    if (!token || !contact || !canWriteContacts) return;

    setActionName("pipeline");
    setActionError("");
    setActionMessage("");
    try {
      await api.pipelineDeals.create(token, {
        contactId: contact.id,
        title: `${contact.name} opportunity`,
        valueCents: Math.round((contact.value || 0) * 100),
        source: contact.source,
        treatment: contact.treatmentInterests[0] || null,
      });
      setActionMessage(`${contact.name} added to pipeline.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not add contact to pipeline.",
      );
    } finally {
      setActionName(null);
    }
  }, [canWriteContacts, contact, token]);

  const handleConvertToClient = useCallback(async () => {
    if (!token || !contact || !canWriteClientAccounts) return;

    const accountName = window.prompt(
      "Client account name",
      contact.name,
    );
    if (accountName === null) return;
    const trimmedAccountName = accountName.trim();
    if (!trimmedAccountName) {
      setActionError("Client account name is required.");
      return;
    }

    setActionName("convert");
    setActionError("");
    setActionMessage("");
    try {
      const account = await api.clientAccounts.createFromContact(token, {
        contactId: contact.id,
        accountName: trimmedAccountName,
        clientStatus: "onboarding",
        onboardingStatus: "in_progress",
        healthStatus: "attention_needed",
        contractStatus: "pending",
      });
      await loadContact();
      setActionMessage(`${contact.name} converted to client account: ${account.clinicName}.`);
      router.push("/app/ops/client-accounts");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not convert prospect to client account.",
      );
    } finally {
      setActionName(null);
    }
  }, [canWriteClientAccounts, contact, loadContact, router, token]);

  const handleAddNote = useCallback(async () => {
    if (!token || !contact || !canWriteContacts) return;

    const note = noteDraft.trim();
    if (!note) {
      setActionError("Write a note before saving.");
      return;
    }

    setActionName("note");
    setActionError("");
    setActionMessage("");
    try {
      const result = await api.contacts.addNote(token, contact.id, { note });
      const nextNotes = typeof result.record?.notes === "string" ? result.record.notes : contact.notes;
      setActivity(result.activity);
      setContact((current) => current ? { ...current, notes: nextNotes } : current);
      setNoteDraft("");
      setActionMessage("Internal note added to this prospect.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not add this note.",
      );
    } finally {
      setActionName(null);
    }
  }, [canWriteContacts, contact, noteDraft, token]);

  const handleSaveAuditWorkflow = useCallback(async () => {
    if (!token || !contact || !canWriteContacts) return;

    setActionName("audit");
    setActionError("");
    setActionMessage("");
    try {
      const updatedContact = await api.contacts.update(token, contact.id, {
        auditStatus: auditDraft.status || null,
        auditAssignedTo: auditDraft.assignedTo.trim() || null,
        auditFollowUpDueAt: auditDraft.followUpDueAt
          ? new Date(auditDraft.followUpDueAt).toISOString()
          : null,
      });
      setContact(updatedContact);
      const nextActivity = await api.contacts.getActivity(token, contact.id);
      setActivity(nextActivity);
      setActionMessage("Audit workflow updated.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not update the audit workflow.",
      );
    } finally {
      setActionName(null);
    }
  }, [auditDraft, canWriteContacts, contact, token]);

  const handleRecordContactAttempt = useCallback(async () => {
    if (!token || !contact || !canWriteContacts) return;

    const hasOutcome = attemptDraft.outcome.trim().length > 0;
    const hasNotes = attemptDraft.notes.trim().length > 0;
    if (!hasOutcome && !hasNotes) {
      setActionError("Add an outcome or short note for this contact attempt.");
      return;
    }

    setActionName("attempt");
    setActionError("");
    setActionMessage("");
    try {
      const result = await api.contacts.recordContactAttempt(token, contact.id, {
        channel: attemptDraft.channel,
        outcome: attemptDraft.outcome.trim() || null,
        notes: attemptDraft.notes.trim() || null,
      });
      setActivity(result.activity);
      const attemptedAt = typeof result.record?.attemptedAt === "string"
        ? result.record.attemptedAt
        : new Date().toISOString();
      setContact((current) => current ? { ...current, lastContactAt: attemptedAt } : current);
      setAttemptDraft({ channel: "call", outcome: "", notes: "" });
      setActionMessage("Contact attempt recorded.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not record this contact attempt.",
      );
    } finally {
      setActionName(null);
    }
  }, [attemptDraft, canWriteContacts, contact, token]);

  const handleRecordSalesCallDemo = useCallback(async () => {
    if (!token || !contact || !canWriteContacts) return;

    const hasStatus = callDemoDraft.attended || callDemoDraft.noShow || callDemoDraft.rescheduled;
    const hasDetails = [
      callDemoDraft.scheduledAt,
      callDemoDraft.outcome,
      callDemoDraft.nextStep,
      callDemoDraft.notes,
    ].some((value) => value.trim().length > 0);
    if (!callDemoDraft.booked && !hasStatus && !hasDetails) {
      setActionError("Add a booking date, status, outcome, next step, or note.");
      return;
    }

    const payload: SalesCallDemoPayload = {
      booked: callDemoDraft.booked,
      scheduledAt: callDemoDraft.scheduledAt
        ? new Date(callDemoDraft.scheduledAt).toISOString()
        : null,
      type: callDemoDraft.type,
      packageInterest: callDemoDraft.packageInterest.trim() || null,
      attended: callDemoDraft.noShow ? false : callDemoDraft.attended,
      noShow: callDemoDraft.noShow,
      rescheduled: callDemoDraft.rescheduled,
      outcome: callDemoDraft.outcome.trim() || null,
      nextStep: callDemoDraft.nextStep.trim() || (
        callDemoDraft.noShow ? "Follow up and reschedule the call/demo" : null
      ),
      notes: callDemoDraft.notes.trim() || null,
    };

    setActionName("call-demo");
    setActionError("");
    setActionMessage("");
    try {
      const result = await api.contacts.recordSalesCallDemo(token, contact.id, payload);
      setActivity(result.activity);
      if (payload.attended || payload.noShow || payload.outcome || payload.notes) {
        setContact((current) => current ? {
          ...current,
          lastContactAt: new Date().toISOString(),
        } : current);
      }
      setCallDemoDraft({
        booked: true,
        scheduledAt: "",
        type: "discovery_call",
        packageInterest: contact.packageInterest || contact.recommendedPackage || "",
        attended: false,
        noShow: false,
        rescheduled: false,
        outcome: "",
        nextStep: "",
        notes: "",
      });
      setActionMessage("Call/demo details recorded.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not record this call/demo.",
      );
    } finally {
      setActionName(null);
    }
  }, [callDemoDraft, canWriteContacts, contact, token]);

  const handleDelete = useCallback(async () => {
    if (!token || !contact || !canDeleteContacts) return;
    const confirmed = window.confirm(
      `Delete ${contact.name}? This will remove the contact from active lists.`,
    );
    if (!confirmed) return;

    setActionName("delete");
    setActionError("");
    setActionMessage("");
    try {
      await api.contacts.remove(token, contact.id);
      router.push("/app/crm/contacts");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not delete contact.",
      );
      setActionName(null);
    }
  }, [canDeleteContacts, contact, router, token]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonLine className="h-10 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card className="lg:col-span-2" padding="p-6">
            <SkeletonLine className="h-8 w-48 mb-4" />
            <SkeletonLine className="h-4 w-full mb-2" />
            <SkeletonLine className="h-4 w-2/3" />
          </Card>
          <Card padding="p-6">
            <SkeletonLine className="h-8 w-32 mb-4" />
            <SkeletonLine className="h-4 w-full mb-2" />
            <SkeletonLine className="h-4 w-3/4" />
          </Card>
        </div>
      </div>
    );
  }

  if (loadError || !contact) {
    return (
      <div className="space-y-6">
        <button type="button" onClick={() => router.back()} className="btn-secondary inline-flex text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
        <AlertBanner
          title="Contact could not be loaded"
          description={loadError || "The backend did not return this contact."}
          variant="warning"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex items-start gap-4">
          <button type="button" onClick={() => router.back()} aria-label="Back" className="btn-secondary p-2">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <Avatar name={contact.name} size="lg" />
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl font-bold text-[#111111]">
                {contact.name}
              </h1>
              <StatusBadge status={contact.status} />
            </div>
            <p className="mt-1 text-sm text-[#6F6A66]">
              Created {formatDateTime(contact.createdAt)} - Updated{" "}
              {formatDateTime(contact.updatedAt)}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/app/crm/contacts/edit?id=${contact.id}`}
            className={`btn-secondary text-sm ${canWriteContacts ? "" : "pointer-events-none opacity-50"}`}
            aria-disabled={!canWriteContacts}
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </Link>
          <button
            onClick={handleMarkContacted}
            disabled={!canWriteContacts || actionName === "contacted"}
            className="btn-secondary text-sm disabled:opacity-60"
          >
            {actionName === "contacted" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            Mark Contacted
          </button>
          <button
            onClick={handleAddToPipeline}
            disabled={!canWriteContacts || actionName === "pipeline"}
            className="btn-secondary text-sm disabled:opacity-60"
          >
            {actionName === "pipeline" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
            Add to Pipeline
          </button>
          <button
            onClick={handleConvertToClient}
            disabled={!canWriteClientAccounts || actionName === "convert"}
            className="btn-secondary text-sm disabled:opacity-60"
          >
            {actionName === "convert" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <BriefcaseBusiness className="h-4 w-4" />
            )}
            Convert to Client
          </button>
          <button
            onClick={handleDelete}
            disabled={!canDeleteContacts || actionName === "delete"}
            className="btn-secondary text-sm text-[#9a5524] disabled:opacity-60"
          >
            {actionName === "delete" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </button>
        </div>
      </div>

      {actionMessage && (
        <AlertBanner icon={CheckCircle} title={actionMessage} variant="success" />
      )}
      {actionError && (
        <AlertBanner
          title="Contact action failed"
          description={actionError}
          variant="warning"
        />
      )}
      {activityError && (
        <AlertBanner
          title="Some related records could not be loaded"
          description={activityError}
          variant="info"
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">
              Contact details
            </h2>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {contactMethods.map((item) => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"
                  >
                    <div className="flex items-center gap-2 text-xs font-medium text-[#6F6A66]">
                      <Icon className="h-4 w-4" />
                      {item.label}
                    </div>
                    <p className="mt-2 text-sm font-semibold text-[#151f21]">
                      {item.value}
                    </p>
                  </div>
                );
              })}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#151f21]">Companies</h2>
                <p className="mt-1 text-sm text-[#6F6A66]">Client companies linked to this person.</p>
              </div>
              <span className="rounded-full bg-[#edf5f3] px-2.5 py-1 text-xs font-semibold text-[#315f62]">
                {visibleLinkedAccountLinks.length}
              </span>
            </div>
            {visibleLinkedAccountLinks.length > 0 ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {visibleLinkedAccountLinks.map((accountLink) => (
                  <Link
                    key={accountLink.relationId}
                    href={`/app/ops/client-accounts/detail?id=${encodeURIComponent(accountLink.clientClinicId)}`}
                    className="flex min-w-0 items-center justify-between gap-3 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-semibold text-[#315f62] transition hover:border-[#a9c7c4] hover:bg-[#edf5f3] focus:outline-none focus:ring-2 focus:ring-[#75aaa7]"
                  >
                    <span className="min-w-0 break-words">{accountLink.clientName}</span>
                    <ExternalLink className="h-4 w-4 shrink-0" />
                  </Link>
                ))}
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState label="No client companies are linked to this person." />
              </div>
            )}
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">
              Related records
            </h2>
            <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-3">
              {relatedRecordLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center justify-between rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-medium text-[#151f21] transition hover:border-[#6E6AE8]/30 hover:text-[#6E6AE8]"
                >
                  {item.label}
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              ))}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#151f21]">
                Related activity
              </h2>
              <span className="text-xs text-[#6F6A66]">
                {activity?.counts.timeline || 0} timeline events
              </span>
            </div>

            <div className="mt-5 grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                ["Calls", activity?.counts.calls || 0],
                ["Demos", activity?.counts.salesCallDemos || 0],
                ["Linked events", activity?.counts.appointments || 0],
                ["Messages", activity?.counts.messages || 0],
                ["Tasks", activity?.counts.tasks || 0],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"
                >
                  <p className="text-2xl font-bold text-[#151f21]">{value}</p>
                  <p className="text-xs text-[#6F6A66]">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 space-y-3">
              {(activity?.timeline || []).slice(0, 8).map((item) => (
                <div
                  key={item.id}
                  className="flex items-start gap-3 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4"
                >
                  <Clock className="mt-0.5 h-4 w-4 text-[#6E6AE8]" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#151f21]">
                        {labelForTimeline(item)}
                      </p>
                      {isInternalTimelineItem(item) ? (
                        <span className="rounded-full bg-[#edf5f3] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#315f62]">
                          Internal
                        </span>
                      ) : null}
                    </div>
                    {timelineSummary(item) ? (
                      <p className="mt-1 line-clamp-2 text-sm text-[#6F6A66]">
                        {timelineSummary(item)}
                      </p>
                    ) : null}
                    <p className="text-xs text-[#6F6A66]">
                      {formatDateTime(item.timestamp || item.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
              {(!activity || activity.timeline.length === 0) && (
                <EmptyState label="No backend timeline activity found yet." />
              )}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Related records</h2>
            <p className="mt-1 text-sm text-[#6F6A66]">Open the records connected to this contact across Mission Control.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {[
                ["Lead", `/app/leads?contactId=${contact.id}`],
                ["Deals", `/app/crm/pipeline?contactId=${contact.id}`],
                ["Notes", "#contact-notes"],
                ["Tasks", `/app/crm/tasks?contactId=${contact.id}`],
                ["Audits", `/app/admin?entityId=${contact.id}`],
                ["Proposals", `/app/crm/proposals/edit?contactId=${contact.id}&accountName=${encodeURIComponent(contact.accountName || contact.name)}&packageName=${encodeURIComponent(contact.recommendedPackage || contact.packageInterest || contact.treatmentInterests[0] || "")}`],
              ].map(([label, href]) => (
                <Link key={label} href={href} className="flex items-center justify-between rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-semibold text-[#315f62] transition hover:border-[#a9c7c4] hover:bg-[#edf5f3]">
                  {label}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card padding="p-5 sm:p-6">
              <h2 className="mb-4 text-base font-semibold text-[#151f21]">
                Calls
              </h2>
              <div className="space-y-3">
                {(activity?.calls || []).slice(0, 5).map((call) => (
                  <div key={call.id} className="rounded-xl bg-[#FAF8F5] p-4">
                    <p className="text-sm font-semibold text-[#151f21]">
                      {call.outcome || call.disposition || call.status || "Call"}
                    </p>
                    <p className="text-xs text-[#6F6A66]">
                      {call.direction || "Unknown direction"} -{" "}
                      {formatDateTime(call.startedAt || call.createdAt)}
                    </p>
                  </div>
                ))}
                {(!activity || activity.calls.length === 0) && (
                  <EmptyState label="No linked calls found." />
                )}
              </div>
            </Card>

            <Card padding="p-5 sm:p-6">
              <h2 className="mb-4 flex items-center gap-2 text-base font-semibold text-[#151f21]">
                <CalendarClock className="h-4 w-4 text-[#6E6AE8]" />
                Demos & booked calls
              </h2>
              <div className="space-y-3">
                {(activity?.salesCallDemos || []).slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    id={`call-demo-${item.id}`}
                    className="rounded-xl bg-[#FAF8F5] p-4"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#151f21]">
                        {formatLabel(item.type)}
                      </p>
                      <StatusBadge
                        status={
                          item.noShow
                            ? "No-show"
                            : item.rescheduled
                              ? "Rescheduled"
                              : item.attended
                                ? "Attended"
                                : item.booked
                                  ? "Booked"
                                  : "Logged"
                        }
                      />
                    </div>
                    <p className="mt-1 text-xs text-[#6F6A66]">
                      {formatDateTime(item.scheduledAt || item.createdAt)}
                      {item.packageInterest ? ` - ${item.packageInterest}` : ""}
                    </p>
                    {item.outcome ? (
                      <p className="mt-2 text-sm text-[#6F6A66]">{item.outcome}</p>
                    ) : null}
                    {item.nextStep ? (
                      <p className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#315f62]">
                        Next step: {item.nextStep}
                      </p>
                    ) : item.noShow ? (
                      <p className="mt-2 rounded-lg bg-[#fff7f0] px-3 py-2 text-xs font-semibold text-[#8a3f16]">
                        Suggested next step: follow up and reschedule.
                      </p>
                    ) : null}
                  </div>
                ))}
                {(!activity || activity.salesCallDemos.length === 0) && (
                  <EmptyState label="No demos or booked calls recorded." />
                )}
              </div>
            </Card>

            <Card padding="p-5 sm:p-6">
              <h2 className="mb-4 text-base font-semibold text-[#151f21]">
                Linked sales/delivery events
              </h2>
              <div className="space-y-3">
                {(activity?.appointments || []).slice(0, 5).map((appointment) => (
                  <div
                    key={appointment.id}
                    className="rounded-xl bg-[#FAF8F5] p-4"
                  >
                    <p className="text-sm font-semibold text-[#151f21]">
                      {appointment.treatment || "Sales or delivery event"}
                    </p>
                    <p className="text-xs text-[#6F6A66]">
                      {appointment.status} - {formatDateTime(appointment.dateTime)}
                    </p>
                  </div>
                ))}
                {(!activity || activity.appointments.length === 0) && (
                  <EmptyState label="No linked sales or delivery events found." />
                )}
              </div>
            </Card>
          </div>
        </div>

        <div className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">
              Opportunity
            </h2>
            <p className="mt-4 text-3xl font-bold text-[#6E6AE8]">
              {formatMoney(contact.value)}
            </p>
            <p className="mt-1 text-xs text-[#6F6A66]">
              Estimated opportunity value
            </p>
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Tags</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {(contact.tags || []).map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-[#E7E1DA] bg-[#FAF8F5] px-3 py-1 text-xs font-medium text-[#6F6A66]"
                >
                  {tag}
                </span>
              ))}
              {contact.tags.length === 0 && (
                <p className="text-sm text-[#6F6A66]">No tags set.</p>
              )}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">
              Service / package interests
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Package interest</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">
                  {contact.packageInterest || "Not set"}
                </p>
              </div>
              <div className="rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-4">
                <p className="text-xs font-medium text-[#6F6A66]">Recommended next package</p>
                <p className="mt-2 text-sm font-semibold text-[#151f21]">
                  {contact.recommendedPackage || "Not set"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(contact.treatmentInterests || []).map((interest) => (
                <span
                  key={interest}
                  className="rounded-full border border-[#E7E1DA] bg-[#FAF8F5] px-3 py-1 text-xs font-medium text-[#6F6A66]"
                >
                  {interest}
                </span>
              ))}
              {contact.treatmentInterests.length === 0 && (
                <p className="text-sm text-[#6F6A66]">
                  No service or package interests set.
                </p>
              )}
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Attribution</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue label="First source" value={contact.firstSource || contact.source} />
              <DetailValue label="Latest source" value={contact.latestSource} />
              <DetailValue label="Converting source" value={contact.convertingSource} />
              <DetailValue label="UTM campaign" value={contact.utmCampaign} />
              <DetailValue label="UTM source" value={contact.utmSource} />
              <DetailValue label="UTM medium" value={contact.utmMedium} />
              <DetailValue label="Landing page" value={contact.landingPage} />
              <DetailValue label="Referrer" value={contact.referrer} />
              <DetailValue label="Form submitted" value={contact.formSubmitted} />
              <DetailValue label="CTA clicked" value={contact.ctaClicked} />
              <DetailValue label="Google click ID" value={contact.gclid} />
              <DetailValue label="Meta click ID" value={contact.fbclid} />
              <DetailValue label="Microsoft click ID" value={contact.msclkid} />
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-base font-semibold text-[#151f21]">Free audit workflow</h2>
                <p className="mt-1 text-sm text-[#6F6A66]">
                  Track the Clinic Growth Score audit journey for this prospect.
                </p>
              </div>
              <span className="rounded-full border border-[#E7E1DA] bg-[#FAF8F5] px-3 py-1 text-xs font-semibold text-[#6F6A66]">
                {auditStatusLabel(contact.auditStatus)}
              </span>
            </div>
            <div className="mt-4 grid gap-3">
              <label className="text-xs font-semibold text-[#6F6A66]">
                Audit status
                <select
                  value={auditDraft.status}
                  onChange={(event) => setAuditDraft((current) => ({
                    ...current,
                    status: event.target.value as AuditWorkflowStatus | "",
                  }))}
                  disabled={!canWriteContacts || actionName === "audit"}
                  className="mt-1 w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-normal text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                >
                  <option value="">No audit status</option>
                  {auditWorkflowOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-[#6F6A66]">
                Assigned owner
                <input
                  value={auditDraft.assignedTo}
                  onChange={(event) => setAuditDraft((current) => ({
                    ...current,
                    assignedTo: event.target.value,
                  }))}
                  disabled={!canWriteContacts || actionName === "audit"}
                  placeholder="Team member responsible for the audit"
                  className="mt-1 w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-normal text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                />
              </label>
              <label className="text-xs font-semibold text-[#6F6A66]">
                Follow-up due
                <input
                  type="datetime-local"
                  value={auditDraft.followUpDueAt}
                  onChange={(event) => setAuditDraft((current) => ({
                    ...current,
                    followUpDueAt: event.target.value,
                  }))}
                  disabled={!canWriteContacts || actionName === "audit"}
                  className="mt-1 w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-normal text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                />
              </label>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue label="Last audit update" value={contact.auditStatusUpdatedAt ? formatDateTime(contact.auditStatusUpdatedAt) : null} />
              <DetailValue label="Audit follow-up due" value={contact.auditFollowUpDueAt ? formatDateTime(contact.auditFollowUpDueAt) : null} />
            </div>
            <button
              type="button"
              onClick={handleSaveAuditWorkflow}
              disabled={!canWriteContacts || actionName === "audit"}
              className="btn-primary mt-5 text-sm disabled:opacity-60"
            >
              {actionName === "audit" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="h-4 w-4" />
              )}
              Save Audit Workflow
            </button>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-base font-semibold text-[#151f21]">
                  <Gauge className="h-4 w-4 text-[#6E6AE8]" />
                  Clinic Growth Score
                </h2>
                <p className="mt-1 text-sm text-[#6F6A66]">
                  Structured audit score and package recommendation.
                </p>
              </div>
              <span className="rounded-full bg-[#edf5f3] px-3 py-1 text-sm font-bold text-[#315f62]">
                {formatScore(contact.growthScoreOverall)}
              </span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailValue label="Recommended package" value={contact.growthScoreRecommendedPackage || contact.recommendedPackage} />
              <DetailValue label="Last scored" value={contact.growthScoreUpdatedAt ? formatDateTime(contact.growthScoreUpdatedAt) : null} />
            </div>
            {contact.growthScoreGapSummary ? (
              <p className="mt-4 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] p-3 text-sm leading-relaxed text-[#6F6A66]">
                {contact.growthScoreGapSummary}
              </p>
            ) : null}
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {growthScoreCategoryLabels.map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6F6A66]">
                  <span>{label}</span>
                  <span className="font-semibold text-[#151f21]">{formatScore(contact.growthScoreCategories[key])}</span>
                </div>
              ))}
            </div>
            {growthScoreHistory?.previous.length ? (
              <div className="mt-5 border-t border-[#E7E1DA] pt-4">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#6F6A66]">
                  Previous scores
                </p>
                <div className="mt-3 space-y-2">
                  {growthScoreHistory.previous.slice(0, 4).map((snapshot) => (
                    <div key={snapshot.id} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6F6A66]">
                      <span>{new Date(snapshot.scoredAt).toLocaleDateString()}</span>
                      <span className="font-semibold text-[#151f21]">{formatScore(snapshot.overallScore)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Card>

          <Card padding="p-5 sm:p-6">
            <h2 className="text-base font-semibold text-[#151f21]">Address</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#6F6A66]">
              {[contact.address, contact.city, contact.state, contact.postalCode]
                .filter(Boolean)
                .join(", ") || "No address recorded."}
            </p>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="flex items-center gap-2 text-base font-semibold text-[#151f21]">
                <CalendarClock className="h-4 w-4 text-[#6E6AE8]" />
                Demo / call tracking
              </h2>
              <span className="text-xs text-[#6F6A66]">Manual sales activity</span>
            </div>
            <div className="mt-5 space-y-3">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-semibold text-[#6F6A66]">
                  Type
                  <select
                    value={callDemoDraft.type}
                    onChange={(event) => setCallDemoDraft((current) => ({
                      ...current,
                      type: event.target.value,
                    }))}
                    disabled={!canWriteContacts || actionName === "call-demo"}
                    className="mt-1 w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-normal text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                  >
                    {salesCallDemoTypeOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-[#6F6A66]">
                  Date / time
                  <input
                    type="datetime-local"
                    value={callDemoDraft.scheduledAt}
                    onChange={(event) => setCallDemoDraft((current) => ({
                      ...current,
                      scheduledAt: event.target.value,
                    }))}
                    disabled={!canWriteContacts || actionName === "call-demo"}
                    className="mt-1 w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm font-normal text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                  />
                </label>
              </div>
              <input
                value={callDemoDraft.packageInterest}
                onChange={(event) => setCallDemoDraft((current) => ({
                  ...current,
                  packageInterest: event.target.value,
                }))}
                disabled={!canWriteContacts || actionName === "call-demo"}
                className="w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Package interest"
              />
              <div className="grid grid-cols-2 gap-2">
                {([
                  ["booked", "Booked"],
                  ["attended", "Attended"],
                  ["noShow", "No-show"],
                  ["rescheduled", "Rescheduled"],
                ] as const).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center gap-2 rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-3 py-2.5 text-sm font-medium text-[#151f21]"
                  >
                    <input
                      type="checkbox"
                      checked={Boolean(callDemoDraft[key as keyof typeof callDemoDraft])}
                      onChange={(event) => setCallDemoDraft((current) => {
                        const next = {
                          ...current,
                          [key]: event.target.checked,
                        };
                        if (key === "noShow" && event.target.checked) {
                          next.attended = false;
                          next.nextStep = next.nextStep || "Follow up and reschedule the call/demo";
                        }
                        if (key === "attended" && event.target.checked) {
                          next.noShow = false;
                        }
                        return next;
                      })}
                      disabled={!canWriteContacts || actionName === "call-demo"}
                      className="h-4 w-4 rounded border-[#D8D1C8]"
                    />
                    {label}
                  </label>
                ))}
              </div>
              <input
                value={callDemoDraft.outcome}
                onChange={(event) => setCallDemoDraft((current) => ({ ...current, outcome: event.target.value }))}
                disabled={!canWriteContacts || actionName === "call-demo"}
                className="w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Outcome, e.g. showed up, no-show, wants proposal"
              />
              <input
                value={callDemoDraft.nextStep}
                onChange={(event) => setCallDemoDraft((current) => ({ ...current, nextStep: event.target.value }))}
                disabled={!canWriteContacts || actionName === "call-demo"}
                className="w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Next step"
              />
              <textarea
                value={callDemoDraft.notes}
                onChange={(event) => setCallDemoDraft((current) => ({ ...current, notes: event.target.value }))}
                disabled={!canWriteContacts || actionName === "call-demo"}
                rows={3}
                className="w-full resize-none rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Internal notes from the call/demo..."
              />
              <button
                type="button"
                onClick={handleRecordSalesCallDemo}
                disabled={!canWriteContacts || actionName === "call-demo"}
                className="btn-primary text-sm disabled:opacity-60"
              >
                {actionName === "call-demo" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CalendarClock className="h-4 w-4" />
                )}
                Save Call/Demo
              </button>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#151f21]">Contact attempt</h2>
              <span className="text-xs text-[#6F6A66]">Internal history</span>
            </div>
            <div className="mt-5 space-y-3">
              <select
                value={attemptDraft.channel}
                onChange={(event) => setAttemptDraft((current) => ({
                  ...current,
                  channel: event.target.value as typeof attemptDraft.channel,
                }))}
                disabled={!canWriteContacts || actionName === "attempt"}
                className="w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
              >
                <option value="call">Call</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="sms">SMS</option>
                <option value="other">Other</option>
              </select>
              <input
                value={attemptDraft.outcome}
                onChange={(event) => setAttemptDraft((current) => ({ ...current, outcome: event.target.value }))}
                disabled={!canWriteContacts || actionName === "attempt"}
                className="w-full rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Outcome, e.g. no answer, discovery booked, asked for proposal"
              />
              <textarea
                value={attemptDraft.notes}
                onChange={(event) => setAttemptDraft((current) => ({ ...current, notes: event.target.value }))}
                disabled={!canWriteContacts || actionName === "attempt"}
                rows={3}
                className="w-full resize-none rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Internal context from this attempt..."
              />
              <button
                onClick={handleRecordContactAttempt}
                disabled={!canWriteContacts || actionName === "attempt" || (!attemptDraft.outcome.trim() && !attemptDraft.notes.trim())}
                className="btn-secondary text-sm disabled:opacity-60"
              >
                {actionName === "attempt" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                Record Attempt
              </button>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#151f21]">Contact permissions</h2>
              {(contact.doNotContact || contact.unsubscribed) ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-[#fff2e5] px-2.5 py-1 text-xs font-semibold text-[#9a5524]">
                  <ShieldAlert className="h-3.5 w-3.5" />
                  Review before contact
                </span>
              ) : null}
            </div>
            {contact.doNotContact ? (
              <div className="mt-4 rounded-xl border border-[#f2c6ac] bg-[#fff7f0] p-3 text-sm font-semibold text-[#8a3f16]">
                Do not contact this record unless an admin confirms permission has changed.
              </div>
            ) : null}
            <div className="mt-4 grid grid-cols-2 gap-2">
              {Object.entries(contact.communicationPermissions).map(([channel, allowed]) => (
                <div key={channel} className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm capitalize text-[#6F6A66]">
                  {channel}
                  <StatusBadge status={allowed ? "Allowed" : "Not allowed"} />
                </div>
              ))}
              <div className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6F6A66]">
                Unsubscribed
                <StatusBadge status={contact.unsubscribed ? "Yes" : "No"} />
              </div>
              <div className="flex items-center justify-between rounded-xl bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#6F6A66]">
                Do not contact
                <StatusBadge status={contact.doNotContact ? "Yes" : "No"} />
              </div>
            </div>
            <div className="mt-4 grid gap-3">
              <DetailValue label="Permission source" value={contact.permissionSource} />
              <DetailValue label="Opt-in timestamp" value={contact.optInAt ? formatDateTime(contact.optInAt) : null} />
              <DetailValue label="Opt-out timestamp" value={contact.optOutAt ? formatDateTime(contact.optOutAt) : null} />
              <DetailValue label="Last consent update" value={contact.consentUpdatedAt ? formatDateTime(contact.consentUpdatedAt) : null} />
            </div>
          </Card>

          <div id="contact-notes">
          <Card padding="p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold text-[#151f21]">Notes</h2>
              <span className="text-xs text-[#6F6A66]">
                Internal prospect notes
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#6F6A66]">
              {contact.notes || "No notes recorded."}
            </p>
            <div className="mt-5 space-y-3">
              <textarea
                value={noteDraft}
                onChange={(event) => setNoteDraft(event.target.value)}
                disabled={!canWriteContacts || actionName === "note"}
                rows={4}
                className="w-full resize-none rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm text-[#151f21] outline-none transition focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/10 disabled:opacity-60"
                placeholder="Add a sales follow-up note, context from a call, objection, next step, or handoff detail..."
              />
              <button
                onClick={handleAddNote}
                disabled={!canWriteContacts || actionName === "note" || !noteDraft.trim()}
                className="btn-primary text-sm disabled:opacity-60"
              >
                {actionName === "note" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MessageSquare className="h-4 w-4" />
                )}
                Add Note
              </button>
            </div>
          </Card>
          </div>

          <Card padding="p-5 sm:p-6">
            <h2 className="mb-4 text-base font-semibold text-[#151f21]">
              Linked messages
            </h2>
            <div className="space-y-3">
              {(activity?.messages || []).slice(0, 3).map((message) => (
                <div key={message.id} className="flex items-start gap-3">
                  <MessageSquare className="mt-0.5 h-4 w-4 text-[#6E6AE8]" />
                  <div>
                    <p className="text-sm font-medium text-[#151f21]">
                      {message.subject || message.preview}
                    </p>
                    <p className="text-xs text-[#6F6A66]">
                      {message.channel.toUpperCase()} -{" "}
                      {formatDateTime(message.timestamp)}
                    </p>
                  </div>
                </div>
              ))}
              {(!activity || activity.messages.length === 0) && (
                <EmptyState label="No linked messages found." />
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
