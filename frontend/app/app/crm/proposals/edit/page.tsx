"use client";

import { ArrowLeft, Eye, FileText, Loader2, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import { SALES_NAV } from "@/lib/section-nav";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { GrowthPackageRecord, ProposalPayload, ProposalRecord, ProposalSectionContent } from "@/lib/api-types";

const proposalTemplates = [
  {
    key: "clinicgrower_standard",
    label: "ClinicGrower standard",
    description: "Default sales proposal for Growth Score, growth plan and ongoing package recommendations.",
  },
  {
    key: "growth_score_follow_up",
    label: "Growth Score follow-up",
    description: "Used after a free audit or Growth Score review when the next step is a paid package.",
  },
  {
    key: "bespoke_growth_plan",
    label: "Bespoke growth plan",
    description: "Flexible structure for custom scope, mixed delivery or multi-location opportunities.",
  },
];

const statusOptions = [
  { value: "draft", label: "Draft" },
  { value: "ready", label: "Ready" },
  { value: "sent", label: "Sent" },
  { value: "viewed", label: "Viewed" },
  { value: "follow_up_due", label: "Follow-up due" },
  { value: "accepted", label: "Accepted" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "expired", label: "Expired" },
] as const;

type ProposalForm = {
  contactId: string;
  dealId: string;
  clientAccountProfileId: string;
  proposalName: string;
  templateKey: string;
  recommendedPackageId: string;
  packageName: string;
  value: string;
  currency: string;
  status: ProposalPayload["status"];
  followUpAt: string;
  expiresAt: string;
  proposalUrl: string;
  notes: string;
  executiveSummary: string;
  diagnosis: string;
  recommendedPlan: string;
  includedFeatures: string;
  timeline: string;
  investmentNotes: string;
  nextSteps: string;
};

function toDateTimeLocal(value: string | null | undefined) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.slice(0, 16);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function moneyFromCents(value: number | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value / 100);
}

function centsFromMoney(value: string) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? Math.round(numeric * 100) : null;
}

function sectionContentFromForm(form: ProposalForm): ProposalSectionContent {
  return {
    executiveSummary: form.executiveSummary.trim() || null,
    diagnosis: form.diagnosis.trim() || null,
    recommendedPlan: form.recommendedPlan.trim() || null,
    includedFeatures: form.includedFeatures
      .split(/\r?\n/)
      .map((feature) => feature.trim())
      .filter(Boolean),
    timeline: form.timeline.trim() || null,
    investmentNotes: form.investmentNotes.trim() || null,
    nextSteps: form.nextSteps.trim() || null,
  };
}

function formFromProposal(proposal: ProposalRecord): ProposalForm {
  const sections = proposal.sectionContent || {};
  return {
    contactId: proposal.contactId || "",
    dealId: proposal.dealId || "",
    clientAccountProfileId: proposal.clientAccountProfileId || "",
    proposalName: proposal.proposalName || "",
    templateKey: proposal.templateKey || "clinicgrower_standard",
    recommendedPackageId: proposal.recommendedPackageId || "",
    packageName: proposal.packageName || "",
    value: moneyFromCents(proposal.valueCents),
    currency: proposal.currency || "GBP",
    status: proposal.status,
    followUpAt: toDateTimeLocal(proposal.followUpAt),
    expiresAt: toDateTimeLocal(proposal.expiresAt),
    proposalUrl: proposal.proposalUrl || "",
    notes: proposal.notes || "",
    executiveSummary: sections.executiveSummary || "",
    diagnosis: sections.diagnosis || "",
    recommendedPlan: sections.recommendedPlan || "",
    includedFeatures: (sections.includedFeatures || []).join("\n"),
    timeline: sections.timeline || "",
    investmentNotes: sections.investmentNotes || "",
    nextSteps: sections.nextSteps || "",
  };
}

function createInitialForm(searchParams: URLSearchParams): ProposalForm {
  const packageName = searchParams.get("packageName") || "";
  const accountName = searchParams.get("accountName") || "New opportunity";
  return {
    contactId: searchParams.get("contactId") || "",
    dealId: searchParams.get("dealId") || "",
    clientAccountProfileId: searchParams.get("clientAccountProfileId") || "",
    proposalName: searchParams.get("proposalName") || `${accountName} proposal`,
    templateKey: searchParams.get("templateKey") || "clinicgrower_standard",
    recommendedPackageId: searchParams.get("recommendedPackageId") || "",
    packageName,
    value: "",
    currency: "GBP",
    status: "draft",
    followUpAt: "",
    expiresAt: "",
    proposalUrl: "",
    notes: "",
    executiveSummary: "",
    diagnosis: "",
    recommendedPlan: "",
    includedFeatures: "",
    timeline: "",
    investmentNotes: "",
    nextSteps: "",
  };
}

