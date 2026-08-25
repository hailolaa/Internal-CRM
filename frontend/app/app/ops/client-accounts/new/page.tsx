"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  BriefcaseBusiness,
  CheckCircle2,
  Loader2,
  Plus,
  UserRound,
} from "lucide-react";
import { Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type {
  ClientAccountCreatePayload,
  ClientAccountServiceType,
  TeamMember,
} from "@/lib/api-types";

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

const emptyAccountForm: ClientAccountCreatePayload = {
  name: "",
  email: "",
  phone: "",
  website: "",
  monthlyPrice: null,
  setupFee: null,
  currency: "GBP",
  contractStartDate: null,
  noticeDate: null,
  paymentStatus: "not_started",
  invoiceStatus: "not_sent",
  paymentNotes: "",
  clientStatus: "onboarding",
  onboardingStatus: "in_progress",
  healthStatus: "attention_needed",
  contractStatus: "pending",
  churnRisk: "low",
  lastContactAt: null,
  lastReportAt: null,
  lastLoomAt: null,
  currentPackage: "",
  recommendedNextPackage: "",
  upsellOpportunity: "",
  activeServices: [],
  keyNotes: "",
};

const fieldClass =
  "w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]";

function validateAccount(form: ClientAccountCreatePayload) {
  if (!form.name.trim()) return "Client account name is required.";
  if (form.name.trim().length > 255) return "Client account name must be 255 characters or fewer.";
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Enter a valid main email address.";
  if (form.phone && form.phone.trim().length > 20) return "Phone must be 20 characters or fewer.";
  if (form.phone && !/^[\d\s+()-]+$/.test(form.phone.trim())) return "Enter a valid phone number.";
  if (form.website && form.website.trim().length > 255) return "Website must be 255 characters or fewer.";
  return "";
}

function personName(person: TeamMember) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
}

function formatMoney(value: number | null | undefined, currency = "GBP") {
  if (value === null || value === undefined) return "Not set";
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: currency || "GBP",
    maximumFractionDigits: 0,
  }).format(Number(value));
}

