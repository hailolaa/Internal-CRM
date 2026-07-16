"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  ClipboardCheck,
  Loader2,
  Save,
  ShieldCheck,
} from "lucide-react";
import { Card, PageHeader, ProgressBar } from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import type {
  ClientAccountChurnRisk,
  ClientAccountContractStatus,
  ClientAccountHealthStatus,
  ClientAccountOnboardingStatus,
  ClientAccountProfilePayload,
  ClientAccountProfileRecord,
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

const CONTRACT_STATUSES: ClientAccountContractStatus[] = [
  "active",
  "trial",
  "pending",
  "paused",
  "cancelled",
  "expired",
];
const ONBOARDING_STATUSES: ClientAccountOnboardingStatus[] = [
  "not_started",
  "in_progress",
  "completed",
  "paused",
];
const HEALTH_STATUSES: ClientAccountHealthStatus[] = [
  "healthy",
  "attention_needed",
  "at_risk",
  "critical",
];
const CHURN_RISKS: ClientAccountChurnRisk[] = ["low", "medium", "high", "critical"];

const fieldClass =
  "w-full rounded-xl border border-[#d8ddda] bg-white px-3.5 py-2.5 text-sm text-[#151f21] outline-none transition focus:border-[#75aaa7] focus:ring-4 focus:ring-[rgba(96,180,175,0.1)] disabled:opacity-60";

function formatLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function personName(person: TeamMember) {
  return [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email;
}

function toPayload(profile: ClientAccountProfileRecord): ClientAccountProfilePayload {
  return {
    accountManagerId: profile.accountManager?.id || null,
    activeServices: profile.activeServices,
    onboardingStatus: profile.onboardingStatus,
    healthStatus: profile.healthStatus,
    currentPackage: profile.currentPackage,
    recommendedNextPackage: profile.recommendedNextPackage,
    upsellOpportunity: profile.upsellOpportunity,
    churnRisk: profile.churnRisk,
    renewalDate: profile.renewalDate,
    contractStatus: profile.contractStatus,
    keyNotes: profile.keyNotes,
  };
}

export default function ClientPackagePage() {
  const { session } = useAuth();
  const { addToast } = useToast();
  const token = session?.token;
  const [profile, setProfile] = useState<ClientAccountProfileRecord | null>(null);
  const [draft, setDraft] = useState<ClientAccountProfilePayload | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [packageOptions, setPackageOptions] = useState<string[]>([]);
  const [isBespokePackage, setIsBespokePackage] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!token) return;
    Promise.all([api.clientAccounts.getProfile(token), api.team.getMembers(token)])
      .then(([profileRow, members]) => {
        setProfile(profileRow);
        setDraft(toPayload(profileRow));
        setTeamMembers(members.filter((member) => !member.isInvitation));
      })
      .catch((error) => {
        console.error("Failed to load package profile", error);
        addToast("Package profile could not be loaded.", "error");
      })
      .finally(() => setIsLoading(false));
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

  const updateDraft = <K extends keyof ClientAccountProfilePayload>(
    key: K,
    value: ClientAccountProfilePayload[K],
  ) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
  };

  const toggleService = (serviceType: ClientAccountServiceType) => {
    const currentServices = draft?.activeServices || [];
    updateDraft(
      "activeServices",
      currentServices.includes(serviceType)
        ? currentServices.filter((service) => service !== serviceType)
        : [...currentServices, serviceType],
    );
  };

  const saveProfile = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !draft) return;
    setIsSaving(true);
    try {
      const updated = await api.clientAccounts.updateProfile(token, draft);
      setProfile(updated);
      setDraft(toPayload(updated));
      addToast("Package profile updated.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "Could not update package profile.", "error");
    } finally {
      setIsSaving(false);
    }
  };

  const selectedManager = teamMembers.find((member) => member.id === draft?.accountManagerId);
  const serviceCoverage = Math.round(((draft?.activeServices?.length || 0) / SERVICE_TYPES.length) * 100);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Package Profile"
        subtitle={profile?.clinicName ? `${profile.clinicName} package and account health.` : "Manage package and account health."}
        icon={ClipboardCheck}
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

      <form onSubmit={saveProfile} className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card padding="p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Commercial setup</p>
            <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Ownership and contract</h2>
            <p className="mt-1 text-sm text-[#7A746A]">Keep the commercial owner, lifecycle and renewal details current.</p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Account manager</span>
                <select value={draft?.accountManagerId || ""} disabled={isLoading || !draft} onChange={(event) => updateDraft("accountManagerId", event.target.value || null)} className={fieldClass}>
                  <option value="">Unassigned</option>
                  {teamMembers.map((member) => <option key={member.id} value={member.id}>{personName(member)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Renewal date</span>
                <input type="date" value={draft?.renewalDate || ""} disabled={isLoading || !draft} onChange={(event) => updateDraft("renewalDate", event.target.value || null)} className={fieldClass} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Contract status</span>
                <select value={draft?.contractStatus || "pending"} disabled={isLoading || !draft} onChange={(event) => updateDraft("contractStatus", event.target.value as ClientAccountContractStatus)} className={fieldClass}>
                  {CONTRACT_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Current package</span>
                <select
                  value={isBespokePackage ? "__bespoke__" : draft?.currentPackage || ""}
                  disabled={isLoading || !draft}
                  onChange={(event) => {
                    if (event.target.value === "__bespoke__") {
                      setIsBespokePackage(true);
                      updateDraft("currentPackage", "");
                      return;
                    }
                    setIsBespokePackage(false);
                    updateDraft("currentPackage", event.target.value || null);
                  }}
                  className={fieldClass}
                >
                  <option value="">Select package</option>
                  {packageOptions.map((packageName) => <option key={packageName} value={packageName}>{packageName}</option>)}
                  {draft?.currentPackage && !packageOptions.includes(draft.currentPackage) && (
                    <option value={draft.currentPackage}>{draft.currentPackage}</option>
                  )}
                  <option value="__bespoke__">Bespoke / custom</option>
                </select>
                {isBespokePackage && (
                  <input
                    value={draft?.currentPackage || ""}
                    disabled={isLoading || !draft}
                    onChange={(event) => updateDraft("currentPackage", event.target.value)}
                    className={fieldClass}
                    placeholder="Enter bespoke package name"
                  />
                )}
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Recommended next package</span>
                <select
                  value={draft?.recommendedNextPackage || ""}
                  disabled={isLoading || !draft}
                  onChange={(event) => updateDraft("recommendedNextPackage", event.target.value || null)}
                  className={fieldClass}
                >
                  <option value="">No recommendation yet</option>
                  {packageOptions.map((packageName) => <option key={packageName} value={packageName}>{packageName}</option>)}
                  {draft?.recommendedNextPackage && !packageOptions.includes(draft.recommendedNextPackage) && (
                    <option value={draft.recommendedNextPackage}>{draft.recommendedNextPackage}</option>
                  )}
                </select>
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Upsell opportunity</span>
                <input
                  value={draft?.upsellOpportunity || ""}
                  disabled={isLoading || !draft}
                  onChange={(event) => updateDraft("upsellOpportunity", event.target.value)}
                  className={fieldClass}
                  placeholder="e.g. Recommend Market Leader after next renewal"
                />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Onboarding</span>
                <select value={draft?.onboardingStatus || "not_started"} disabled={isLoading || !draft} onChange={(event) => updateDraft("onboardingStatus", event.target.value as ClientAccountOnboardingStatus)} className={fieldClass}>
                  {ONBOARDING_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Health</span>
                <select value={draft?.healthStatus || "healthy"} disabled={isLoading || !draft} onChange={(event) => updateDraft("healthStatus", event.target.value as ClientAccountHealthStatus)} className={fieldClass}>
                  {HEALTH_STATUSES.map((status) => <option key={status} value={status}>{formatLabel(status)}</option>)}
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Churn risk</span>
                <select value={draft?.churnRisk || "low"} disabled={isLoading || !draft} onChange={(event) => updateDraft("churnRisk", event.target.value as ClientAccountChurnRisk)} className={fieldClass}>
                  {CHURN_RISKS.map((risk) => <option key={risk} value={risk}>{formatLabel(risk)}</option>)}
                </select>
              </label>
            </div>
          </Card>

          <Card padding="p-5 sm:p-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Package scope</p>
                <h2 className="mt-1 text-xl font-semibold text-[#151f21]">Included services</h2>
              </div>
              <span className="text-sm font-semibold text-[#315f62]">{serviceCoverage}% coverage</span>
            </div>
            <div className="mt-4"><ProgressBar value={serviceCoverage} max={100} color="#60b4af" /></div>
            <div className="mt-5 flex flex-wrap gap-2.5">
              {SERVICE_TYPES.map((service) => {
                const selected = draft?.activeServices?.includes(service.value);
                return (
                  <button key={service.value} type="button" disabled={isLoading || !draft} aria-pressed={selected} onClick={() => toggleService(service.value)} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${selected ? "border-[rgba(96,180,175,0.35)] bg-[#e4efed] text-[#315f62]" : "border-[#d8ddda] bg-white text-[#5e8a8d] hover:bg-[#f4f7f5]"}`}>
                    {selected && <CheckCircle2 className="h-4 w-4" />}{service.label}
                  </button>
                );
              })}
            </div>
            <label className="mt-6 block space-y-1.5">
              <span className="text-sm font-semibold text-[#344446]">Key notes</span>
              <textarea value={draft?.keyNotes || ""} disabled={isLoading || !draft} onChange={(event) => updateDraft("keyNotes", event.target.value)} rows={5} className={fieldClass} placeholder="Commercial context, renewal commitments or account risks..." />
            </label>
          </Card>
        </div>

        <aside className="xl:sticky xl:top-20 xl:self-start">
          <Card className="overflow-hidden" padding="p-0">
            <div className="border-b border-[rgba(21,31,33,0.06)] bg-gradient-to-br from-[#e8f3f0] to-[#f7faf8] p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#5e8a8d] shadow-sm"><ShieldCheck className="h-5 w-5" /></div>
                <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#5e8a8d]">Live profile</p><h2 className="font-semibold text-[#151f21]">Package snapshot</h2></div>
              </div>
            </div>
            <div className="space-y-5 p-5">
              <div><p className="text-xs font-semibold uppercase tracking-wider text-[#8b9694]">Workspace</p><p className="mt-1 text-lg font-semibold text-[#151f21]">{profile?.clinicName || "Loading profile..."}</p></div>
              <div className="grid grid-cols-2 gap-4 border-y border-[rgba(21,31,33,0.06)] py-4">
                <div><p className="text-xs text-[#8b9694]">Manager</p><p className="mt-1 text-sm font-semibold text-[#344446]">{selectedManager ? personName(selectedManager) : "Unassigned"}</p></div>
                <div><p className="text-xs text-[#8b9694]">Services</p><p className="mt-1 text-sm font-semibold text-[#344446]">{draft?.activeServices?.length || "None"}</p></div>
                <div><p className="text-xs text-[#8b9694]">Contract</p><p className="mt-1 text-sm font-semibold text-[#344446]">{formatLabel(draft?.contractStatus || "pending")}</p></div>
                <div><p className="text-xs text-[#8b9694]">Health</p><p className="mt-1 text-sm font-semibold text-[#344446]">{formatLabel(draft?.healthStatus || "attention_needed")}</p></div>
              </div>
              <button type="submit" disabled={isLoading || isSaving || !draft} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#5e8a8d] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#507b7e] disabled:opacity-60">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Save package profile
              </button>
            </div>
          </Card>
        </aside>
      </form>
    </div>
  );
}
