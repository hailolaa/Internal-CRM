"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  Check,
  ClipboardCheck,
  Link2,
  Loader2,
  Save,
  Users,
} from "lucide-react";
import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type {
  ClientAccountServiceRecord,
  ClientAccountServiceType,
  ClientAccountSummaryRecord,
  ContactRecord,
  InternalTaskPriority,
} from "@/lib/api-types";

const priorities: Array<{
  id: InternalTaskPriority;
  name: string;
  description: string;
  dot: string;
}> = [
  { id: "high", name: "High", description: "Needs attention now", dot: "bg-[#dc5f52]" },
  { id: "medium", name: "Medium", description: "Normal delivery work", dot: "bg-[#d49a3a]" },
  { id: "low", name: "Low", description: "Can wait if needed", dot: "bg-[#6f8588]" },
];

const categories = [
  "Sales Handoff",
  "Onboarding",
  "Website Build",
  "SEO",
  "Ads",
  "Tracking",
  "Reporting",
  "Client Success",
  "Fix",
  "Admin",
];

const serviceTypes: Array<{ value: ClientAccountServiceType; label: string }> = [
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO" },
  { value: "ppc", label: "Paid ads" },
  { value: "gbp", label: "Google Business Profile" },
  { value: "landing_pages", label: "Landing pages" },
  { value: "cro", label: "Conversion optimisation" },
  { value: "strategy", label: "Strategy" },
  { value: "other", label: "Other" },
];

const boardOptions = [
  { value: "delivery", label: "Delivery" },
  { value: "operations", label: "Operations" },
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO" },
  { value: "ppc", label: "Paid ads" },
  { value: "strategy", label: "Strategy" },
];

const assigneeOptions = [
  "Me",
  "Sales Team",
  "Website Team",
  "SEO Team",
  "Ads Team",
  "Client Success",
];

const cardClass =
  "rounded-[22px] border border-[rgba(21,31,33,0.08)] bg-[#fffdfa] shadow-[0_12px_36px_rgba(30,42,44,0.04)]";
const fieldClass =
  "w-full rounded-xl border border-[#d9dfdc] bg-white px-3.5 py-2.5 text-sm text-[#172123] outline-none transition focus:border-[#5e8a8d] focus:ring-4 focus:ring-[rgba(94,138,141,0.10)] disabled:cursor-not-allowed disabled:bg-[#f2f4f2] disabled:text-[#879294]";

