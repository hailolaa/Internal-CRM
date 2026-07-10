"use client";

import {
  Plus,
  X,
  MoreHorizontal,
  Phone,
  Mail,
  Clock,
  Download,
  Filter,
  Loader2,
  Search,
  Settings,
  ArrowUpRight,
  AlertTriangle,
  CheckCircle,
  Info,
  Target,
  UserRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { parseCurrency } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type {
  ContactRecord,
  PipelineDealRecord,
  PipelineStageRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  dedupePipelineStages,
  getPipelineStageKey,
} from "@/lib/pipeline-stage-normalization";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";
import { AlertBanner, PageHeader, PipelineSkeleton } from "@/components/ui";

type PipelineDealData = {
  id: string;
  name: string;
  value: string;
  treatment: string;
  source: string;
  daysInStage: number;
  avatar: string;
  email: string;
  phone: string;
  raw: PipelineDealRecord;
};

type PipelineStageData = {
  id: string;
  name: string;
  color: string;
  deals: PipelineDealData[];
  mergedStageIds: string[];
  raw: PipelineStageRecord;
};

type AddDealForm = {
  contactId: string;
  expectedCloseDate: string;
  probability: string;
  search: string;
  source: string;
  stageId: string;
  title: string;
  treatment: string;
  value: string;
};

const EMPTY_ADD_DEAL_FORM: AddDealForm = {
  contactId: "",
  expectedCloseDate: "",
  probability: "50",
  search: "",
  source: "",
  stageId: "",
  title: "",
  treatment: "",
  value: "",
};

function formatMoneyFromCents(valueCents: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(valueCents / 100);
}

function formatContactValue(value: number) {
  if (!value) return "";
  return String(Math.round(value));
}

function colorClass(color: string) {
  if (color.startsWith("bg-")) return color;
  const normalized = color.toLowerCase();
  if (normalized.includes("red")) return "bg-red-500";
  if (normalized.includes("green")) return "bg-green-500";
  if (normalized.includes("amber") || normalized.includes("yellow")) {
    return "bg-amber-500";
  }
  if (normalized.includes("purple")) return "bg-purple-500";
  if (normalized.includes("cyan")) return "bg-cyan-500";
  return "bg-blue-500";
}

function toPipelineDeal(deal: PipelineDealRecord): PipelineDealData {
  return {
    id: deal.id,
    name: deal.contactName || deal.title,
    value: formatMoneyFromCents(deal.valueCents),
    treatment: deal.treatment || deal.title,
    source: deal.source || "Unknown",
    daysInStage: deal.daysInStage,
    avatar: deal.contactAvatar,
    email: deal.contactEmail || "-",
    phone: deal.contactPhone || "-",
    raw: deal,
  };
}

function toPipelineStages(
  stages: PipelineStageRecord[],
  deals: PipelineDealRecord[],
): PipelineStageData[] {
  return dedupePipelineStages(stages)
    .map((stage) => {
      const mergedStageIds = new Set(stage.mergedStageIds);
      const stageKey = getPipelineStageKey(stage.name);

      return {
        id: stage.id,
        name: stage.name,
        color: colorClass(stage.color),
        mergedStageIds: stage.mergedStageIds,
        raw: stage,
        deals: deals
          .filter(
            (deal) =>
              (deal.stageId ? mergedStageIds.has(deal.stageId) : false)
              || getPipelineStageKey(deal.stageName || "") === stageKey,
          )
          .map(toPipelineDeal),
      };
    });
}

// ============================================================
// DealCard
// ============================================================
// The card itself is an interactive element (click to expand).
// It also contains nested <button> elements (Call, Email, Move).
//
// WHY NOT <button> AS OUTER WRAPPER:
// Using <button> as the outer wrapper would create invalid nested
// interactive elements (<button> inside <button>), which violates
// the HTML spec and breaks keyboard/AT behaviour in all browsers.
//
// ACCESSIBLE ALTERNATIVE USED:
// Outer element is a <div> with:
//   - role="button"       → announces as button to screen readers
//   - tabIndex={0}        → keyboard focusable
//   - aria-expanded       → communicates expanded/collapsed state
//   - aria-label          → describes the card content
//   - onKeyDown           → handles Enter and Space activation
//   - focus-visible ring  → visible keyboard focus indicator
//
// Inner action buttons remain as <button> elements and receive
// focus independently - this is the correct pattern for "card with
// actions" (ARIA APG: https://www.w3.org/WAI/ARIA/apg/patterns/).
// ============================================================

function DealCard({
  deal,
  isSelected,
  isMoving,
  onClick,
  onMoveNext,
}: {
  deal: PipelineDealData;
  isSelected: boolean;
  isMoving: boolean;
  onClick: () => void;
  onMoveNext: (deal: PipelineDealData) => void;
}) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick();
    }
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isSelected}
      aria-label={`Opportunity: ${deal.name} - ${deal.treatment}, ${deal.value}. ${isSelected ? "Expanded. Press Enter to collapse." : "Press Enter to expand."}`}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`bg-[#FFFCF9] border rounded-2xl p-4 cursor-pointer transition-all hover:scale-[1.02] focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F5] ${
        isSelected
          ? "border-[#6E6AE8]/40 shadow-sm"
          : "border-[rgba(0,0,0,0.06)] hover:border-[#6E6AE8]/25"
      }`}
      style={
        isSelected ? { boxShadow: "0 0 0 3px rgba(110,106,232,0.10)" } : {}
      }
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#6E6AE8] to-[#9B8FEF] flex items-center justify-center text-xs font-medium text-white">
            {deal.avatar}
          </div>
          <div>
            <span className="font-medium text-sm text-[#111111] block">
              {deal.name}
            </span>
            <span className="text-xs text-[#6B7280]">{deal.treatment}</span>
          </div>
        </div>
        <span className="font-bold text-[#6E6AE8]">{deal.value}</span>
      </div>

      <div className="flex items-center justify-between text-xs text-[#6B7280] mb-3">
        <span className="bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] px-2 py-0.5 rounded-md">
          {deal.source}
        </span>
        <span className="flex items-center gap-1">
          <Clock className="w-3 h-3" /> {deal.daysInStage}d in stage
        </span>
      </div>

      {isSelected && (
        <div className="pt-3 border-t border-[rgba(0,0,0,0.06)] space-y-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <Mail className="w-3 h-3" /> {deal.email}
          </div>
          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <Phone className="w-3 h-3" /> {deal.phone}
          </div>
        </div>
      )}

      {/* Action buttons - real <button> elements, not nested inside a <button> */}
      <div className="flex gap-2 mt-3 pt-3 border-t border-[rgba(0,0,0,0.05)]">
        <a
          href={deal.raw.contactPhone ? `tel:${deal.raw.contactPhone}` : undefined}
          aria-label={`Call ${deal.name}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`flex-1 py-2 text-xs bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl hover:bg-[#F0EEF8] text-[#6B7280] hover:text-[#6E6AE8] flex items-center justify-center gap-1 transition-colors ${deal.raw.contactPhone ? "" : "pointer-events-none opacity-50"}`}
        >
          <Phone className="w-3 h-3" /> Call
        </a>
        <a
          href={deal.raw.contactEmail ? `mailto:${deal.raw.contactEmail}` : undefined}
          aria-label={`Email ${deal.name}`}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className={`flex-1 py-2 text-xs bg-[#FAF8F5] border border-[rgba(0,0,0,0.06)] rounded-xl hover:bg-[#F0EEF8] text-[#6B7280] hover:text-[#6E6AE8] flex items-center justify-center gap-1 transition-colors ${deal.raw.contactEmail ? "" : "pointer-events-none opacity-50"}`}
        >
          <Mail className="w-3 h-3" /> Email
        </a>
        <button
          aria-label={`Move ${deal.name} to next stage`}
          disabled={isMoving}
          onClick={(e) => {
            e.stopPropagation();
            onMoveNext(deal);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="flex-1 py-2 text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] rounded-xl hover:bg-[rgba(110,106,232,0.15)] flex items-center justify-center gap-1 transition-colors disabled:opacity-60"
        >
          <ArrowUpRight className="w-3 h-3" /> {isMoving ? "Moving" : "Move"}
        </button>
      </div>
    </div>
  );
}

function AddDealModal({
  contacts,
  contactsError,
  contactsLoading,
  form,
  isCreating,
  onClose,
  onCreate,
  onRefreshContacts,
  onSelectContact,
  onUpdateForm,
  stages,
}: {
  contacts: ContactRecord[];
  contactsError: string;
  contactsLoading: boolean;
  form: AddDealForm;
  isCreating: boolean;
  onClose: () => void;
  onCreate: () => void;
  onRefreshContacts: () => void;
  onSelectContact: (contact: ContactRecord) => void;
  onUpdateForm: (patch: Partial<AddDealForm>) => void;
  stages: PipelineStageData[];
}) {
  const selectedContact = contacts.find((contact) => contact.id === form.contactId);
  const query = form.search.trim().toLowerCase();
  const visibleContacts = contacts
    .filter((contact) => {
      if (!query) return true;
      return (
        contact.name.toLowerCase().includes(query) ||
        (contact.email || "").toLowerCase().includes(query) ||
        (contact.phone || "").toLowerCase().includes(query) ||
        (contact.source || "").toLowerCase().includes(query)
      );
    })
    .slice(0, 8);

  return (
    <div
      data-gsap-overlay
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-deal-title"
    >
      <div
        data-gsap-popover
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-[rgba(0,0,0,0.08)] bg-[#FFFCF9] shadow-2xl"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] px-5 py-4">
          <div>
            <h2 id="add-deal-title" className="text-lg font-semibold text-[#111111]">
              Add Opportunity
            </h2>
            <p className="text-xs text-[#6B7280]">
              Select an existing prospect/contact and create a sales opportunity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-[#6B7280] transition-colors hover:bg-[#F0EEF8] hover:text-[#6E6AE8]"
            aria-label="Close add opportunity"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-5 p-5 lg:grid-cols-[1fr_1.1fr]">
          <div className="space-y-3">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Contact
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6B7280]" />
                <input
                  value={form.search}
                  onChange={(event) => onUpdateForm({ search: event.target.value })}
                  placeholder="Search contacts..."
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] py-2.5 pl-10 pr-3 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
            </div>

            {contactsError && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {contactsError}
              </div>
            )}

            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {contactsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 4 }, (_, index) => (
                    <div
                      key={index}
                      className="h-16 animate-pulse rounded-xl bg-[rgba(110,106,232,0.08)]"
                    />
                  ))}
                </div>
              ) : visibleContacts.length > 0 ? (
                visibleContacts.map((contact) => (
                  <button
                    key={contact.id}
                    type="button"
                    onClick={() => onSelectContact(contact)}
                    className={`w-full rounded-xl border p-3 text-left transition-colors ${
                      form.contactId === contact.id
                        ? "border-[#6E6AE8]/50 bg-[rgba(110,106,232,0.08)]"
                        : "border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] hover:border-[#6E6AE8]/30"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#6E6AE8] text-xs font-medium text-white">
                        {contact.name
                          .split(" ")
                          .map((part) => part[0])
                          .join("")
                          .slice(0, 2)
                          .toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#111111]">
                          {contact.name}
                        </p>
                        <p className="truncate text-xs text-[#6B7280]">
                          {contact.email || contact.phone || "No contact method"}
                        </p>
                        <p className="mt-1 text-xs text-[#6B7280]">
                          {contact.source || "Unknown source"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-xl border border-dashed border-[rgba(0,0,0,0.10)] px-4 py-8 text-center text-sm text-[#6B7280]">
                  No contacts match this search.
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={onRefreshContacts}
              disabled={contactsLoading}
              className="text-xs font-medium text-[#6E6AE8] disabled:opacity-60"
            >
              {contactsLoading ? "Loading contacts..." : "Refresh contacts"}
            </button>
          </div>

          <div className="space-y-4">
            {selectedContact && (
              <div className="rounded-xl border border-[rgba(110,106,232,0.18)] bg-[rgba(110,106,232,0.06)] p-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#111111]">
                  <UserRound className="h-4 w-4 text-[#6E6AE8]" />
                  {selectedContact.name}
                </div>
                <p className="mt-1 text-xs text-[#6B7280]">
                  {selectedContact.email || selectedContact.phone || "No contact method"}
                </p>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Stage
              </label>
              <select
                value={form.stageId}
                onChange={(event) => onUpdateForm({ stageId: event.target.value })}
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              >
                {stages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Deal title
              </label>
              <input
                value={form.title}
                onChange={(event) => onUpdateForm({ title: event.target.value })}
                placeholder="Website build, SEO campaign, or proposal"
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                  Value
                </label>
                <input
                  value={form.value}
                  onChange={(event) => onUpdateForm({ value: event.target.value })}
                  placeholder="350"
                  inputMode="decimal"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                  Probability
                </label>
                <input
                  value={form.probability}
                  onChange={(event) =>
                    onUpdateForm({ probability: event.target.value })
                  }
                  placeholder="50"
                  inputMode="numeric"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                  Source
                </label>
                <input
                  value={form.source}
                  onChange={(event) => onUpdateForm({ source: event.target.value })}
                  placeholder="Website"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                  Service / Package
                </label>
                <input
                  value={form.treatment}
                  onChange={(event) =>
                    onUpdateForm({ treatment: event.target.value })
                  }
                  placeholder="Website build"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-[#111111]">
                Expected close date
              </label>
              <input
                type="date"
                value={form.expectedCloseDate}
                onChange={(event) =>
                  onUpdateForm({ expectedCloseDate: event.target.value })
                }
                className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
              />
            </div>
          </div>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-[rgba(0,0,0,0.06)] px-5 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-4 py-2.5 text-sm font-medium text-[#6B7280] transition-colors hover:bg-[#F0EEF8]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onCreate}
            disabled={isCreating || contactsLoading || !form.contactId}
            className="rounded-xl bg-[#6E6AE8] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="inline-flex items-center gap-2">
              {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
              {isCreating ? "Creating..." : "Create Opportunity"}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PipelinePage() {
  const router = useRouter();
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canWriteContacts = hasPermission("contacts:write");
  const {
    exportCsv: exportPipelineCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    token,
    type: "pipeline",
  });
  const [selectedDeal, setSelectedDeal] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [stages, setStages] = useState<PipelineStageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [movingDealId, setMovingDealId] = useState<string | null>(null);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealForm, setAddDealForm] =
    useState<AddDealForm>(EMPTY_ADD_DEAL_FORM);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsError, setContactsError] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [isCreatingDeal, setIsCreatingDeal] = useState(false);

  const fetchPipeline = useCallback(async () => {
    if (!token) return [];
    const [stageRecords, dealResult] = await Promise.all([
      api.pipelineStages.list(token),
      api.pipelineDeals.list(token),
    ]);
    return toPipelineStages(stageRecords, dealResult.deals);
  }, [token]);

  const loadContacts = useCallback(async () => {
    if (!token) return;
    setContactsLoading(true);
    setContactsError("");
    try {
      const result = await api.contacts.list(token, {
        page: 1,
        pageSize: 100,
        sortBy: "updatedAt",
        sortDir: "desc",
      });
      setContacts(result.contacts);
    } catch (error) {
      setContactsError(
        error instanceof Error
          ? error.message
          : "Unable to load contacts for deal creation.",
      );
      setContacts([]);
    } finally {
      setContactsLoading(false);
    }
  }, [token]);

  const openAddDeal = useCallback(
    (stageId?: string) => {
      if (!canWriteContacts) {
        setActionMessage("");
        setActionError("You do not have permission to create sales opportunities.");
        return;
      }

      const defaultStageId = stageId || stages[0]?.id || "";
      setAddDealForm({
        ...EMPTY_ADD_DEAL_FORM,
        stageId: defaultStageId,
      });
      setActionError("");
      setActionMessage("");
      setAddDealOpen(true);
      void loadContacts();
    },
    [canWriteContacts, loadContacts, stages],
  );

  const updateAddDealForm = useCallback((patch: Partial<AddDealForm>) => {
    setAddDealForm((current) => ({ ...current, ...patch }));
  }, []);

  const handleSelectContact = useCallback((contact: ContactRecord) => {
    setAddDealForm((current) => ({
      ...current,
      contactId: contact.id,
      source: current.source || contact.source || "",
      title: current.title || `${contact.name} opportunity`,
      treatment:
        current.treatment ||
        contact.treatmentInterests[0] ||
        contact.tags[0] ||
        "",
      value: current.value || formatContactValue(contact.value),
    }));
  }, []);

  const handleCreateDeal = useCallback(async () => {
    if (!token || !canWriteContacts) return;

    if (!addDealForm.contactId) {
      setActionMessage("");
      setActionError("Select an existing prospect/contact before creating an opportunity.");
      return;
    }

    const numericValue = Number(addDealForm.value.replace(/[^\d.]/g, ""));
    const probability = Number(addDealForm.probability.replace(/[^\d.]/g, ""));

    setIsCreatingDeal(true);
    setActionError("");
    setActionMessage("");
    try {
      await api.pipelineDeals.create(token, {
        contactId: addDealForm.contactId,
        expectedCloseDate: addDealForm.expectedCloseDate || null,
        probability: Number.isFinite(probability)
          ? Math.min(Math.max(probability, 0), 100)
          : null,
        source: addDealForm.source.trim() || null,
        stageId: addDealForm.stageId || null,
        title: addDealForm.title.trim() || null,
        treatment: addDealForm.treatment.trim() || null,
        valueCents: Number.isFinite(numericValue)
          ? Math.round(numericValue * 100)
          : null,
      });
      const rows = await fetchPipeline();
      setStages(rows);
      setAddDealOpen(false);
      setActionMessage("Sales opportunity created.");
    } catch (error) {
      setActionError(
          error instanceof Error ? error.message : "Could not create the sales opportunity.",
      );
    } finally {
      setIsCreatingDeal(false);
    }
  }, [addDealForm, canWriteContacts, fetchPipeline, token]);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    fetchPipeline()
      .then((rows) => {
        if (!isMounted) return;
        setStages(rows);
        setLoadError("");
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load the sales pipeline from the backend.",
        );
        setStages([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [fetchPipeline, token]);

  const handleMoveNext = useCallback(
    async (deal: PipelineDealData) => {
      if (!token) return;
      const orderedStages = stages.slice().sort((a, b) => a.raw.position - b.raw.position);
      const currentStageKey = getPipelineStageKey(deal.raw.stageName || "");
      const currentIndex = orderedStages.findIndex(
        (stage) =>
          stage.id === deal.raw.stageId ||
          stage.mergedStageIds.includes(deal.raw.stageId || "") ||
          (!!currentStageKey && getPipelineStageKey(stage.name) === currentStageKey),
      );
      const nextStage = orderedStages[currentIndex + 1];

      if (currentIndex === -1 || !nextStage) {
        setActionError(`${deal.name} is already in the final sales stage.`);
        setActionMessage("");
        return;
      }

      setMovingDealId(deal.id);
      setActionError("");
        setActionMessage("");
      try {
        await api.pipelineDeals.move(token, deal.id, { stageId: nextStage.id });
        const rows = await fetchPipeline();
        setStages(rows);
        setSelectedDeal(null);
        setActionMessage(`${deal.name} moved to ${nextStage.name}.`);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not move sales opportunity.",
        );
      } finally {
        setMovingDealId(null);
      }
    },
    [fetchPipeline, stages, token],
  );

  const showNotIntegrated = useCallback((message: string) => {
    setActionMessage("");
    setActionError(message);
  }, []);

  const filteredStages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return stages;
    return stages.map((stage) => ({
      ...stage,
      deals: stage.deals.filter(
        (deal) =>
          deal.name.toLowerCase().includes(query) ||
          deal.treatment.toLowerCase().includes(query) ||
          deal.source.toLowerCase().includes(query),
      ),
    }));
  }, [searchQuery, stages]);

  const totalValue = stages.reduce(
    (acc, stage) =>
      acc +
      stage.deals.reduce((sum, deal) => sum + parseCurrency(deal.value), 0),
    0,
  );
  const dealsCount = stages.reduce(
    (acc, s) => acc + s.deals.length,
    0,
  );
  const avgDealValue = dealsCount > 0 ? Math.round(totalValue / dealsCount) : 0;

  return (
    <div className="space-y-6 h-full">
      <PageHeader
        title="Sales Pipeline"
        subtitle="Track prospects from enquiry through discovery, proposal, won, or lost."
        icon={Target}
        right={
          <div className="flex flex-wrap items-center justify-end gap-3">
          <div className="text-right hidden sm:block">
            <p className="text-2xl font-bold text-[#6E6AE8]">
              GBP {totalValue.toLocaleString()}
            </p>
            <p className="text-xs text-[#6B7280]">
              {dealsCount} active opportunities - GBP {avgDealValue} avg
            </p>
          </div>
          <button
            type="button"
            onClick={() => void exportPipelineCsv()}
            disabled={!token || isExporting}
            className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] hover:bg-[#F0EEF8] text-[#6B7280] hover:text-[#6E6AE8] font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Download className="w-4 h-4" />
            )}
            {isExporting ? "Exporting..." : "Export CSV"}
          </button>
          <button
            onClick={() => openAddDeal()}
            disabled={!canWriteContacts}
            className="bg-[#6E6AE8] hover:bg-[#5A56D4] text-white font-medium px-4 py-2.5 rounded-xl flex items-center gap-2 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="w-4 h-4" /> Add Opportunity
          </button>
          </div>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Sales pipeline could not be loaded"
          description={loadError}
          variant="warning"
        />
      )}

      {actionMessage && (
        <AlertBanner icon={CheckCircle} title={actionMessage} variant="success" />
      )}

      {actionError && (
        <AlertBanner
          icon={Info}
          title="Pipeline action note"
          description={actionError}
          variant="info"
        />
      )}

      {exportStatus && (
        <AlertBanner
          icon={exportStatus.tone === "success" ? CheckCircle : AlertTriangle}
          title="Pipeline export"
          description={exportStatus.message}
          variant={
            exportStatus.tone === "success"
              ? "success"
              : exportStatus.tone === "warning"
                ? "warning"
                : "error"
          }
        />
      )}

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stages.map((stage) => {
          const stageValue = stage.deals.reduce(
            (sum, deal) => sum + parseCurrency(deal.value),
            0,
          );
          return (
            <div
              key={stage.id}
              className="bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-2xl p-3 shadow-sm"
            >
              <div className="flex items-center gap-2 mb-1">
                <div className={`w-2 h-2 rounded-full ${stage.color}`} />
                <span className="text-sm font-medium text-[#111111]">
                  {stage.name}
                </span>
              </div>
              <p className="text-lg font-bold text-[#111111]">
                GBP {stageValue.toLocaleString()}
              </p>
              <p className="text-xs text-[#6B7280]">
                {stage.deals.length} opportunities
              </p>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search opportunities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl pl-10 pr-4 py-2.5 text-sm text-[#111111] placeholder:text-[#6B7280] focus:outline-none focus:border-[#6E6AE8]/50"
            style={
              {
                "--tw-ring-color": "rgba(110,106,232,0.35)",
              } as React.CSSProperties
            }
          />
        </div>
        <div className="flex gap-2">
          <button
            aria-label="Filter opportunities"
            onClick={() =>
              showNotIntegrated(
                "Advanced pipeline filters are not integrated yet. Search is live on the currently loaded opportunities.",
              )
            }
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl hover:bg-[#F0EEF8] text-[#6B7280] hover:text-[#6E6AE8] text-sm transition-colors"
          >
            <Filter className="w-4 h-4" /> Filter
          </button>
          <button
            aria-label="Configure pipeline stages"
            onClick={() => router.push("/app/crm/pipeline/settings")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl hover:bg-[#F0EEF8] text-[#6B7280] hover:text-[#6E6AE8] text-sm transition-colors"
          >
            <Settings className="w-4 h-4" /> Stages
          </button>
        </div>
      </div>

      {isLoading ? (
        <PipelineSkeleton columns={5} />
      ) : (
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0">
        {filteredStages.map((stage) => (
          <div key={stage.id} className="flex-shrink-0 w-72 md:w-80">
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-sm text-[#111111]">
                  {stage.name}
                </h3>
                <span className="text-xs text-[#6B7280] bg-[rgba(110,106,232,0.08)] px-2 py-0.5 rounded-full">
                  {stage.deals.length}
                </span>
              </div>
              <button
                aria-label={`More options for ${stage.name} stage`}
                onClick={() => router.push("/app/crm/pipeline/settings")}
                className="p-1 rounded-lg hover:bg-[rgba(110,106,232,0.08)] transition-colors"
              >
                <MoreHorizontal className="w-4 h-4 text-[#6B7280]" />
              </button>
            </div>
            <div className="space-y-3">
              {stage.deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  isSelected={selectedDeal === deal.id}
                  isMoving={movingDealId === deal.id}
                  onClick={() =>
                    setSelectedDeal(selectedDeal === deal.id ? null : deal.id)
                  }
                  onMoveNext={handleMoveNext}
                />
              ))}
              <button
                onClick={() => openAddDeal(stage.id)}
                disabled={!canWriteContacts}
                className="w-full py-3 border border-dashed border-[rgba(0,0,0,0.10)] rounded-2xl text-sm text-[#6B7280] hover:border-[#6E6AE8]/30 hover:text-[#6E6AE8] transition-colors flex items-center justify-center gap-2 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Plus className="w-4 h-4" /> Add opportunity
              </button>
            </div>
          </div>
        ))}
        {filteredStages.length === 0 && (
          <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-6 text-sm text-[#6B7280]">
            No pipeline stages loaded yet.
          </div>
        )}
      </div>
      )}

      {addDealOpen && (
        <AddDealModal
          contacts={contacts}
          contactsError={contactsError}
          contactsLoading={contactsLoading}
          form={addDealForm}
          isCreating={isCreatingDeal}
          onClose={() => setAddDealOpen(false)}
          onCreate={() => void handleCreateDeal()}
          onRefreshContacts={() => void loadContacts()}
          onSelectContact={handleSelectContact}
          onUpdateForm={updateAddDealForm}
          stages={stages}
        />
      )}
    </div>
  );
}