export default function NewClientAccountPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const canChooseAccountManager =
    session?.role === "SUPER_ADMIN" || session?.role === "ADMIN";
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [packageOptions, setPackageOptions] = useState<string[]>([]);
  const [isBespokePackage, setIsBespokePackage] = useState(false);
  const [form, setForm] = useState<ClientAccountCreatePayload>(emptyAccountForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (!token || !canChooseAccountManager) return;
    void api.team
      .getMembers(token)
      .then((members) => setTeamMembers(members.filter((member) => !member.isInvitation)))
      .catch((error) => {
        console.error("Failed to load account managers", error);
        addToast("Account managers could not be loaded.", "error");
      });
  }, [addToast, canChooseAccountManager, token]);

  useEffect(() => {
    if (!token) return;
    const timer = window.setTimeout(() => {
      void api.packages
        .list(token)
        .then((records) => setPackageOptions(records.map((record) => record.name)))
        .catch((error) => {
          console.warn("Package catalog unavailable", error);
        });
    }, 0);

    return () => window.clearTimeout(timer);
  }, [token]);

  const toggleService = (serviceType: ClientAccountServiceType) => {
    setForm((current) => {
      const currentServices = current.activeServices || [];
      return {
        ...current,
        activeServices: currentServices.includes(serviceType)
          ? currentServices.filter((service) => service !== serviceType)
          : [...currentServices, serviceType],
      };
    });
  };

  const createAccount = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || isSubmitting) return;
    const validationError = validateAccount(form);
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setIsSubmitting(true);
    setFormError("");
    try {
      await api.clientAccounts.create(token, {
        ...form,
        name: form.name.trim(),
        email: form.email?.trim() || null,
        phone: form.phone?.trim() || null,
        website: form.website?.trim() || null,
        currentPackage: form.currentPackage || null,
        monthlyPrice: form.monthlyPrice ?? null,
        setupFee: form.setupFee ?? null,
        currency: form.currency?.trim().toUpperCase() || "GBP",
        contractStartDate: form.contractStartDate || null,
        noticeDate: form.noticeDate || null,
        lastContactAt: form.lastContactAt || null,
        lastReportAt: form.lastReportAt || null,
        lastLoomAt: form.lastLoomAt || null,
        paymentNotes: form.paymentNotes || null,
        recommendedNextPackage: form.recommendedNextPackage || null,
        upsellOpportunity: form.upsellOpportunity || null,
        keyNotes: form.keyNotes || null,
      });
      addToast("Client account added.", "success");
      router.push("/app/ops/client-accounts/");
    } catch (error) {
      addToast(
        error instanceof Error ? error.message : "Could not add client account.",
        "error",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedManager = teamMembers.find(
    (member) => member.id === form.accountManagerId,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Add Client Account"
        subtitle="Create the client record first. Package and delivery details can be refined afterwards."
        icon={BriefcaseBusiness}
        iconColor="text-[#5e8a8d]"
        right={
          <Link
            href="/app/ops/client-accounts/"
            className="inline-flex items-center gap-2 rounded-full border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-4 py-2 text-sm font-semibold text-[#315f62] transition-colors hover:bg-[#eaedeb]"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to accounts
          </Link>
        }
      />

      <form onSubmit={createAccount} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          {formError && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {formError}
            </div>
          )}
          <Card padding="p-5 sm:p-6">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Client details</p>
              <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Who are you onboarding?</h2>
              <p className="mt-1 text-sm text-[#7A746A]">Start with the essentials used across delivery, tasks and reporting.</p>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Client account name *</span>
                <input
                  name="name"
                  autoComplete="organization"
                  required
                  maxLength={255}
                  aria-invalid={Boolean(formError && !form.name.trim())}
                  autoFocus
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  className={fieldClass}
                  placeholder="e.g. North Street Dental"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Main email</span>
                <input
                  name="email"
                  autoComplete="email"
                  type="email"
                  maxLength={255}
                  value={form.email || ""}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className={fieldClass}
                  placeholder="hello@client.co.uk"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Phone</span>
                <input
                  name="phone"
                  autoComplete="tel"
                  type="tel"
                  maxLength={20}
                  pattern="[0-9 +()\-]+"
                  value={form.phone || ""}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className={fieldClass}
                  placeholder="020 0000 0000"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Website</span>
                <input
                  name="website"
                  type="url"
                  maxLength={255}
                  value={form.website || ""}
                  onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                  className={fieldClass}
                  placeholder="https://client.co.uk"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Account manager</span>
                <select
                  name="accountManagerId"
                  value={form.accountManagerId || ""}
                  onChange={(event) => setForm((current) => ({ ...current, accountManagerId: event.target.value || null }))}
                  disabled={!canChooseAccountManager}
                  className={`${fieldClass} disabled:cursor-not-allowed disabled:bg-[#f1efeb] disabled:text-[#7A746A]`}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>{personName(member)}</option>
                  ))}
                </select>
                {!canChooseAccountManager ? (
                  <span className="block text-xs text-[#7A746A]">
                    The account will be unassigned. An Admin can add a manager later.
                  </span>
                ) : null}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Client stage</span>
                <select
                  name="clientStatus"
                  value={form.clientStatus || "onboarding"}
                  onChange={(event) => setForm((current) => ({ ...current, clientStatus: event.target.value as ClientAccountCreatePayload["clientStatus"] }))}
                  className={fieldClass}
                >
                  <option value="prospect">Prospect</option>
                  <option value="onboarding">Onboarding</option>
                  <option value="active">Active</option>
                  <option value="paused">Paused</option>
                  <option value="at_risk">At risk</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Current package</span>
                <select
                  name="currentPackage"
                  value={isBespokePackage ? "__bespoke__" : form.currentPackage || ""}
                  onChange={(event) => {
                    if (event.target.value === "__bespoke__") {
                      setIsBespokePackage(true);
                      setForm((current) => ({ ...current, currentPackage: "" }));
                      return;
                    }
                    setIsBespokePackage(false);
                    setForm((current) => ({ ...current, currentPackage: event.target.value }));
                  }}
                  className={fieldClass}
                >
                  <option value="">Select package</option>
                  {packageOptions.map((packageName) => (
                    <option key={packageName} value={packageName}>{packageName}</option>
                  ))}
                  <option value="__bespoke__">Bespoke / custom</option>
                </select>
                {isBespokePackage && (
                  <input
                    name="customPackage"
                    value={form.currentPackage || ""}
                    onChange={(event) => setForm((current) => ({ ...current, currentPackage: event.target.value }))}
                    className={fieldClass}
                    placeholder="Enter bespoke package name"
                  />
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Monthly price / MRR</span>
                <input
                  name="monthlyPrice"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.monthlyPrice ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, monthlyPrice: event.target.value === "" ? null : Number(event.target.value) }))}
                  className={fieldClass}
                  placeholder="1995.00"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Setup fee</span>
                <input
                  name="setupFee"
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.setupFee ?? ""}
                  onChange={(event) => setForm((current) => ({ ...current, setupFee: event.target.value === "" ? null : Number(event.target.value) }))}
                  className={fieldClass}
                  placeholder="0.00"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Currency</span>
                <input
                  name="currency"
                  value={form.currency || "GBP"}
                  maxLength={3}
                  onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value.toUpperCase() }))}
                  className={fieldClass}
                  placeholder="GBP"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Contract start date</span>
                <input name="contractStartDate" type="date" value={form.contractStartDate || ""} onChange={(event) => setForm((current) => ({ ...current, contractStartDate: event.target.value || null }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Notice date</span>
                <input name="noticeDate" type="date" value={form.noticeDate || ""} onChange={(event) => setForm((current) => ({ ...current, noticeDate: event.target.value || null }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Recommended next package</span>
                <select
                  name="recommendedNextPackage"
                  value={form.recommendedNextPackage || ""}
                  onChange={(event) => setForm((current) => ({ ...current, recommendedNextPackage: event.target.value }))}
                  className={fieldClass}
                >
                  <option value="">No recommendation yet</option>
                  {packageOptions.map((packageName) => (
                    <option key={packageName} value={packageName}>{packageName}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Upsell opportunity</span>
                <input
                  name="upsellOpportunity"
                  value={form.upsellOpportunity || ""}
                  onChange={(event) => setForm((current) => ({ ...current, upsellOpportunity: event.target.value }))}
                  className={fieldClass}
                  placeholder="e.g. Move to Clinic Growth after tracking QA"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Last contact</span>
                <input name="lastContactAt" type="date" value={form.lastContactAt || ""} onChange={(event) => setForm((current) => ({ ...current, lastContactAt: event.target.value || null }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Last report</span>
                <input name="lastReportAt" type="date" value={form.lastReportAt || ""} onChange={(event) => setForm((current) => ({ ...current, lastReportAt: event.target.value || null }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Last Loom / strategy call</span>
                <input name="lastLoomAt" type="date" value={form.lastLoomAt || ""} onChange={(event) => setForm((current) => ({ ...current, lastLoomAt: event.target.value || null }))} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Payment status</span>
                <select name="paymentStatus" value={form.paymentStatus || "not_started"} onChange={(event) => setForm((current) => ({ ...current, paymentStatus: event.target.value as ClientAccountCreatePayload["paymentStatus"] }))} className={fieldClass}>
                  <option value="not_started">Not started</option>
                  <option value="pending">Pending</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Invoice status</span>
                <select name="invoiceStatus" value={form.invoiceStatus || "not_sent"} onChange={(event) => setForm((current) => ({ ...current, invoiceStatus: event.target.value as ClientAccountCreatePayload["invoiceStatus"] }))} className={fieldClass}>
                  <option value="not_required">Not required</option>
                  <option value="not_sent">Not sent</option>
                  <option value="sent">Sent</option>
                  <option value="paid">Paid</option>
                  <option value="overdue">Overdue</option>
                  <option value="disputed">Disputed</option>
                  <option value="void">Void</option>
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Payment notes</span>
                <textarea
                  name="paymentNotes"
                  value={form.paymentNotes || ""}
                  onChange={(event) => setForm((current) => ({ ...current, paymentNotes: event.target.value }))}
                  rows={3}
                  className={fieldClass}
                  placeholder="Manual invoice/payment context for finance..."
                />
              </label>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Starting scope</p>
            <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Which services are included?</h2>
            <p className="mt-1 text-sm text-[#7A746A]">Select the known services now, or leave this empty and configure them later.</p>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {SERVICE_TYPES.map((service) => {
                const selected = (form.activeServices || []).includes(service.value);
                return (
                  <button
                    key={service.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => toggleService(service.value)}
                    className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${selected ? "border-[rgba(96,180,175,0.35)] bg-[#e4efed] text-[#315f62]" : "border-[#d8ddda] bg-white text-[#5e8a8d] hover:bg-[#f4f7f5]"}`}
                  >
                    {selected && <CheckCircle2 className="h-4 w-4" />}
                    {service.label}
                  </button>
                );
              })}
            </div>
            <label className="mt-6 block space-y-1.5">
              <span className="text-sm font-semibold text-[#344446]">Key notes</span>
              <textarea
                name="keyNotes"
                value={form.keyNotes || ""}
                onChange={(event) => setForm((current) => ({ ...current, keyNotes: event.target.value }))}
                rows={4}
                className={fieldClass}
                placeholder="Commercial context, expectations or anything delivery should know..."
              />
            </label>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden" padding="p-0">
            <div className="border-b border-[rgba(21,31,33,0.06)] bg-gradient-to-br from-[#e8f3f0] to-[#f7faf8] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#5e8a8d] shadow-sm">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e8a8d]">New account</p>
                  <h2 className="font-semibold text-[#151f21]">Client snapshot</h2>
                </div>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-[#8b9694]">Client</p>
                <p className="mt-1 text-lg font-semibold text-[#151f21]">{form.name.trim() || "Untitled client"}</p>
                <p className="mt-1 text-sm text-[#7A746A]">{form.email || form.website || "Contact details not added"}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 border-y border-[rgba(21,31,33,0.06)] py-4">
                <div>
                  <p className="text-xs text-[#8b9694]">Manager</p>
                  <p className="mt-1 text-sm font-semibold text-[#344446]">{selectedManager ? personName(selectedManager) : "Unassigned"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#8b9694]">MRR</p>
                  <p className="mt-1 text-sm font-semibold text-[#344446]">{formatMoney(form.monthlyPrice, form.currency || "GBP")}</p>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !token}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5e8a8d] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60"
              >
                {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Create client account
              </button>
              <p className="text-center text-xs leading-5 text-[#8b9694]">You can add renewals, contracts and delivery plans after creation.</p>
            </div>
          </Card>
        </aside>
      </form>
    </div>
  );
}
