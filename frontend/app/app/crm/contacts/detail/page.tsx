"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle,
  Clock,
  Edit3,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
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
import type { ContactLinkedActivity, ContactRecord } from "@/lib/api-types";

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
  const rawType = activity.type.toLowerCase();
  if (rawType.includes("appointment")) return "Sales or delivery event";
  if (rawType.includes("form")) return "Lead submission";
  if (rawType.includes("treatment")) return "Service/package update";
  const type = activity.type.replace(/_/g, " ");
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#E7E1DA] px-4 py-6 text-center text-sm text-[#6F6A66]">
      {label}
    </div>
  );
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
  const [isLoading, setIsLoading] = useState(true);
  const [activityError, setActivityError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionName, setActionName] = useState<"contacted" | "pipeline" | "convert" | "note" | "delete" | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

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
      const [contactResult, activityResult] = await Promise.allSettled([
        api.contacts.get(token, contactId),
        api.contacts.getActivity(token, contactId),
      ]);

      if (contactResult.status === "rejected") {
        throw contactResult.reason;
      }

      setContact(contactResult.value);
      setLoadError("");
      setActivity(
        activityResult.status === "fulfilled" ? activityResult.value : null,
      );
      setActivityError(
        activityResult.status === "rejected"
          ? "Related activity could not be loaded for this contact."
          : "",
      );
    } catch (error) {
      setContact(null);
      setActivity(null);
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

  const contactMethods = useMemo(
    () => [
      {
        icon: BriefcaseBusiness,
        label: "Account",
        value: contact?.accountName || "Not linked",
      },
      {
        icon: UserRound,
        label: "Role",
        value: contact?.roleTitle || "Not recorded",
      },
      { icon: Mail, label: "Email", value: contact?.email || "Not provided" },
      { icon: Phone, label: "Phone", value: contact?.phone || "Not provided" },
      { icon: Globe, label: "Website", value: contact?.website || "Not provided" },
      { icon: UserRound, label: "Source", value: contact?.source || "Unknown" },
      {
        icon: Clock,
        label: "Last contacted",
        value: formatDateTime(contact?.lastContactAt),
      },
    ],
    [contact],
  );

  const communicationPermissions = useMemo(
    () => [
      ["Email", contact?.emailPermission],
      ["Phone", contact?.phonePermission],
      ["SMS", contact?.smsPermission],
      ["WhatsApp", contact?.whatsappPermission],
    ],
    [contact],
  );

  const relatedRecordLinks = useMemo(
    () => [
      { label: "Lead list", href: "/app/leads" },
      { label: "Pipeline", href: "/app/crm/pipeline" },
      { label: "Tasks", href: `/app/crm/tasks?contactId=${encodeURIComponent(contact?.id || "")}` },
      { label: "Audits", href: "/app/ops/growth-scores" },
      { label: "Proposals", href: "/app/proposals" },
      { label: "Notes", href: `/app/crm/contacts/detail?id=${encodeURIComponent(contact?.id || "")}#notes` },
    ],
    [contact?.id],
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

    const timestamp = new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date());
    const nextNotes = [contact.notes, `[${timestamp}] ${note}`]
      .filter(Boolean)
      .join("\n\n");

    setActionName("note");
    setActionError("");
    setActionMessage("");
    try {
      await api.contacts.update(token, contact.id, { notes: nextNotes });
      setNoteDraft("");
      await loadContact();
      setActionMessage("Note added to this prospect.");
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Could not add this note.",
      );
    } finally {
      setActionName(null);
    }
  }, [canWriteContacts, contact, loadContact, noteDraft, token]);

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
        <Link href="/app/crm/contacts" className="btn-secondary inline-flex text-sm">
          <ArrowLeft className="h-4 w-4" />
          Back to contacts
        </Link>
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
          <Link href="/app/crm/contacts" className="btn-secondary p-2">
            <ArrowLeft className="h-5 w-5" />
          </Link>
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

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                ["Calls", activity?.counts.calls || 0],
                ["Linked events", activity?.counts.appointments || 0],
                ["Messages", activity?.counts.messages || 0],
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
                  <div>
                    <p className="text-sm font-semibold text-[#151f21]">
                      {labelForTimeline(item)}
                    </p>
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
            <h2 className="text-base font-semibold text-[#151f21]">Address</h2>
            <p className="mt-4 text-sm leading-relaxed text-[#6F6A66]">
              {[contact.address, contact.city, contact.state, contact.postalCode]
                .filter(Boolean)
                .join(", ") || "No address recorded."}
            </p>
          </Card>

          <div id="notes">
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
            <h2 className="text-base font-semibold text-[#151f21]">
              Communication permissions
            </h2>
            <div className="mt-4 space-y-3">
              {communicationPermissions.map(([label, value]) => (
                <div
                  key={String(label)}
                  className="flex items-center justify-between rounded-xl border border-[#E7E1DA] bg-[#FAF8F5] px-4 py-3 text-sm"
                >
                  <span className="font-medium text-[#151f21]">{label}</span>
                  <span className={value ? "text-[#16794c]" : "text-[#8A5A44]"}>
                    {value ? "Allowed" : "Not allowed"}
                  </span>
                </div>
              ))}
            </div>
          </Card>

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
