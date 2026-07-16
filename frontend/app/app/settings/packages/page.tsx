"use client";

import { Archive, Loader2, Package, Plus, Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertBanner, Card, PageHeader } from "@/components/ui";
import { api } from "@/lib/api-client";
import type { GrowthPackagePayload, GrowthPackageRecord, PackageBillingFrequency, PackageStatus } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";

type DraftPackage = {
  id: string | null;
  name: string;
  pricePounds: string;
  currency: string;
  billingFrequency: PackageBillingFrequency;
  setupFeePounds: string;
  includedFeaturesText: string;
  internalNotes: string;
  proposalWording: string;
  sortOrder: string;
  status: PackageStatus;
};

const fieldClass =
  "w-full rounded-xl border border-[rgba(21,31,33,0.08)] bg-[#FFFCF9] px-3 py-2 text-sm text-[#151f21] outline-none transition focus:border-[#60b4af] focus:ring-2 focus:ring-[rgba(96,180,175,0.14)]";

function moneyToPounds(value: number | null) {
  if (value === null || value === undefined) return "";
  return String(value / 100);
}

function poundsToCents(value: string) {
  const numeric = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(numeric) ? Math.round(numeric * 100) : null;
}

function toDraft(record?: GrowthPackageRecord): DraftPackage {
  return {
    id: record?.id || null,
    name: record?.name || "",
    pricePounds: moneyToPounds(record?.priceCents ?? null),
    currency: record?.currency || "GBP",
    billingFrequency: record?.billingFrequency || "monthly",
    setupFeePounds: moneyToPounds(record?.setupFeeCents ?? null),
    includedFeaturesText: (record?.includedFeatures || []).join("\n"),
    internalNotes: record?.internalNotes || "",
    proposalWording: record?.proposalWording || "",
    sortOrder: String(record?.sortOrder ?? 100),
    status: record?.status || "active",
  };
}

function toPayload(draft: DraftPackage): GrowthPackagePayload {
  return {
    name: draft.name.trim(),
    priceCents: poundsToCents(draft.pricePounds),
    currency: draft.currency.trim().toUpperCase() || "GBP",
    billingFrequency: draft.billingFrequency,
    setupFeeCents: poundsToCents(draft.setupFeePounds),
    includedFeatures: draft.includedFeaturesText
      .split("\n")
      .map((feature) => feature.trim())
      .filter(Boolean),
    internalNotes: draft.internalNotes.trim() || null,
    proposalWording: draft.proposalWording.trim() || null,
    sortOrder: Number(draft.sortOrder || 100),
    status: draft.status,
  };
}

function formatPrice(record: GrowthPackageRecord) {
  const price = record.priceCents === null
    ? "Bespoke"
    : new Intl.NumberFormat("en-GB", {
        style: "currency",
        currency: record.currency || "GBP",
        maximumFractionDigits: 0,
      }).format(record.priceCents / 100);

  const frequency = record.billingFrequency === "one_off"
    ? "one-off"
    : record.billingFrequency === "bespoke"
      ? "bespoke"
      : `/${record.billingFrequency}`;

  return `${price} ${frequency}`;
}

