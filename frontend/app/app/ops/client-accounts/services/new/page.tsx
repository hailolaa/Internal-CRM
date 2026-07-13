"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  CircleDollarSign,
  Loader2,
  Plus,
  Wrench,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type {
  ClientAccountContractStatus,
  ClientAccountServicePayload,
  ClientAccountServiceStatus,
  ClientAccountServiceType,
  TeamMember,
} from "@/lib/api-types";

type EditableServiceStatus = Exclude<ClientAccountServiceStatus, "archived">;

const SERVICE_TYPES: Array<{ value: ClientAccountServiceType; label: string }> = [
  { value: "ppc", label: "PPC" },
  { value: "seo", label: "SEO" },
  { value: "gbp", label: "GBP" },
  { value: "website", label: "Website" },
  { value: "landing_pages", label: "Landing Pages" },
  { value: "cro", label: "CRO" },
  { value: "strategy", label: "Strategy" },
  { value: "other", label: "Other" },
];
const SERVICE_STATUSES: EditableServiceStatus[] = ["onboarding", "active", "paused", "ended"];
const CONTRACT_STATUSES: ClientAccountContractStatus[] = ["active", "trial", "pending", "paused", "cancelled", "expired"];
const todayIso = new Date().toISOString().slice(0, 10);

const emptyServiceForm: ClientAccountServicePayload = {
  serviceType: "ppc",
  name: "Google Ads Management",
  status: "onboarding",
  startDate: todayIso,
  renewalDate: "",
  endDate: "",
  ownerId: null,
  recurringValue: "",
  currency: "GBP",
  contractStatus: "pending",
  notes: "",
};

const fieldClass =
  "w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]";

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function personName(person: TeamMember) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
}

export default function NewClientServicePage() {
  const router = useRouter();
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [form, setForm] = useState<ClientAccountServicePayload>(emptyServiceForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api.team
      .getMembers(token)
      .then((members) => setTeamMembers(members.filter((member) => !member.isInvitation)))
      .catch((error) => {
        console.error("Failed to load service owners", error);
        addToast("Service owners could not be loaded.", "error");
      });
  }, [addToast, token]);

  const createService = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !form.name.trim()) return;
    setIsSubmitting(true);
    try {
      await api.clientAccounts.createService(token, {
        ...form,
        name: form.name.trim(),
        ownerId: form.ownerId || null,
        renewalDate: form.renewalDate || null,
        endDate: form.endDate || null,
        recurringValue: form.recurringValue || null,
        notes: form.notes || null,
      });
      addToast("Service plan added.", "success");
      router.push("/app/ops/client-accounts/");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Could not add service plan.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedOwner = teamMembers.find((member) => member.id === form.ownerId);
  const serviceType = SERVICE_TYPES.find((service) => service.value === form.serviceType)?.label;

  return (
    <div className="space-y-6">
      <PageHeader
        title="New Service"
        subtitle="Add the delivery, ownership and commercial details for a client service."
        icon={Wrench}
        iconColor="text-[#5e8a8d]"
        right={
          <Link href="/app/ops/client-accounts/" className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-4 py-2 text-sm font-semibold text-[#315f62] transition-colors hover:bg-[#eaedeb]">
            <ArrowLeft className="h-4 w-4" />Back to accounts
          </Link>
        }
      />

      <form onSubmit={createService} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Service details</p>
            <h2 className="mt-1 text-xl font-semibold text-[#151f21]">What are you delivering?</h2>
            <p className="mt-1 text-sm text-[#7A746A]">Name the service and set its current delivery stage.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Service name *</span>
                <input required autoFocus value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} className={fieldClass} placeholder="e.g. Google Ads Management" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Service type</span>
                <select value={form.serviceType} onChange={(event) => setForm((current) => ({ ...current, serviceType: event.target.value as ClientAccountServiceType }))} className={fieldClass}>
                  {SERVICE_TYPES.map((service) => <option key={service.value} value={service.value}>{service.label}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Delivery status</span>
                <select value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as EditableServiceStatus }))} className={fieldClass}>
                  {SERVICE_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Service owner</span>
                <select value={form.ownerId || ""} onChange={(event) => setForm((current) => ({ ...current, ownerId: event.target.value || null }))} className={fieldClass}>
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => <option key={member.id} value={member.id}>{personName(member)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Contract status</span>
                <select value={form.contractStatus} onChange={(event) => setForm((current) => ({ ...current, contractStatus: event.target.value as ClientAccountContractStatus }))} className={fieldClass}>
                  {CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                </select>
              </label>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Commercial schedule</p>
            <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Value and dates</h2>
            <p className="mt-1 text-sm text-[#7A746A]">Record recurring value and the dates that drive delivery and renewal reporting.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Monthly value</span>
                <div className="relative"><CircleDollarSign className="absolute left-3.5 top-3 h-4 w-4 text-[#8b9694]" /><input type="number" min="0" step="50" value={String(form.recurringValue ?? "")} onChange={(event) => setForm((current) => ({ ...current, recurringValue: event.target.value }))} className={`${fieldClass} pl-10`} placeholder="0" /></div>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Currency</span>
                <input value={form.currency || "GBP"} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} maxLength={3} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Start date</span>
                <input type="date" value={form.startDate || ""} onChange={(event) => setForm((current) => ({ ...current, startDate: event.target.value }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Renewal date</span>
                <input type="date" value={form.renewalDate || ""} onChange={(event) => setForm((current) => ({ ...current, renewalDate: event.target.value }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Notes</span>
                <textarea value={form.notes || ""} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} rows={5} className={fieldClass} placeholder="Scope, dependencies or delivery context..." />
              </label>
            </div>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden" padding="p-0">
            <div className="border-b border-[rgba(21,31,33,0.06)] bg-gradient-to-br from-[#e8f3f0] to-[#f7faf8] p-5">
              <div className="flex items-center gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#5e8a8d] shadow-sm"><CalendarClock className="h-5 w-5" /></div><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e8a8d]">New service</p><h2 className="font-semibold text-[#151f21]">Service snapshot</h2></div></div>
            </div>
            <div className="space-y-5 p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[#8b9694]">Service</p><p className="mt-1 text-lg font-semibold text-[#151f21]">{form.name.trim() || "Untitled service"}</p><p className="mt-1 text-sm text-[#7A746A]">{serviceType}</p></div>
              <div className="grid grid-cols-2 gap-4 border-y border-[rgba(21,31,33,0.06)] py-4">
                <div><p className="text-xs text-[#8b9694]">Owner</p><p className="mt-1 text-sm font-semibold text-[#344446]">{selectedOwner ? personName(selectedOwner) : "Unassigned"}</p></div>
                <div><p className="text-xs text-[#8b9694]">Monthly value</p><p className="mt-1 text-sm font-semibold text-[#344446]">{form.currency || "GBP"} {form.recurringValue || "0"}</p></div>
                <div><p className="text-xs text-[#8b9694]">Status</p><p className="mt-1 text-sm font-semibold text-[#344446]">{formatLabel(form.status || "onboarding")}</p></div>
                <div><p className="text-xs text-[#8b9694]">Renewal</p><p className="mt-1 text-sm font-semibold text-[#344446]">{form.renewalDate || "Not set"}</p></div>
              </div>
              <button type="submit" disabled={isSubmitting || !form.name.trim() || !token} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5e8a8d] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60">
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}Create service plan
              </button>
            </div>
          </Card>
        </aside>
      </form>
    </div>
  );
}
