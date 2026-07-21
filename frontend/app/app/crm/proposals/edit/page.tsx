"use client";

import { ArrowLeft, Eye, FileText, Loader2, RefreshCw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, PageHeader } from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import { SALES_NAV } from "@/lib/section-nav";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import type { GrowthPackageRecord, ProposalCommercialItem, ProposalPayload, ProposalRecord, ProposalSectionContent, ProposalSourceDataRecord } from "@/lib/api-types";

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
  monthlyFee: string;
  setupFee: string;
  currency: string;
  adSpendNote: string;
  vatStatus: string;
  minimumTermMonths: string;
  noticePeriodDays: string;
  startDate: string;
  status: ProposalPayload["status"];
  followUpAt: string;
  expiresAt: string;
  proposalUrl: string;
  notes: string;
  addOns: string;
  discounts: string;
  internalMarginNote: string;
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

function intOrNull(value: string) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric >= 0 ? numeric : null;
}

function commercialItemsFromText(value: string): ProposalCommercialItem[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [namePart, amountPart, notePart] = line.split("|").map((part) => part.trim());
      return {
        name: namePart,
        amountCents: amountPart ? centsFromMoney(amountPart) : null,
        note: notePart || null,
      };
    });
}

function commercialItemsToText(items: ProposalCommercialItem[] | null | undefined) {
  return (items || [])
    .map((item) => [item.name, item.amountCents === null || item.amountCents === undefined ? "" : String(item.amountCents / 100), item.note || ""]
      .filter((part, index) => index === 0 || part)
      .join(" | "))
    .join("\n");
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
    monthlyFee: moneyFromCents(proposal.monthlyFeeCents),
    setupFee: moneyFromCents(proposal.setupFeeCents),
    currency: proposal.currency || "GBP",
    adSpendNote: proposal.adSpendNote || "",
    vatStatus: proposal.vatStatus || "",
    minimumTermMonths: proposal.minimumTermMonths === null || proposal.minimumTermMonths === undefined ? "" : String(proposal.minimumTermMonths),
    noticePeriodDays: proposal.noticePeriodDays === null || proposal.noticePeriodDays === undefined ? "" : String(proposal.noticePeriodDays),
    startDate: proposal.startDate || "",
    status: proposal.status,
    followUpAt: toDateTimeLocal(proposal.followUpAt),
    expiresAt: toDateTimeLocal(proposal.expiresAt),
    proposalUrl: proposal.proposalUrl || "",
    notes: proposal.notes || "",
    addOns: commercialItemsToText(proposal.addOns),
    discounts: commercialItemsToText(proposal.discounts),
    internalMarginNote: proposal.internalMarginNote || "",
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
    monthlyFee: "",
    setupFee: "",
    currency: "GBP",
    adSpendNote: "",
    vatStatus: "",
    minimumTermMonths: "",
    noticePeriodDays: "",
    startDate: "",
    status: "draft",
    followUpAt: "",
    expiresAt: "",
    proposalUrl: "",
    notes: "",
    addOns: "",
    discounts: "",
    internalMarginNote: "",
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

function mergeIfBlank(currentValue: string, suggestedValue: string | null | undefined) {
  return currentValue.trim() ? currentValue : suggestedValue || "";
}

function formWithSourceData(current: ProposalForm, sourceData: ProposalSourceDataRecord): ProposalForm {
  const suggested = sourceData.suggested;
  const sections = suggested.sectionContent || {};
  return {
    ...current,
    contactId: mergeIfBlank(current.contactId, sourceData.links.contactId),
    dealId: mergeIfBlank(current.dealId, sourceData.links.dealId),
    clientAccountProfileId: mergeIfBlank(current.clientAccountProfileId, sourceData.links.clientAccountProfileId),
    proposalName: mergeIfBlank(current.proposalName, suggested.proposalName),
    templateKey: current.templateKey === "clinicgrower_standard" ? suggested.templateKey || current.templateKey : current.templateKey,
    recommendedPackageId: mergeIfBlank(current.recommendedPackageId, suggested.recommendedPackageId),
    packageName: mergeIfBlank(current.packageName, suggested.packageName),
    value: mergeIfBlank(current.value, moneyFromCents(suggested.valueCents)),
    monthlyFee: mergeIfBlank(current.monthlyFee, moneyFromCents(suggested.monthlyFeeCents)),
    setupFee: mergeIfBlank(current.setupFee, moneyFromCents(suggested.setupFeeCents)),
    currency: current.currency || suggested.currency || "GBP",
    adSpendNote: mergeIfBlank(current.adSpendNote, suggested.adSpendNote),
    executiveSummary: mergeIfBlank(current.executiveSummary, sections.executiveSummary),
    diagnosis: mergeIfBlank(current.diagnosis, sections.diagnosis),
    recommendedPlan: mergeIfBlank(current.recommendedPlan, sections.recommendedPlan),
    includedFeatures: mergeIfBlank(current.includedFeatures, (sections.includedFeatures || []).join("\n")),
    timeline: mergeIfBlank(current.timeline, sections.timeline),
    investmentNotes: mergeIfBlank(current.investmentNotes, sections.investmentNotes),
    nextSteps: mergeIfBlank(current.nextSteps, sections.nextSteps),
  };
}

function formatScore(value: number | null | undefined) {
  return value === null || value === undefined ? "Not scored" : `${Math.round(value)} / 100`;
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
  const [isPullingSourceData, setIsPullingSourceData] = useState(false);
  const [savedProposalId, setSavedProposalId] = useState(proposalId);
  const [sourceData, setSourceData] = useState<ProposalSourceDataRecord | null>(null);
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
      monthlyFee: packageRecord?.billingFrequency === "monthly" && packageRecord.priceCents !== null && packageRecord.priceCents !== undefined
        ? moneyFromCents(packageRecord.priceCents)
        : form.monthlyFee,
      setupFee: packageRecord?.setupFeeCents === null || packageRecord?.setupFeeCents === undefined
        ? form.setupFee
        : moneyFromCents(packageRecord.setupFeeCents),
      currency: packageRecord?.currency || form.currency || "GBP",
      recommendedPlan: form.recommendedPlan || packageRecord?.proposalWording || "",
      includedFeatures: form.includedFeatures || (packageRecord?.includedFeatures || []).join("\n"),
    });
  };

  const pullProposalSourceData = useCallback(async () => {
    if (!token) return;
    const params = {
      contactId: form.contactId.trim() || undefined,
      dealId: form.dealId.trim() || undefined,
      clientAccountProfileId: form.clientAccountProfileId.trim() || undefined,
    };
    if (!params.contactId && !params.dealId && !params.clientAccountProfileId) {
      setError("Link a contact, deal or client account before pulling CRM data.");
      return;
    }

    setIsPullingSourceData(true);
    setError("");
    setMessage("");
    try {
      const pulled = await api.proposals.sourceData(token, params);
      setSourceData(pulled);
      setForm((current) => formWithSourceData(current, pulled));
      setMessage("CRM, audit and Growth Score data pulled into empty proposal fields.");
    } catch (pullError) {
      setError(pullError instanceof Error ? pullError.message : "Could not pull proposal source data.");
    } finally {
      setIsPullingSourceData(false);
    }
  }, [form.clientAccountProfileId, form.contactId, form.dealId, token]);

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
    monthlyFeeCents: centsFromMoney(form.monthlyFee),
    setupFeeCents: centsFromMoney(form.setupFee),
    currency: form.currency.trim() || "GBP",
    adSpendNote: form.adSpendNote.trim() || null,
    vatStatus: form.vatStatus.trim() || null,
    minimumTermMonths: intOrNull(form.minimumTermMonths),
    noticePeriodDays: intOrNull(form.noticePeriodDays),
    startDate: form.startDate || null,
    followUpAt: fromDateTimeLocal(form.followUpAt),
    expiresAt: fromDateTimeLocal(form.expiresAt),
    proposalUrl: form.proposalUrl.trim() || null,
    notes: form.notes.trim() || null,
    addOns: commercialItemsFromText(form.addOns),
    discounts: commercialItemsFromText(form.discounts),
    internalMarginNote: form.internalMarginNote.trim() || null,
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
              onClick={() => void pullProposalSourceData()}
              className="inline-flex items-center gap-2 rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm font-semibold text-[#315f51] hover:border-[#8cb8a6] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPullingSourceData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              Pull CRM data
            </button>
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
                  <h2 className="text-base font-semibold text-[#14231f]">Commercial terms</h2>
                  <p className="mt-1 text-sm text-[#5b7069]">Structured pricing fields for reporting and finance review.</p>
                  <div className="mt-5 space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Monthly fee
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.monthlyFee}
                          onChange={(event) => updateForm({ monthlyFee: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Setup fee
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.setupFee}
                          onChange={(event) => updateForm({ setupFee: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-[#354943]">
                      Ad spend note
                      <textarea
                        rows={3}
                        value={form.adSpendNote}
                        onChange={(event) => updateForm({ adSpendNote: event.target.value })}
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        VAT status
                        <select
                          value={form.vatStatus}
                          onChange={(event) => updateForm({ vatStatus: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        >
                          <option value="">Not set</option>
                          <option value="plus_vat">Plus VAT</option>
                          <option value="vat_included">VAT included</option>
                          <option value="vat_exempt">VAT exempt</option>
                          <option value="not_vat_registered">Not VAT registered</option>
                        </select>
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Start date
                        <input
                          type="date"
                          value={form.startDate}
                          onChange={(event) => updateForm({ startDate: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      <label className="block text-sm font-medium text-[#354943]">
                        Minimum term months
                        <input
                          type="number"
                          min="0"
                          value={form.minimumTermMonths}
                          onChange={(event) => updateForm({ minimumTermMonths: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                      <label className="block text-sm font-medium text-[#354943]">
                        Notice period days
                        <input
                          type="number"
                          min="0"
                          value={form.noticePeriodDays}
                          onChange={(event) => updateForm({ noticePeriodDays: event.target.value })}
                          className="mt-1 w-full rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                        />
                      </label>
                    </div>

                    <label className="block text-sm font-medium text-[#354943]">
                      Add-ons
                      <textarea
                        rows={3}
                        value={form.addOns}
                        onChange={(event) => updateForm({ addOns: event.target.value })}
                        placeholder="One per line, e.g. Landing page | 750 | Optional launch asset"
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>

                    <label className="block text-sm font-medium text-[#354943]">
                      Discounts
                      <textarea
                        rows={3}
                        value={form.discounts}
                        onChange={(event) => updateForm({ discounts: event.target.value })}
                        placeholder="One per line, e.g. Founder discount | 500 | First 3 months"
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-white px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>

                    <label className="block text-sm font-medium text-[#354943]">
                      Internal margin note
                      <textarea
                        rows={3}
                        value={form.internalMarginNote}
                        onChange={(event) => updateForm({ internalMarginNote: event.target.value })}
                        className="mt-1 w-full resize-y rounded-[8px] border border-[#d8e4df] bg-[#fff8ed] px-3 py-2 text-sm leading-6 text-[#14231f] outline-none focus:border-[#315f51] focus:ring-2 focus:ring-[#315f51]/15"
                      />
                    </label>
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
                  <button
                    type="button"
                    disabled={isPullingSourceData}
                    onClick={() => void pullProposalSourceData()}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-[8px] bg-[#315f51] px-3 py-2 text-sm font-semibold text-white hover:bg-[#24483d] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isPullingSourceData ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                    Pull CRM, audit and Growth Score data
                  </button>
                </div>

                {sourceData ? (
                  <div className="rounded-[8px] border border-[#d8e4df] bg-white p-5">
                    <h2 className="text-base font-semibold text-[#14231f]">Pulled source data</h2>
                    <div className="mt-4 space-y-3 text-sm text-[#354943]">
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Contact</span>
                        <span className="text-right font-semibold">{sourceData.contact.name || "Not linked"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Account</span>
                        <span className="text-right font-semibold">{sourceData.clientAccount.name || sourceData.contact.accountName || "Not linked"}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Growth Score</span>
                        <span className="text-right font-semibold">{formatScore(sourceData.growthScore.overall)}</span>
                      </div>
                      <div className="flex justify-between gap-4 border-b border-[#edf2ef] pb-2">
                        <span className="text-[#6b817a]">Recommended package</span>
                        <span className="text-right font-semibold">{sourceData.recommendedPackage.name || sourceData.suggested.packageName || "Not set"}</span>
                      </div>
                      <div>
                        <p className="text-[#6b817a]">Score gaps</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sourceData.growthScore.gaps.length ? sourceData.growthScore.gaps.map((gap) => (
                            <span key={gap.key} className="rounded-full bg-[#fff8ed] px-2 py-1 text-xs font-semibold text-[#775a22]">
                              {gap.label}: {formatScore(gap.score)}
                            </span>
                          )) : (
                            <span className="text-sm text-[#6b817a]">No scored gaps found.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
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