export default function PackageSettingsPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canWrite = hasPermission("settings:write");
  const [packages, setPackages] = useState<GrowthPackageRecord[]>([]);
  const [draft, setDraft] = useState<DraftPackage>(() => toDraft());
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedRecord = useMemo(
    () => packages.find((record) => record.id === draft.id) || null,
    [draft.id, packages],
  );

  const loadPackages = useCallback(async () => {
    if (!token) return;
    await Promise.resolve();
    setIsLoading(true);
    setError("");
    try {
      const records = await api.packages.list(token, { includeInactive: true });
      setPackages(records);
      setDraft((current) => {
        if (current.id && records.some((record) => record.id === current.id)) return current;
        return toDraft(records[0]);
      });
    } catch (loadError) {
      console.error("Failed to load packages", loadError);
      setError(loadError instanceof Error ? loadError.message : "Package matrix could not be loaded.");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadPackages();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadPackages]);

  const updateDraft = <K extends keyof DraftPackage>(key: K, value: DraftPackage[K]) => {
    setDraft((current) => ({ ...current, [key]: value }));
  };

  const newPackage = () => {
    setDraft({
      ...toDraft(),
      sortOrder: String((packages.length + 1) * 10),
      status: "active",
    });
    setMessage("");
    setError("");
  };

  const savePackage = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || !canWrite) return;
    if (!draft.name.trim()) {
      setError("Package name is required.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      const saved = draft.id
        ? await api.packages.update(token, draft.id, toPayload(draft))
        : await api.packages.create(token, toPayload(draft));
      await loadPackages();
      setDraft(toDraft(saved));
      setMessage("Package saved.");
    } catch (saveError) {
      console.error("Failed to save package", saveError);
      setError(saveError instanceof Error ? saveError.message : "Package could not be saved.");
    } finally {
      setIsSaving(false);
    }
  };

  const archivePackage = async () => {
    if (!token || !canWrite || !draft.id) return;
    setIsSaving(true);
    setMessage("");
    setError("");
    try {
      await api.packages.remove(token, draft.id);
      await loadPackages();
      setMessage("Package archived.");
    } catch (archiveError) {
      console.error("Failed to archive package", archiveError);
      setError(archiveError instanceof Error ? archiveError.message : "Package could not be archived.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Package Matrix"
        subtitle="Configure the ClinicGrower product ladder used by sales, client accounts, and proposals."
        icon={Package}
        right={
          <button
            type="button"
            onClick={newPackage}
            disabled={!canWrite}
            className="btn-secondary inline-flex items-center gap-2 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add bespoke package
          </button>
        }
      />

      {message && <AlertBanner variant="success" title={message} />}
      {error && <AlertBanner variant="error" title="Package matrix issue" description={error} />}

      <div className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="overflow-hidden" padding="p-0">
          <div className="border-b border-[rgba(21,31,33,0.06)] p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">Active ladder</p>
            <h2 className="mt-1 font-semibold text-[#151f21]">Packages</h2>
          </div>
          <div className="max-h-[680px] overflow-y-auto p-2">
            {isLoading ? (
              <div className="flex items-center gap-2 p-4 text-sm text-[#5e8a8d]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading packages
              </div>
            ) : packages.length === 0 ? (
              <p className="p-4 text-sm text-[#7A746A]">No packages configured yet.</p>
            ) : (
              packages.map((record) => (
                <button
                  key={record.id}
                  type="button"
                  onClick={() => setDraft(toDraft(record))}
                  className={`mb-2 w-full rounded-xl border p-3 text-left transition ${
                    draft.id === record.id
                      ? "border-[#60b4af] bg-[#e8f3f0]"
                      : "border-[rgba(21,31,33,0.08)] bg-white hover:bg-[#FAF8F5]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[#151f21]">{record.name}</p>
                    <span className="rounded-full bg-[#FAF8F5] px-2 py-0.5 text-[11px] font-semibold text-[#5e8a8d]">
                      {record.status}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-[#5e8a8d]">{formatPrice(record)}</p>
                </button>
              ))
            )}
          </div>
        </Card>

        <form onSubmit={savePackage}>
          <Card padding="p-5 sm:p-6">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5e8a8d]">
                  {draft.id ? "Edit package" : "New package"}
                </p>
                <h2 className="mt-1 text-xl font-semibold text-[#151f21]">
                  {draft.name || "Bespoke package"}
                </h2>
                {selectedRecord?.isDefault && (
                  <p className="mt-1 text-sm text-[#7A746A]">Seeded default package. Admins can edit it for this workspace.</p>
                )}
              </div>
              {draft.id && canWrite && (
                <button
                  type="button"
                  onClick={archivePackage}
                  disabled={isSaving}
                  className="inline-flex items-center gap-2 rounded-full border border-[rgba(154,85,36,0.18)] px-4 py-2 text-sm font-semibold text-[#9a5524] hover:bg-[rgba(154,85,36,0.06)]"
                >
                  <Archive className="h-4 w-4" />
                  Archive
                </button>
              )}
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Package name</span>
                <input value={draft.name} onChange={(event) => updateDraft("name", event.target.value)} className={fieldClass} disabled={!canWrite} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Price</span>
                <input value={draft.pricePounds} onChange={(event) => updateDraft("pricePounds", event.target.value)} className={fieldClass} disabled={!canWrite} placeholder="395" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Billing frequency</span>
                <select value={draft.billingFrequency} onChange={(event) => updateDraft("billingFrequency", event.target.value as PackageBillingFrequency)} className={fieldClass} disabled={!canWrite}>
                  <option value="one_off">One-off</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="annual">Annual</option>
                  <option value="bespoke">Bespoke</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Setup fee</span>
                <input value={draft.setupFeePounds} onChange={(event) => updateDraft("setupFeePounds", event.target.value)} className={fieldClass} disabled={!canWrite} placeholder="0" />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Status</span>
                <select value={draft.status} onChange={(event) => updateDraft("status", event.target.value as PackageStatus)} className={fieldClass} disabled={!canWrite}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                  <option value="archived">Archived</option>
                </select>
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Currency</span>
                <input value={draft.currency} onChange={(event) => updateDraft("currency", event.target.value)} className={fieldClass} disabled={!canWrite} maxLength={3} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-semibold text-[#344446]">Sort order</span>
                <input value={draft.sortOrder} onChange={(event) => updateDraft("sortOrder", event.target.value)} className={fieldClass} disabled={!canWrite} />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Included features</span>
                <textarea value={draft.includedFeaturesText} onChange={(event) => updateDraft("includedFeaturesText", event.target.value)} rows={5} className={fieldClass} disabled={!canWrite} placeholder="One feature per line" />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Proposal wording</span>
                <textarea value={draft.proposalWording} onChange={(event) => updateDraft("proposalWording", event.target.value)} rows={5} className={fieldClass} disabled={!canWrite} />
              </label>
              <label className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-semibold text-[#344446]">Internal notes</span>
                <textarea value={draft.internalNotes} onChange={(event) => updateDraft("internalNotes", event.target.value)} rows={4} className={fieldClass} disabled={!canWrite} />
              </label>
            </div>

            <div className="mt-6 flex justify-end">
              <button type="submit" disabled={!canWrite || isSaving} className="btn-primary inline-flex items-center gap-2 text-sm">
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save package
              </button>
            </div>
          </Card>
        </form>
      </div>
    </div>
  );
}
