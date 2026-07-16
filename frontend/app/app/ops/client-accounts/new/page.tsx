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
  clientStatus: "onboarding",
  onboardingStatus: "in_progress",
  healthStatus: "attention_needed",
  contractStatus: "pending",
  churnRisk: "low",
  currentPackage: "",
  recommendedNextPackage: "",
  upsellOpportunity: "",
  activeServices: [],
  keyNotes: "",
};

const fieldClass =
  "w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)]";

function personName(person: TeamMember) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
}

export default function NewClientAccountPage() {
  const router = useRouter();
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [packageOptions, setPackageOptions] = useState<string[]>([]);
  const [isBespokePackage, setIsBespokePackage] = useState(false);
  const [form, setForm] = useState<ClientAccountCreatePayload>(emptyAccountForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    void api.team
      .getMembers(token)
      .then((members) => setTeamMembers(members.filter((member) => !member.isInvitation)))
      .catch((error) => {
        console.error("Failed to load account managers", error);
        addToast("Account managers could not be loaded.", "error");
      });
  }, [addToast, token]);

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
    if (!token || !form.name.trim()) return;

    setIsSubmitting(true);
    try {
      await api.clientAccounts.create(token, {
        ...form,
        name: form.name.trim(),
        email: form.email || null,
        phone: form.phone || null,
        website: form.website || null,
        currentPackage: form.currentPackage || null,
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
                  required
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
                  type="email"
                  value={form.email || ""}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                  className={fieldClass}
                  placeholder="hello@client.co.uk"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Phone</span>
                <input
                  type="tel"
                  value={form.phone || ""}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                  className={fieldClass}
                  placeholder="020 0000 0000"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Website</span>
                <input
                  type="url"
                  value={form.website || ""}
                  onChange={(event) => setForm((current) => ({ ...current, website: event.target.value }))}
                  className={fieldClass}
                  placeholder="https://client.co.uk"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Account manager</span>
                <select
                  value={form.accountManagerId || ""}
                  onChange={(event) => setForm((current) => ({ ...current, accountManagerId: event.target.value || null }))}
                  className={fieldClass}
                >
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => (
                    <option key={member.id} value={member.id}>{personName(member)}</option>
                  ))}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Client stage</span>
                <select
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
                    value={form.currentPackage || ""}
                    onChange={(event) => setForm((current) => ({ ...current, currentPackage: event.target.value }))}
                    className={fieldClass}
                    placeholder="Enter bespoke package name"
                  />
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Recommended next package</span>
                <select
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
                  value={form.upsellOpportunity || ""}
                  onChange={(event) => setForm((current) => ({ ...current, upsellOpportunity: event.target.value }))}
                  className={fieldClass}
                  placeholder="e.g. Move to Growth Engine after tracking QA"
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
                  <p className="text-xs text-[#8b9694]">Services</p>
                  <p className="mt-1 text-sm font-semibold text-[#344446]">{form.activeServices?.length || "None"}</p>
                </div>
              </div>
              <button
                type="submit"
                disabled={isSubmitting || !form.name.trim() || !token}
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
