"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Save,
  CheckSquare,
  BriefcaseBusiness,
  Link2,
} from "lucide-react";
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
  color: string;
}> = [
  { id: "high", name: "High", color: "bg-red-500" },
  { id: "medium", name: "Medium", color: "bg-amber-500" },
  { id: "low", name: "Low", color: "bg-[#6B7280]" },
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
  { value: "ppc", label: "Ads" },
  { value: "gbp", label: "GBP" },
  { value: "landing_pages", label: "Landing Pages" },
  { value: "cro", label: "CRO" },
  { value: "strategy", label: "Strategy" },
  { value: "other", label: "Other" },
];

const boardOptions = [
  { value: "delivery", label: "Delivery" },
  { value: "operations", label: "Operations" },
  { value: "website", label: "Website" },
  { value: "seo", label: "SEO" },
  { value: "ppc", label: "Ads" },
  { value: "strategy", label: "Strategy" },
];

export default function NewTaskPage() {
  const router = useRouter();
  const { session } = useAuth();
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [clientAccounts, setClientAccounts] = useState<ClientAccountSummaryRecord[]>([]);
  const [services, setServices] = useState<ClientAccountServiceRecord[]>([]);
  const [priority, setPriority] = useState<InternalTaskPriority>("medium");
  const [category, setCategory] = useState("Sales Handoff");
  const [boardKey, setBoardKey] = useState("delivery");
  const [serviceType, setServiceType] = useState<ClientAccountServiceType>("website");
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedClientAccount, setSelectedClientAccount] = useState<string | null>(null);
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

  useEffect(() => {
    if (!session?.token) return;

    let cancelled = false;

    async function loadTaskLinks() {
      try {
        const [contactsResult, accountsResult, servicesResult] =
          await Promise.allSettled([
            api.contacts.list(session!.token, { pageSize: 25 }),
            api.clientAccounts.list(session!.token),
            api.clientAccounts.listServices(session!.token, {
              includeArchived: false,
            }),
          ]);

        if (cancelled) return;
        setContacts(
          contactsResult.status === "fulfilled"
            ? contactsResult.value.contacts
            : [],
        );
        setClientAccounts(
          accountsResult.status === "fulfilled" ? accountsResult.value : [],
        );
        setServices(
          servicesResult.status === "fulfilled" ? servicesResult.value : [],
        );
      } catch (error) {
        console.error("Failed to load internal task link options", error);
      }
    }

    loadTaskLinks();

    return () => {
      cancelled = true;
    };
  }, [session]);

  const filteredServices = services.filter((service) => {
    if (!selectedClientAccount) return true;
    return service.clientAccountProfileId === selectedClientAccount;
  });

  const handleSave = async () => {
    if (!session?.token || !form.title.trim()) {
      setStatusMessage("Add a task title before saving.");
      return;
    }

    setIsSaving(true);
    setStatusMessage(null);

    const selectedContactName =
      contacts.find((contact) => contact.id === selectedContact)?.name ?? null;
    const selectedServiceRecord =
      services.find((service) => service.id === selectedService) ?? null;
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
        contact: selectedContactName,
        due: due || null,
        dueDate: form.dueDate || null,
        assignedTo: form.assignedTo,
        clientAccountProfileId: resolvedClientAccountId || null,
        clientAccountServiceId: selectedService || null,
        proofReference: form.proofReference.trim() || null,
        workflowMonth: form.workflowMonth || null,
      });
      router.push("/app/crm/tasks");
    } catch (error) {
      console.error("Failed to create internal task", error);
      setStatusMessage("Could not save internal delivery task.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/app/crm/tasks"
          className="p-2 rounded-[14px] hover:bg-[rgba(110,106,232,0.08)]"
          style={{
            backgroundColor: "#FFFCF9",
            border: "1px solid rgba(0,0,0,0.06)",
          }}
        >
          <ArrowLeft className="w-5 h-5 text-[#6B7280]" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-[#111111]">
            Create Internal Task
          </h1>
          <p className="text-[#6B7280] text-sm">
            Add delivery work and link it to a prospect or client account
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-[14px] flex items-center gap-2 transition-colors"
          style={{ boxShadow: "0 2px 8px rgba(110,106,232,0.25)" }}
        >
          <Save className="w-4 h-4" />{" "}
          {isSaving ? "Saving..." : "Save Internal Task"}
        </button>
      </div>

      {statusMessage && (
        <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
          {statusMessage}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Task Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Task Title *
                </label>
                <input
                  type="text"
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Build tracking checklist for new website client"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                />
              </div>
              <div>
                <label className="block text-sm text-[#6B7280] mb-1.5">
                  Description
                </label>
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="Add internal hand-off notes, blockers, links, or acceptance criteria..."
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-3 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] resize-none transition-all"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Due Date
                  </label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueDate: event.target.value,
                      }))
                    }
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm text-[#6B7280] mb-1.5">
                    Due Time
                  </label>
                  <input
                    type="time"
                    value={form.dueTime}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        dueTime: event.target.value,
                      }))
                    }
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">
              Link to Prospect
            </h2>
            <div className="space-y-2">
              {contacts.map((contact) => (
                <button
                  key={contact.id}
                  onClick={() => setSelectedContact(contact.id)}
                  className={`w-full p-3 bg-[#FAF8F5] border rounded-[14px] flex items-center gap-3 hover:border-[rgba(110,106,232,0.3)] transition-all text-left ${
                    selectedContact === contact.id
                      ? "border-[rgba(110,106,232,0.45)]"
                      : "border-[rgba(0,0,0,0.06)]"
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-[rgba(110,106,232,0.12)] flex items-center justify-center text-xs font-medium text-[#6E6AE8]">
                    {contact.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")}
                  </div>
                  <span className="text-sm text-[#111111]">
                    {contact.name}
                  </span>
                </button>
              ))}
              {contacts.length === 0 && (
                <div className="rounded-[14px] border border-dashed border-[rgba(0,0,0,0.10)] p-4 text-sm text-[#6B7280]">
                  No prospects are available to link yet.
                </div>
              )}
              {selectedContact && (
                <button
                  onClick={() => setSelectedContact(null)}
                  className="text-sm text-[#6E6AE8] hover:text-[#5A56D4]"
                >
                  Clear prospect link
                </button>
              )}
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">
              Link to Client Account
            </h2>
            <div className="space-y-4">
              <label className="block">
                <span className="block text-sm text-[#6B7280] mb-1.5">
                  Client Account
                </span>
                <div className="relative">
                  <BriefcaseBusiness className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <select
                    value={selectedClientAccount || ""}
                    onChange={(event) => {
                      setSelectedClientAccount(event.target.value || null);
                      setSelectedService(null);
                    }}
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] pl-10 pr-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                  >
                    <option value="">No client account</option>
                    {clientAccounts
                      .filter((account) => account.id)
                      .map((account) => (
                        <option key={account.id!} value={account.id!}>
                          {account.clinicName}
                        </option>
                      ))}
                  </select>
                </div>
              </label>
              <label className="block">
                <span className="block text-sm text-[#6B7280] mb-1.5">
                  Client Service
                </span>
                <div className="relative">
                  <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
                  <select
                    value={selectedService || ""}
                    onChange={(event) => {
                      const serviceId = event.target.value || null;
                      const service = services.find((item) => item.id === serviceId);
                      setSelectedService(serviceId);
                      if (service) {
                        setSelectedClientAccount(service.clientAccountProfileId);
                        setServiceType(service.serviceType);
                      }
                    }}
                    className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] pl-10 pr-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                  >
                    <option value="">No specific service</option>
                    {filteredServices.map((service) => (
                      <option key={service.id} value={service.id}>
                        {service.name}
                      </option>
                    ))}
                  </select>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-1 space-y-6">
          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Priority</h2>
            <div className="space-y-2">
              {priorities.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPriority(p.id)}
                  className={`w-full p-3 rounded-[14px] flex items-center gap-3 transition-all ${priority === p.id ? "bg-[rgba(110,106,232,0.06)] border border-[rgba(110,106,232,0.2)]" : "bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] hover:border-[rgba(0,0,0,0.12)]"}`}
                >
                  <div className={`w-3 h-3 rounded-full ${p.color}`} />
                  <span className="text-sm text-[#111111]">{p.name}</span>
                  {priority === p.id && (
                    <CheckSquare className="w-4 h-4 text-[#6E6AE8] ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Work Type</h2>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm text-[#6B7280] mb-1.5">
                  Board
                </span>
                <select
                  value={boardKey}
                  onChange={(event) => setBoardKey(event.target.value)}
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                >
                  {boardOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="block text-sm text-[#6B7280] mb-1.5">
                  Service Type
                </span>
                <select
                  value={serviceType}
                  onChange={(event) =>
                    setServiceType(event.target.value as ClientAccountServiceType)
                  }
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                >
                  {serviceTypes.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Category</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1.5 bg-[#FAF8F5] border rounded-full text-sm text-[#111111] hover:border-[rgba(110,106,232,0.3)] transition-all ${
                    category === cat
                      ? "border-[rgba(110,106,232,0.45)]"
                      : "border-[rgba(0,0,0,0.06)]"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">Assign To</h2>
            <select
              value={form.assignedTo}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  assignedTo: event.target.value,
                }))
              }
              className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
            >
              <option>Me</option>
              <option>Sales Team</option>
              <option>Website Team</option>
              <option>SEO Team</option>
              <option>Ads Team</option>
              <option>Client Success</option>
            </select>
          </div>

          <div
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-[24px] p-6"
            style={{ boxShadow: "0 1px 6px rgba(0,0,0,0.03)" }}
          >
            <h2 className="font-semibold text-[#111111] mb-4">
              Delivery Metadata
            </h2>
            <div className="space-y-3">
              <label className="block">
                <span className="block text-sm text-[#6B7280] mb-1.5">
                  Proof or Work Link
                </span>
                <input
                  type="text"
                  value={form.proofReference}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      proofReference: event.target.value,
                    }))
                  }
                  placeholder="Report, Drive folder, ClickUp task, or client asset link"
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                />
              </label>
              <label className="block">
                <span className="block text-sm text-[#6B7280] mb-1.5">
                  Workflow Month
                </span>
                <input
                  type="date"
                  value={form.workflowMonth}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      workflowMonth: event.target.value,
                    }))
                  }
                  className="w-full bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-[14px] px-4 py-2.5 text-sm text-[#111111] focus:outline-none focus:border-[rgba(110,106,232,0.4)] focus:ring-2 focus:ring-[rgba(110,106,232,0.08)] transition-all"
                />
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