function serviceTypeLabel(value: ClientAccountServiceType) {
  return serviceTypes.find((option) => option.value === value)?.label || value;
}

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedClientAccountProfileId = searchParams.get("clientAccountProfileId");
  const { session } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [priority, setPriority] = useState<InternalTaskPriority>("medium");
  const [category, setCategory] = useState("Sales Handoff");
  const [boardKey, setBoardKey] = useState("delivery");
  const [serviceType, setServiceType] = useState<ClientAccountServiceType>("website");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedClientAccount, setSelectedClientAccount] = useState<string | null>(
    requestedClientAccountProfileId,
  );
  const [selectedService, setSelectedService] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    dueDate: "",
    dueTime: "",
    assignedTo: "Me",
    proofReference: "",
    workflowMonth: "",
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingLinks, setIsLoadingLinks] = useState(true);
  const [linkLoadWarning, setLinkLoadWarning] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadTaskLinks() {
      setIsLoadingLinks(true);
      const [contactsResult, accountsResult, servicesResult] = await Promise.allSettled([
        api.contacts.list(session!.token, { pageSize: 100 }),
        api.clientAccounts.list(session!.token),
        api.clientAccounts.listServices(session!.token, {
          includeArchived: false,
          includeAllClinics: true,
        }),
      ]);

      if (cancelled) return;

      setContacts(contactsResult.status === "fulfilled" ? contactsResult.value.contacts : []);
      setClientAccounts(accountsResult.status === "fulfilled" ? accountsResult.value : []);
      setServices(servicesResult.status === "fulfilled" ? servicesResult.value : []);
      setLinkLoadWarning(
        [contactsResult, accountsResult, servicesResult].some((result) => result.status === "rejected")
          ? "Some related records could not be loaded. You can still create an unlinked task."
          : null,
      );
      setIsLoadingLinks(false);
    }

    void loadTaskLinks();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const selectedAccountRecord = selectedClientAccount
    ? clientAccounts.find((account) => account.id === selectedClientAccount)
    : undefined;
  const selectedServiceRecord = services.find((service) => service.id === selectedService);
  const selectedContactRecord = contacts.find((contact) => contact.id === selectedContact);
  const filteredServices = services.filter(
    (service) => service.clientAccountProfileId === selectedClientAccount,
  );
  const selectedPriority = priorities.find((option) => option.id === priority)!;

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!session?.token || !form.title.trim()) {
      setStatusMessage("Add a clear task title before saving.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const resolvedClientAccountId =
      selectedServiceRecord?.clientAccountProfileId || selectedClientAccount;
    const resolvedServiceType = selectedServiceRecord?.serviceType || serviceType;
    const due = [form.dueDate, form.dueTime].filter(Boolean).join(" ");

    try {
      await api.internalTasks.create(session.token, {
        title: form.title.trim(),
        description: form.description.trim() || null,
        priority,
        boardKey,
        serviceType: resolvedServiceType,
        category,
        contactId: selectedContact,
        contact: selectedContactRecord?.name || null,
        due: due || null,
        dueDate: form.dueDate || null,
        assignedTo: form.assignedTo,
        clientAccountProfileId: resolvedClientAccountId || null,
        clientAccountServiceId: selectedService || null,
        proofReference: form.proofReference.trim() || null,
        workflowMonth: form.workflowMonth ? `${form.workflowMonth}-01` : null,
      });
      router.push(resolvedClientAccountId ? `/app/crm/tasks?clientAccountProfileId=${resolvedClientAccountId}` : "/app/crm/tasks");
    } catch (error) {
      console.error("Failed to create internal task", error);
      setStatusMessage(
        error instanceof Error ? error.message : "Could not save this delivery task.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="mx-auto max-w-[1380px] space-y-6 pb-12">
      <header className="flex flex-col gap-4 rounded-[24px] border border-[#dce4e1] bg-[linear-gradient(135deg,#fffdfa_0%,#f2f7f5_100%)] px-5 py-5 shadow-[0_16px_48px_rgba(41,66,68,0.06)] sm:flex-row sm:items-center sm:justify-between sm:px-7">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back to tasks"
            className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#d9dfdc] bg-white text-[#526365] transition hover:-translate-x-0.5 hover:border-[#9db4b3] hover:text-[#315f62] focus:outline-none focus:ring-4 focus:ring-[rgba(94,138,141,0.12)]"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">
              Internal delivery
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-[-0.025em] text-[#172123] sm:text-[30px]">
              Create a delivery task
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-[#607073]">
              Capture the outcome first, then add only the client context your team needs.
            </p>
          </div>
        </div>
        <button
          type="submit"
          disabled={isSaving || !form.title.trim()}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315f62] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_20px_rgba(49,95,98,0.20)] transition hover:bg-[#284f52] focus:outline-none focus:ring-4 focus:ring-[rgba(49,95,98,0.18)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {isSaving ? "Creating task…" : "Create task"}
        </button>
      </header>

      {(statusMessage || linkLoadWarning) && (
        <div
          aria-live="polite"
          className={`flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm ${
            statusMessage
              ? "border-[#e6b9ad] bg-[#fff4f0] text-[#8c3f34]"
              : "border-[#ead4a2] bg-[#fff9e9] text-[#765a1f]"
          }`}
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{statusMessage || linkLoadWarning}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <main className="space-y-6">
          <section className={`${cardClass} p-5 sm:p-7`}>
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#315f62] text-sm font-semibold text-white">
                1
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#172123]">Task brief</h2>
                <p className="mt-0.5 text-sm text-[#6a787a]">
                  Describe the result someone should deliver.
                </p>
              </div>
            </div>

            <div className="space-y-5">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Task title</span>
                <input
                  required
                  autoFocus
                  type="text"
                  name="title"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="e.g. Publish the July SEO performance report"
                  className={`${fieldClass} text-base`}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">
                  Notes and acceptance criteria
                </span>
                <textarea
                  rows={5}
                  name="description"
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="What needs to be done, what good looks like, and any blockers or links…"
                  className={`${fieldClass} resize-y leading-6`}
                />
              </label>

              <div className="grid gap-4 md:grid-cols-3">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Board</span>
                  <select
                    name="boardKey"
                    value={boardKey}
                    onChange={(event) => setBoardKey(event.target.value)}
                    className={fieldClass}
                  >
                    {boardOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Work type</span>
                  <select
                    name="serviceType"
                    value={serviceType}
                    onChange={(event) =>
                      setServiceType(event.target.value as ClientAccountServiceType)
                    }
                    disabled={Boolean(selectedServiceRecord)}
                    className={fieldClass}
                  >
                    {serviceTypes.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Category</span>
                  <select
                    name="category"
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                    className={fieldClass}
                  >
                    {categories.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <fieldset>
                <legend className="mb-2 text-sm font-medium text-[#2c393b]">Priority</legend>
                <div className="grid gap-2 sm:grid-cols-3">
                  {priorities.map((option) => {
                    const active = priority === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setPriority(option.id)}
                        className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition focus:outline-none focus:ring-4 focus:ring-[rgba(94,138,141,0.10)] ${
                          active
                            ? "border-[#6f999b] bg-[#eef6f4] shadow-[inset_0_0_0_1px_rgba(49,95,98,0.10)]"
                            : "border-[#dfe4e2] bg-white hover:border-[#b8c9c7]"
                        }`}
                      >
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${option.dot}`} />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-[#263335]">{option.name}</span>
                          <span className="block truncate text-xs text-[#718083]">{option.description}</span>
                        </span>
                        {active && <Check className="ml-auto h-4 w-4 shrink-0 text-[#315f62]" />}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </section>

          <section className={`${cardClass} p-5 sm:p-7`}>
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#5e8a8d] text-sm font-semibold text-white">
                2
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#172123]">Related records</h2>
                <p className="mt-0.5 text-sm text-[#6a787a]">
                  Link the client account first. Everything else is optional.
                </p>
              </div>
            </div>

            {isLoadingLinks ? (
              <div className="flex items-center gap-2 rounded-xl border border-dashed border-[#cfd9d6] bg-[#f7faf8] px-4 py-6 text-sm text-[#607073]">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading client records…
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2">
                <label className="block md:col-span-2">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#2c393b]">
                    <BriefcaseBusiness className="h-4 w-4 text-[#5e8a8d]" /> Client account
                    <span className="rounded-full bg-[#edf4f2] px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#4c7477]">
                      Recommended
                    </span>
                  </span>
                  <select
                    name="clientAccountProfileId"
                    value={selectedClientAccount || ""}
                    onChange={(event) => {
                      setSelectedClientAccount(event.target.value || null);
                      setSelectedService(null);
                    }}
                    className={fieldClass}
                  >
                    <option value="">No client account — general internal task</option>
                    {[...clientAccounts]
                      .filter((account) => account.id)
                      .sort((left, right) => left.clinicName.localeCompare(right.clinicName))
                      .map((account) => (
                        <option key={account.id!} value={account.id!}>
                          {account.clinicName}
                        </option>
                      ))}
                  </select>
                  <span className="mt-1.5 block text-xs leading-5 text-[#748184]">
                    The task remains on your internal board even when the client account belongs to another workspace.
                  </span>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#2c393b]">
                    <Link2 className="h-4 w-4 text-[#5e8a8d]" /> Specific client service
                  </span>
                  <select
                    name="clientAccountServiceId"
                    value={selectedService || ""}
                    disabled={!selectedClientAccount || filteredServices.length === 0}
                    onChange={(event) => {
                      const serviceId = event.target.value || null;
                      const service = services.find((item) => item.id === serviceId);
                      setSelectedService(serviceId);
                      if (service) setServiceType(service.serviceType);
                    }}
                    className={fieldClass}
                  >
                    <option value="">
                      {!selectedClientAccount
                        ? "Choose a client account first"
                        : filteredServices.length === 0
                          ? "No active services for this account"
                          : "No specific service"}
                    </option>
                    {filteredServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name} · {serviceTypeLabel(service.serviceType)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-1.5 flex items-center gap-2 text-sm font-medium text-[#2c393b]">
                    <Users className="h-4 w-4 text-[#5e8a8d]" /> Prospect or contact
                    <span className="text-xs font-normal text-[#7c898b]">Optional</span>
                  </span>
                  <select
                    name="contactId"
                    value={selectedContact || ""}
                    onChange={(event) => setSelectedContact(event.target.value || null)}
                    className={fieldClass}
                  >
                    <option value="">No prospect or contact</option>
                    {[...contacts]
                      .sort((left, right) => left.name.localeCompare(right.name))
                      .map((contact) => (
                        <option key={contact.id} value={contact.id}>
                          {contact.name}
                        </option>
                      ))}
                  </select>
                </label>
              </div>
            )}
          </section>

          <section className={`${cardClass} p-5 sm:p-7`}>
            <div className="mb-6 flex items-start gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#7a8f90] text-sm font-semibold text-white">
                3
              </span>
              <div>
                <h2 className="text-lg font-semibold text-[#172123]">Schedule and ownership</h2>
                <p className="mt-0.5 text-sm text-[#6a787a]">
                  Set a realistic deadline and tell the team who owns the next move.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Assign to</span>
                <select
                  name="assignedTo"
                  value={form.assignedTo}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, assignedTo: event.target.value }))
                  }
                  className={fieldClass}
                >
                  {assigneeOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Workflow month</span>
                <input
                  type="month"
                  name="workflowMonth"
                  value={form.workflowMonth}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, workflowMonth: event.target.value }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Due date</span>
                <input
                  type="date"
                  name="dueDate"
                  value={form.dueDate}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dueDate: event.target.value }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">Due time</span>
                <input
                  type="time"
                  name="dueTime"
                  value={form.dueTime}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, dueTime: event.target.value }))
                  }
                  className={fieldClass}
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1.5 block text-sm font-medium text-[#2c393b]">
                  Proof, brief, or working document
                </span>
                <input
                  type="url"
                  name="proofReference"
                  value={form.proofReference}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, proofReference: event.target.value }))
                  }
                  placeholder="https://…"
                  className={fieldClass}
                />
                <span className="mt-1.5 block text-xs text-[#748184]">
                  Add a Drive folder, report, brief, or source asset if one already exists.
                </span>
              </label>
            </div>
          </section>
        </main>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <div className="overflow-hidden rounded-[22px] border border-[#cfdad6] bg-[#fffdfa] text-[#172123] shadow-[0_18px_50px_rgba(41,66,68,0.10)]">
            <div className="border-b border-[#dfe7e4] bg-[linear-gradient(135deg,#f7faf8_0%,#edf5f2_100%)] px-5 py-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#4f7779]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#dcebe7] text-[#315f62]">
                    <ClipboardCheck className="h-4 w-4" />
                  </span>
                  Task snapshot
                </div>
                <span className="rounded-full border border-[#cbded9] bg-white/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#5e8a8d]">
                  Live
                </span>
              </div>
              <p className="mt-4 line-clamp-3 text-lg font-semibold leading-7 text-[#203033]">
                {form.title.trim() || "Your task title will appear here"}
              </p>
            </div>

            <dl className="space-y-4 px-5 py-5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#728083]">Client</dt>
                <dd className="max-w-[190px] text-right font-medium text-[#263537]">
                  {selectedAccountRecord?.clinicName || "General internal"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#728083]">Service</dt>
                <dd className="max-w-[190px] text-right font-medium text-[#263537]">
                  {selectedServiceRecord?.name || serviceTypeLabel(serviceType)}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#728083]">Priority</dt>
                <dd className="flex items-center gap-2 font-medium text-[#263537]">
                  <span className={`h-2 w-2 rounded-full ${selectedPriority.dot}`} />
                  {selectedPriority.name}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-[#728083]">Owner</dt>
                <dd className="font-medium text-[#263537]">{form.assignedTo}</dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="flex items-center gap-1.5 text-[#728083]">
                  <CalendarDays className="h-3.5 w-3.5" /> Due
                </dt>
                <dd className="font-medium text-[#263537]">{form.dueDate || "Not scheduled"}</dd>
              </div>
            </dl>

            <div className="border-t border-[#dfe7e4] bg-[#f6f8f6] p-5">
              <button
                type="submit"
                disabled={isSaving || !form.title.trim()}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#315f62] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_8px_18px_rgba(49,95,98,0.18)] transition hover:bg-[#284f52] focus:outline-none focus:ring-4 focus:ring-[rgba(49,95,98,0.16)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {isSaving ? "Creating task…" : "Create delivery task"}
              </button>
              <p className="mt-3 text-center text-xs leading-5 text-[#748184]">
                The task will be added to the {boardOptions.find((option) => option.value === boardKey)?.label} board.
              </p>
            </div>
          </div>
        </aside>
      </div>
    </form>
  );
}