function formatPackagePrice(item: GrowthPackageRecord) {
  if (item.priceCents === null || item.priceCents === undefined) return "Bespoke";
  const price = new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: item.currency || "GBP",
    maximumFractionDigits: 0,
  }).format(item.priceCents / 100);
  return item.billingFrequency === "one_off" ? `${price} one-off` : `${price}/${item.billingFrequency.replace(/_/g, " ")}`;
}

export default function ProposalEditPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const proposalId = searchParams.get("id") || "";
  const { session } = useAuth();
  const token = session?.token;
  const [form, setForm] = useState<ProposalForm>(() => createInitialForm(searchParams));
  const [packages, setPackages] = useState<GrowthPackageRecord[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(proposalId));
  const [isSaving, setIsSaving] = useState(false);
  const [savedProposalId, setSavedProposalId] = useState(proposalId);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedTemplate = useMemo(
    () => proposalTemplates.find((item) => item.key === form.templateKey) || proposalTemplates[0],
    [form.templateKey],
  );

  const selectedPackage = useMemo(
    () => packages.find((item) => item.id === form.recommendedPackageId) || null,
    [form.recommendedPackageId, packages],
  );

  const updateForm = (patch: Partial<ProposalForm>) => {
    setForm((current) => ({ ...current, ...patch }));
  };

  const loadProposalWorkflow = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError("");
    try {
      const [packageRecords, proposalRecord] = await Promise.all([
        api.packages.list(token, { includeInactive: true }),
        proposalId ? api.proposals.get(token, proposalId) : Promise.resolve(null),
      ]);
      setPackages(packageRecords);
      if (proposalRecord) {
        setForm(formFromProposal(proposalRecord));
        setSavedProposalId(proposalRecord.id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not load proposal workflow.");
    } finally {
      setIsLoading(false);
    }
  }, [proposalId, token]);

  useEffect(() => {
    void loadProposalWorkflow();
  }, [loadProposalWorkflow]);

  const applyPackage = (packageId: string) => {
    const packageRecord = packages.find((item) => item.id === packageId);
    updateForm({
      recommendedPackageId: packageId,
      packageName: packageRecord?.name || "",
      value: packageRecord?.priceCents === null || packageRecord?.priceCents === undefined
        ? form.value
        : moneyFromCents(packageRecord.priceCents),
      currency: packageRecord?.currency || form.currency || "GBP",
      recommendedPlan: form.recommendedPlan || packageRecord?.proposalWording || "",
      includedFeatures: form.includedFeatures || (packageRecord?.includedFeatures || []).join("\n"),
    });
  };

  const buildPayload = (statusOverride?: ProposalPayload["status"]): ProposalPayload => ({
    contactId: form.contactId.trim() || null,
    dealId: form.dealId.trim() || null,
    clientAccountProfileId: form.clientAccountProfileId.trim() || null,
    proposalName: form.proposalName.trim(),
    templateKey: form.templateKey,
    recommendedPackageId: form.recommendedPackageId || null,
    packageName: form.packageName.trim() || selectedPackage?.name || null,
    status: statusOverride || form.status || "draft",
    valueCents: centsFromMoney(form.value),
    currency: form.currency.trim() || "GBP",
    followUpAt: fromDateTimeLocal(form.followUpAt),
    expiresAt: fromDateTimeLocal(form.expiresAt),
    proposalUrl: form.proposalUrl.trim() || null,
    notes: form.notes.trim() || null,
    sectionContent: sectionContentFromForm(form),
  });

  const saveProposal = async (previewAfterSave = false) => {
    if (!token) return;
    setIsSaving(true);
    setError("");
    setMessage("");
    try {
      const payload = buildPayload("draft");
      const saved = savedProposalId
        ? await api.proposals.update(token, savedProposalId, payload)
        : await api.proposals.create(token, payload);
      setSavedProposalId(saved.id);
      setForm(formFromProposal(saved));
      setMessage("Draft saved.");
      if (!savedProposalId) {
        router.replace(`/app/crm/proposals/edit?id=${encodeURIComponent(saved.id)}`);
      }
      if (previewAfterSave) {
        router.push(`/app/crm/proposals/preview?id=${encodeURIComponent(saved.id)}`);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not save proposal draft.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f6f1]">
      <PageHeader
        title={savedProposalId ? "Edit Proposal" : "Create Proposal"}
        subtitle="Create and continue proposal drafts from a lead, deal or client account record."
        right={
          <div className="flex flex-wrap gap-2">
            <Link
              href="/app/crm/pipeline"
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6]"
            >
              <ArrowLeft className="h-4 w-4" />
              Pipeline
            </Link>
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={() => void saveProposal(false)}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save draft
            </button>
            <button
              type="button"
              disabled={isSaving || isLoading}
              onClick={() => void saveProposal(true)}
              className="inline-flex items-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Eye className="h-4 w-4" />
              Save & preview
            </button>
          </div>
        }
      />
      <SubNav items={SALES_NAV} />

      <main className="px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl space-y-5">
          {error ? <AlertBanner title="Proposal draft issue" description={error} variant="error" /> : null}
          {message ? <AlertBanner title="Saved" description={message} variant="success" /> : null}

          {isLoading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-[8px] border border-[#d8e4df] bg-white">
              <Loader2 className="h-6 w-6 animate-spin text-[#315f51]" />
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
              <section className="space-y-5">
                <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                  <div className="flex items-center gap-2">
                    <FileText className="h-5 w-5 text-[#315f51]" />
                    <h2 className="text-base font-semibold text-[#14231f]">Proposal setup</h2>
                  </div>

                  <div className="mt-5 space-y-4">
                    <label className="block text-sm font-medium text-[#354943]">
                      Proposal name
                      <input
                        value={form.proposalName}
                        onChange={(event) => updateForm({ proposalName: event.target.value })}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>

                    <label className="block text-sm font-medium text-[#354943]">
                      Template
                      <select
                        value={form.templateKey}
                        onChange={(event) => updateForm({ templateKey: event.target.value })}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        {proposalTemplates.map((template) => (
                          <option key={template.key} value={template.key}>
                            {template.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p className="rounded-[8px] bg-[#f3f7f4] p-3 text-xs leading-5 text-[#5b7069]">
                      {selectedTemplate.description}
                    </p>

                    <label className="block text-sm font-medium text-[#354943]">
                      Recommended package
                      <select
                        value={form.recommendedPackageId}
                        onChange={(event) => applyPackage(event.target.value)}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      >
                        <option value="">Bespoke / no package selected</option>
                        {packages.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} - {formatPackagePrice(item)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Package label
                        <input
                          value={form.packageName}
                          onChange={(event) => updateForm({ packageName: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Value
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.value}
                          onChange={(event) => updateForm({ value: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Status
                        <select
                          value={form.status}
                          onChange={(event) => updateForm({ status: event.target.value as ProposalPayload["status"] })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        >
                          {statusOptions.map((status) => (
                            <option key={status.value} value={status.value}>
                              {status.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Currency
                        <input
                          value={form.currency}
                          onChange={(event) => updateForm({ currency: event.target.value.toUpperCase().slice(0, 3) })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Follow-up
                        <input
                          type="datetime-local"
                          value={form.followUpAt}
                          onChange={(event) => updateForm({ followUpAt: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Expires
                        <input
                          type="datetime-local"
                          value={form.expiresAt}
                          onChange={(event) => updateForm({ expiresAt: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                  <h2 className="text-base font-semibold text-[#14231f]">Record links</h2>
                  <p className="mt-1 text-sm text-[#5b7069]">A proposal must link to a lead/contact or deal.</p>
                  <div className="mt-4 space-y-4">
                    <label className="block text-sm font-medium text-[#354943]">
                      Contact / lead ID
                      <input
                        value={form.contactId}
                        onChange={(event) => updateForm({ contactId: event.target.value })}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#354943]">
                      Deal ID
                      <input
                        value={form.dealId}
                        onChange={(event) => updateForm({ dealId: event.target.value })}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                    <label className="block text-sm font-medium text-[#354943]">
                      Client account profile ID
                      <input
                        value={form.clientAccountProfileId}
                        onChange={(event) => updateForm({ clientAccountProfileId: event.target.value })}
                        className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                  </div>
                </div>
              </section>

              <section className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                <h2 className="text-base font-semibold text-[#14231f]">Editable proposal sections</h2>
                <div className="mt-5 space-y-4">
                  {[
                    ["Executive summary", "executiveSummary"],
                    ["Current diagnosis", "diagnosis"],
                    ["Recommended plan", "recommendedPlan"],
                    ["Included features", "includedFeatures"],
                    ["Delivery timeline", "timeline"],
                    ["Investment notes", "investmentNotes"],
                    ["Next steps", "nextSteps"],
                  ].map(([label, key]) => (
                    <label key={key} className="block text-sm font-medium text-[#354943]">
                      {label}
                      <textarea
                        rows={key === "includedFeatures" || key === "timeline" ? 5 : 4}
                        value={form[key as keyof ProposalForm] || ""}
                        onChange={(event) => updateForm({ [key]: event.target.value } as Partial<ProposalForm>)}
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
                  ))}
                  <label className="block text-sm font-medium text-[#354943]">
                    Internal notes
                    <textarea
                      rows={3}
                      value={form.notes}
                      onChange={(event) => updateForm({ notes: event.target.value })}
                      className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                    />
                  </label>
                </div>
              </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
