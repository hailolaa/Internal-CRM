"use client";

import {
  Plus,
  X,
  MoreHorizontal,
  Phone,
  Mail,
  Clock,
  Download,
  Loader2,
  Search,
  Settings,
  ArrowLeft,
  ArrowRight,
  AlertTriangle,
  CheckCircle,
  GripVertical,
  Info,
  Target,
  Trash2,
  UserRound,
  LayoutGrid,
  List,
  ExternalLink,
  FileText,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { parseCurrency } from "@/lib/utils";
import { api } from "@/lib/api-client";
import type {
  ContactRecord,
  PipelineDealRecord,
  PipelineStageRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  calculateLeadPriority,
  leadPriorityBadgeClass,
  type LeadPriorityResult,
} from "@/lib/lead-priority";
import { DashboardReturnLink } from "@/components/dashboard-return-link";
import {
  dedupePipelineStages,
  getPipelineStageKey,
} from "@/lib/pipeline-stage-normalization";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";
import { AlertBanner, PageHeader, PipelineSkeleton } from "@/components/ui";
import {
  SALES_LOSS_REASON_OPTIONS,
  SALES_OBJECTION_TYPE_OPTIONS,
  salesOutcomeLabel,
} from "@/lib/sales-outcomes";

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
  owner: string;
  nextFollowUpDate: string | null;
  priority: "low" | "medium" | "high" | null;
  leadPriority: LeadPriorityResult;
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

type PendingLostMove = {
  deal: PipelineDealData;
  targetStage: PipelineStageData;
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

const DEFAULT_LOST_REASON = SALES_LOSS_REASON_OPTIONS[0].value;
const DEFAULT_OBJECTION_TYPE = SALES_OBJECTION_TYPE_OPTIONS[0].value;

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

function formatFollowUpDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T00:00:00`));
}

function isFollowUpOverdue(value: string | null) {
  if (!value) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(`${value}T00:00:00`).getTime() < today.getTime();
}

const PRIORITY_STYLES = {
  low: "bg-slate-100 text-slate-600",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
} as const;

const AUDIT_STATUS_LABELS: Record<string, string> = {
  audit_requested: "Audit requested",
  audit_assigned: "Audit assigned",
  audit_started: "Audit started",
  audit_completed: "Audit completed",
  growth_score_created: "Growth Score created",
  dashboard_access_given: "Dashboard access given",
  audit_sent: "Audit sent",
  follow_up_due: "Follow-up due",
};

function formatAuditStatus(value: string | null | undefined) {
  return value ? AUDIT_STATUS_LABELS[value] || value.replace(/_/g, " ") : null;
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
  const leadPriority = calculateLeadPriority({
    accountName: deal.title,
    auditOverdue: isFollowUpOverdue(deal.auditFollowUpDueAt ? deal.auditFollowUpDueAt.slice(0, 10) : null),
    auditStatus: deal.auditStatus,
    followUpOverdue: isFollowUpOverdue(deal.expectedCloseDate),
    packageInterest: deal.treatment,
    source: deal.source,
    stage: deal.stageName,
    status: deal.status,
  });

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
    owner: deal.ownerName || "Unassigned",
    nextFollowUpDate: deal.nextFollowUpDate,
    priority: deal.priority,
    leadPriority,
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
// The card itself is an interactive element (click to open the contact).
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
  isRemoving,
  canEdit,
  canMovePrevious,
  canMoveNext,
  onClick,
  onDragEnd,
  onDragStart,
  onMovePrevious,
  onMoveNext,
  onRemove,
  onCreateProposal,
}: {
  deal: PipelineDealData;
  isSelected: boolean;
  isMoving: boolean;
  isRemoving: boolean;
  canEdit: boolean;
  canMovePrevious: boolean;
  canMoveNext: boolean;
  onClick: () => void;
  onDragEnd: () => void;
  onDragStart: (event: React.DragEvent<HTMLDivElement>) => void;
  onMovePrevious: (deal: PipelineDealData) => void;
  onMoveNext: (deal: PipelineDealData) => void;
  onRemove: (deal: PipelineDealData) => void;
  onCreateProposal: (deal: PipelineDealData) => void;
}) {
  const followUpOverdue = isFollowUpOverdue(deal.nextFollowUpDate);
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
      aria-label={`Open contact ${deal.name}. Opportunity: ${deal.treatment}, ${deal.value}.`}
      draggable={canEdit && !isMoving}
      onClick={onClick}
      onDragEnd={onDragEnd}
      onDragStart={onDragStart}
      onKeyDown={handleKeyDown}
      className={`bg-[#FFFCF9] border rounded-2xl p-4 cursor-grab transition-all hover:scale-[1.02] active:cursor-grabbing focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#FAF8F5] ${
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
          <GripVertical className="h-4 w-4 shrink-0 text-[#9CA3AF]" aria-hidden="true" />
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

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-[#FAF8F5] px-2 py-1.5 text-[#6B7280]">
          <UserRound className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.owner}</span>
        </div>
        <div
          className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 ${
            followUpOverdue
              ? "bg-red-50 font-medium text-red-700 ring-1 ring-red-200"
              : "bg-[#FAF8F5] text-[#6B7280]"
          }`}
        >
          {followUpOverdue ? (
            <AlertTriangle className="h-3 w-3 shrink-0" />
          ) : (
            <Clock className="h-3 w-3 shrink-0" />
          )}
          <span className="truncate">
            {deal.nextFollowUpDate
              ? `${followUpOverdue ? "Overdue" : "Follow-up"} ${formatFollowUpDate(deal.nextFollowUpDate)}`
              : "No follow-up"}
          </span>
        </div>
      </div>

      <div className="mt-2 flex justify-end">
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-medium capitalize ${
            deal.priority ? PRIORITY_STYLES[deal.priority] : "bg-slate-100 text-slate-500"
          }`}
        >
          {deal.priority ? `${deal.priority} priority` : "No priority"}
        </span>
      </div>

      <div className="mt-2 flex justify-end">
        <span
          title={deal.leadPriority.reasons.join("; ")}
          className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${leadPriorityBadgeClass(deal.leadPriority.tier)}`}
        >
          {deal.leadPriority.score} {deal.leadPriority.label}
        </span>
      </div>

      {formatAuditStatus(deal.raw.auditStatus) && (
        <div className="mt-2 rounded-lg border border-violet-100 bg-violet-50 px-2 py-1.5 text-xs text-violet-700">
          <span className="font-semibold">{formatAuditStatus(deal.raw.auditStatus)}</span>
          {deal.raw.auditFollowUpDueAt ? (
            <span className="ml-1 text-violet-600">
              due {new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(deal.raw.auditFollowUpDueAt))}
            </span>
          ) : null}
        </div>
      )}

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
      <div className="grid grid-cols-2 gap-2 mt-3 pt-3 border-t border-[rgba(0,0,0,0.05)]">
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
          aria-label={`Move ${deal.name} to previous stage`}
          disabled={isMoving || !canMovePrevious}
          onClick={(e) => {
            e.stopPropagation();
            onMovePrevious(deal);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="py-2 text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] rounded-xl hover:bg-[rgba(110,106,232,0.15)] flex items-center justify-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowLeft className="w-3 h-3" /> Back
        </button>
        <button
          aria-label={`Move ${deal.name} to next stage`}
          disabled={isMoving || !canMoveNext}
          onClick={(e) => {
            e.stopPropagation();
            onMoveNext(deal);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="py-2 text-xs bg-[rgba(110,106,232,0.08)] text-[#6E6AE8] rounded-xl hover:bg-[rgba(110,106,232,0.15)] flex items-center justify-center gap-1 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ArrowRight className="w-3 h-3" /> {isMoving ? "Moving" : "Next"}
        </button>
        <button
          aria-label={`Create proposal for ${deal.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onCreateProposal(deal);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="col-span-2 flex items-center justify-center gap-1 rounded-xl bg-[#315f51] py-2 text-xs font-semibold text-white transition-colors hover:bg-[#24483d]"
        >
          <FileText className="h-3 w-3" />
          Create proposal
        </button>
        <button
          aria-label={`Remove ${deal.name} from pipeline`}
          disabled={isMoving || isRemoving}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(deal);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="col-span-2 flex items-center justify-center gap-1 rounded-xl bg-red-50 py-2 text-xs text-red-700 transition-colors hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isRemoving ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <Trash2 className="h-3 w-3" />
          )}
          {isRemoving ? "Removing" : "Remove from pipeline"}
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
  packageOptions,
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
  packageOptions: string[];
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
                  list="pipeline-package-options"
                  placeholder="Website build"
                  className="w-full rounded-xl border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-3 py-2.5 text-sm text-[#111111] outline-none focus:border-[#6E6AE8]/50"
                />
                <datalist id="pipeline-package-options">
                  {packageOptions.map((packageName) => (
                    <option key={packageName} value={packageName} />
                  ))}
                </datalist>
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
  const searchParams = useSearchParams();
  const requestedStatus = searchParams.get("status");
  const requestedStage = searchParams.get("stage");
  const requestedDeal = searchParams.get("deal");
  const requestedContactId = searchParams.get("contactId");
  const requestedView = searchParams.get("view");
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canWriteContacts = hasPermission("contacts:write");
  const canWriteClientAccounts = hasPermission("client_accounts:write");
  const {
    exportCsv: exportPipelineCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    token,
    type: "pipeline",
  });
  const [selectedDeal, setSelectedDeal] = useState<string | null>(requestedDeal);
  const [searchQuery, setSearchQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("attention");
  const [boardView, setBoardView] = useState<"kanban" | "list">("kanban");
  const [stages, setStages] = useState<PipelineStageData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [movingDealId, setMovingDealId] = useState<string | null>(null);
  const [convertingDealId, setConvertingDealId] = useState<string | null>(null);
  const [removingDealId, setRemovingDealId] = useState<string | null>(null);
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [pendingLostMove, setPendingLostMove] = useState<PendingLostMove | null>(null);
  const [lostReason, setLostReason] = useState<string>(DEFAULT_LOST_REASON);
  const [objectionType, setObjectionType] = useState<string>(DEFAULT_OBJECTION_TYPE);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const autoScrollSpeedRef = useRef(0);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealForm, setAddDealForm] =
    useState<AddDealForm>(EMPTY_ADD_DEAL_FORM);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [contactsError, setContactsError] = useState("");
  const [contactsLoading, setContactsLoading] = useState(false);
  const [packageOptions, setPackageOptions] = useState<string[]>([]);
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

  const orderedStages = useMemo(
    () => stages.slice().sort((a, b) => a.raw.position - b.raw.position),
    [stages],
  );

  const findDealStageIndex = useCallback(
    (deal: PipelineDealData) => {
      const currentStageKey = getPipelineStageKey(deal.raw.stageName || "");
      return orderedStages.findIndex(
        (stage) =>
          stage.id === deal.raw.stageId ||
          stage.mergedStageIds.includes(deal.raw.stageId || "") ||
          (!!currentStageKey && getPipelineStageKey(stage.name) === currentStageKey),
      );
    },
    [orderedStages],
  );

  const handleMoveToStage = useCallback(
    async (
      deal: PipelineDealData,
      targetStage: PipelineStageData,
      outcome?: { lostReason: string; objectionType: string },
    ) => {
      if (!token || !canWriteContacts || movingDealId) return;
      const currentIndex = findDealStageIndex(deal);
      const targetIndex = orderedStages.findIndex((stage) => stage.id === targetStage.id);

      if (currentIndex === -1 || targetIndex === -1 || currentIndex === targetIndex) return;

      if (targetStage.raw.kind === "lost" && !outcome) {
        setLostReason(deal.raw.lostReason || DEFAULT_LOST_REASON);
        setObjectionType(deal.raw.objectionType || DEFAULT_OBJECTION_TYPE);
        setPendingLostMove({ deal, targetStage });
        setActionMessage("");
        setActionError("");
        return;
      }

      let wonValueCents = deal.raw.valueCents;
      let wonTreatment = deal.raw.treatment?.trim() || "";
      if (targetStage.raw.kind === "won") {
        const valueInput = window.prompt(
          `Confirm the final deal value for ${deal.name} (£)`,
          wonValueCents > 0 ? String(wonValueCents / 100) : "",
        );
        if (valueInput === null) return;
        const numericValue = Number(valueInput.replace(/[^\d.]/g, ""));
        if (!Number.isFinite(numericValue) || numericValue <= 0) {
          setActionError("Enter a final deal value greater than £0 before marking an opportunity Won.");
          return;
        }
        wonValueCents = Math.round(numericValue * 100);

        if (!wonTreatment) {
          wonTreatment = window.prompt(
            `Which package or service did ${deal.name} purchase?`,
            deal.treatment === deal.raw.title ? "" : deal.treatment,
          )?.trim() || "";
          if (!wonTreatment) {
            setActionError("A package or service is required before marking an opportunity Won.");
            return;
          }
        }
      }

      const movePayload = {
        stageId: targetStage.id,
        ...(targetStage.raw.kind === "lost"
          ? {
              lostAt: new Date().toISOString(),
              lostReason: outcome?.lostReason || deal.raw.lostReason || DEFAULT_LOST_REASON,
              objectionType: outcome?.objectionType || deal.raw.objectionType || DEFAULT_OBJECTION_TYPE,
            }
          : {}),
        ...(targetStage.raw.kind === "won"
          ? { valueCents: wonValueCents, soldAt: new Date().toISOString() }
          : {}),
      };

      setMovingDealId(deal.id);
      setActionError("");
      setActionMessage("");
      const previousStages = stages;
      setStages((current) => current.map((stage) => ({
        ...stage,
        deals: stage.id === targetStage.id
          ? [...stage.deals, { ...deal, raw: { ...deal.raw, stageId: targetStage.id, stageName: targetStage.name, stageKind: targetStage.raw.kind } }]
          : stage.deals.filter((item) => item.id !== deal.id),
      })));
      try {
        if (targetStage.raw.kind === "won" && wonTreatment !== deal.raw.treatment) {
          await api.pipelineDeals.update(token, deal.id, { treatment: wonTreatment });
        }
        await api.pipelineDeals.move(token, deal.id, movePayload);
        const rows = await fetchPipeline();
        setStages(rows);
        setSelectedDeal(null);
        setPendingLostMove(null);
        setActionMessage(`${deal.name} moved to ${targetStage.name}.`);
      } catch (error) {
        setStages(previousStages);
        setActionError(
          error instanceof Error ? error.message : "Could not move sales opportunity.",
        );
      } finally {
        setMovingDealId(null);
      }
    },
    [canWriteContacts, fetchPipeline, findDealStageIndex, movingDealId, orderedStages, stages, token],
  );

  const handleMovePrevious = useCallback(
    (deal: PipelineDealData) => {
      const currentIndex = findDealStageIndex(deal);
      const previousStage = orderedStages[currentIndex - 1];
      if (previousStage) void handleMoveToStage(deal, previousStage);
    },
    [findDealStageIndex, handleMoveToStage, orderedStages],
  );

  const submitLostMove = useCallback(() => {
    if (!pendingLostMove) return;
    void handleMoveToStage(pendingLostMove.deal, pendingLostMove.targetStage, {
      lostReason,
      objectionType,
    });
  }, [handleMoveToStage, lostReason, objectionType, pendingLostMove]);

  const openProposalBuilder = useCallback((deal: PipelineDealData) => {
    const params = new URLSearchParams({
      dealId: deal.raw.id,
      contactId: deal.raw.contactId,
      accountName: deal.name,
      packageName: deal.treatment || "",
      proposalName: `${deal.raw.title || deal.name} proposal`,
    });
    router.push(`/app/crm/proposals/edit?${params.toString()}`);
  }, [router]);

  const handleConvertWonDeal = useCallback(async (deal: PipelineDealData) => {
    if (!token || !canWriteClientAccounts || convertingDealId) return;
    if (deal.raw.status !== "won" && deal.raw.stageKind !== "won") {
      setActionError("Only won opportunities can be converted to client accounts.");
      return;
    }

    const accountName = window.prompt("Client account name", deal.name);
    if (accountName === null) return;
    const trimmedAccountName = accountName.trim();
    if (!trimmedAccountName) {
      setActionError("Client account name is required.");
      return;
    }

    setConvertingDealId(deal.id);
    setActionError("");
    setActionMessage("");
    try {
      const account = await api.clientAccounts.convertWonDeal(token, {
        dealId: deal.raw.id,
        accountName: trimmedAccountName,
        currentPackage: deal.raw.treatment || null,
        activeServices: deal.raw.treatment ? [deal.raw.treatment] : undefined,
        clientStatus: "onboarding",
        onboardingStatus: "in_progress",
        healthStatus: "attention_needed",
        contractStatus: "pending",
        createOnboardingTasks: true,
      });
      const rows = await fetchPipeline();
      setStages(rows);
      setSelectedDeal(null);
      setActionMessage(`${deal.name} converted to client account: ${account.clinicName}.`);
      router.push(`/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}`);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Could not convert won opportunity to a client.");
    } finally {
      setConvertingDealId(null);
    }
  }, [canWriteClientAccounts, convertingDealId, fetchPipeline, router, token]);

  const handleRemoveDeal = useCallback(
    async (deal: PipelineDealData) => {
      if (!token || !canWriteContacts || removingDealId) return;
      if (!window.confirm(`Remove ${deal.name} from the sales pipeline?`)) return;

      setRemovingDealId(deal.id);
      setActionError("");
      setActionMessage("");
      try {
        await api.pipelineDeals.remove(token, deal.id);
        setStages((current) =>
          current.map((stage) => ({
            ...stage,
            deals: stage.deals.filter((item) => item.id !== deal.id),
          })),
        );
        setSelectedDeal(null);
        setActionMessage(`${deal.name} removed from the sales pipeline.`);
      } catch (error) {
        setActionError(
          error instanceof Error ? error.message : "Could not remove sales opportunity.",
        );
      } finally {
        setRemovingDealId(null);
      }
    },
    [canWriteContacts, removingDealId, token],
  );

  const handleMoveNext = useCallback(
    (deal: PipelineDealData) => {
      const currentIndex = findDealStageIndex(deal);
      const nextStage = orderedStages[currentIndex + 1];
      if (nextStage) void handleMoveToStage(deal, nextStage);
    },
    [findDealStageIndex, handleMoveToStage, orderedStages],
  );

  const handleDrop = useCallback(
    (targetStage: PipelineStageData) => {
      const deal = stages.flatMap((stage) => stage.deals).find((item) => item.id === draggedDealId);
      setDraggedDealId(null);
      setDragOverStageId(null);
      if (deal) void handleMoveToStage(deal, targetStage);
    },
    [draggedDealId, handleMoveToStage, stages],
  );

  const stopBoardAutoScroll = useCallback(() => {
    autoScrollSpeedRef.current = 0;
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
  }, []);

  const handleBoardEdge = useCallback(
    (clientX: number) => {
      if (!draggedDealId || !boardScrollRef.current) return;
      const bounds = boardScrollRef.current.getBoundingClientRect();
      const edgeSize = Math.min(160, bounds.width * 0.22);
      let speed = 0;

      if (clientX <= bounds.left + edgeSize) {
        const proximity = Math.max(0, Math.min(1, (bounds.left + edgeSize - clientX) / edgeSize));
        speed = -Math.ceil(6 + 22 * proximity);
      } else if (clientX >= bounds.right - edgeSize) {
        const proximity = Math.max(0, Math.min(1, (clientX - (bounds.right - edgeSize)) / edgeSize));
        speed = Math.ceil(6 + 22 * proximity);
      }

      autoScrollSpeedRef.current = speed;
      if (speed === 0) {
        stopBoardAutoScroll();
      } else if (autoScrollFrameRef.current === null) {
        const tick = () => {
          const board = boardScrollRef.current;
          const currentSpeed = autoScrollSpeedRef.current;
          if (!board || currentSpeed === 0) {
            autoScrollFrameRef.current = null;
            return;
          }
          board.scrollLeft += currentSpeed;
          autoScrollFrameRef.current = window.requestAnimationFrame(tick);
        };
        autoScrollFrameRef.current = window.requestAnimationFrame(tick);
      }
    },
    [draggedDealId, stopBoardAutoScroll],
  );

  useEffect(() => {
    if (!draggedDealId) return;
    const handleWindowDragOver = (event: DragEvent) => handleBoardEdge(event.clientX);
    window.addEventListener("dragover", handleWindowDragOver);
    return () => {
      window.removeEventListener("dragover", handleWindowDragOver);
      stopBoardAutoScroll();
    };
  }, [draggedDealId, handleBoardEdge, stopBoardAutoScroll]);

  useEffect(() => stopBoardAutoScroll, [stopBoardAutoScroll]);

  const filteredStages = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return stages
      .filter((stage) => {
        if (!requestedStage) return true;
        const stageKey = requestedStage.toLowerCase();
        return (
          stage.id.toLowerCase() === stageKey ||
          stage.name.toLowerCase() === stageKey ||
          stage.mergedStageIds.some((id) => id.toLowerCase() === stageKey)
        );
      })
      .map((stage) => ({
        ...stage,
        deals: stage.deals.filter((deal) => {
          const dealMatches =
            !requestedDeal ||
            deal.id === requestedDeal ||
            deal.raw.id === requestedDeal;
          const contactMatches =
            !requestedContactId || deal.raw.contactId === requestedContactId;
          const proposalMatches =
            requestedView !== "proposals" ||
            deal.treatment.toLowerCase().includes("proposal") ||
            deal.name.toLowerCase().includes("proposal") ||
            String(deal.raw.stageName || "").toLowerCase().includes("proposal") ||
            String(deal.raw.title || "").toLowerCase().includes("proposal");
          const statusMatches =
            !requestedStatus ||
            deal.raw.status === requestedStatus ||
            deal.raw.stageKind === requestedStatus;
          const searchMatches =
            !query ||
            deal.name.toLowerCase().includes(query) ||
            deal.treatment.toLowerCase().includes(query) ||
            deal.source.toLowerCase().includes(query) ||
            deal.email.toLowerCase().includes(query) ||
            deal.phone.toLowerCase().includes(query) ||
            deal.raw.title.toLowerCase().includes(query) ||
            deal.id.toLowerCase().includes(query);

          const ownerMatches = ownerFilter === "all" || deal.owner === ownerFilter;
          const boardStatusMatches = statusFilter === "all" || deal.raw.status === statusFilter;
          const serviceMatches = serviceFilter === "all" || deal.treatment === serviceFilter;
          const sourceMatches = sourceFilter === "all" || deal.source === sourceFilter;

          return dealMatches && contactMatches && proposalMatches && statusMatches && searchMatches && ownerMatches && boardStatusMatches && serviceMatches && sourceMatches;
        }),
      }))
      .filter((stage) => {
        const hasRouteFilter =
          Boolean(requestedStatus) ||
          Boolean(requestedDeal) ||
          Boolean(requestedContactId) ||
          requestedView === "proposals";
        return !hasRouteFilter || stage.deals.length > 0;
      })
      .map((stage) => ({
        ...stage,
        deals: [...stage.deals].sort((a, b) => {
          if (sortBy === "value") return b.raw.valueCents - a.raw.valueCents;
          if (sortBy === "newest") return Date.parse(b.raw.createdAt) - Date.parse(a.raw.createdAt);
          if (sortBy === "close") return Date.parse(a.raw.expectedCloseDate || "9999-12-31") - Date.parse(b.raw.expectedCloseDate || "9999-12-31");
          const attention = (deal: PipelineDealData) => isFollowUpOverdue(deal.nextFollowUpDate) ? 0 : deal.nextFollowUpDate ? 1 : 2;
          return attention(a) - attention(b);
        }),
      }));
  }, [ownerFilter, requestedContactId, requestedDeal, requestedStage, requestedStatus, requestedView, searchQuery, serviceFilter, sortBy, sourceFilter, stages, statusFilter]);

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
  const openDeals = stages.flatMap((stage) => stage.deals).filter((deal) => deal.raw.status === "open");
  const openValue = openDeals.reduce((sum, deal) => sum + deal.raw.valueCents, 0) / 100;
  const weightedValue = openDeals.reduce((sum, deal) => sum + (deal.raw.valueCents * deal.raw.probability) / 100, 0) / 100;
  const followUpsDue = openDeals.filter((deal) => !deal.nextFollowUpDate || isFollowUpOverdue(deal.nextFollowUpDate)).length;
  const filterOptions = {
    owners: Array.from(new Set(stages.flatMap((stage) => stage.deals.map((deal) => deal.owner)))).sort(),
    services: Array.from(new Set(stages.flatMap((stage) => stage.deals.map((deal) => deal.treatment)))).sort(),
    sources: Array.from(new Set(stages.flatMap((stage) => stage.deals.map((deal) => deal.source)))).sort(),
  };
  const activeFilterCount = [ownerFilter, statusFilter, serviceFilter, sourceFilter].filter((value) => value !== "all").length;
  const selectedOpportunity = stages.flatMap((stage) => stage.deals).find((deal) => deal.id === selectedDeal) || null;

  return (
    <div className="space-y-6 h-full">
      <PageHeader
        title="Sales Pipeline"
        subtitle="Manage opportunities and move them through your sales process."
        icon={Target}
        right={
          <div className="flex flex-wrap items-center justify-end gap-3">
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

      <DashboardReturnLink visible={searchParams.get("from") === "dashboard"} />

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

      {pendingLostMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl border border-black/[0.08] bg-[#FFFCF9] p-5 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[#1B1D22]">Mark opportunity lost</h2>
                <p className="mt-1 text-sm text-[#6B7280]">
                  {pendingLostMove.deal.name} will move to {pendingLostMove.targetStage.name}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPendingLostMove(null)}
                className="rounded-lg p-1 text-[#6B7280] hover:bg-[#F0EEF8] hover:text-[#1B1D22]"
                aria-label="Close lost outcome modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <label className="block text-sm font-medium text-[#354943]">
                Lost reason
                <select
                  value={lostReason}
                  onChange={(event) => setLostReason(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#1B1D22] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
                >
                  {SALES_LOSS_REASON_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm font-medium text-[#354943]">
                Objection type
                <select
                  value={objectionType}
                  onChange={(event) => setObjectionType(event.target.value)}
                  className="mt-1 w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm text-[#1B1D22] outline-none focus:border-[#6E6AE8] focus:ring-2 focus:ring-[#6E6AE8]/15"
                >
                  {SALES_OBJECTION_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingLostMove(null)}
                className="rounded-xl border border-black/[0.08] px-4 py-2 text-sm font-semibold text-[#1B1D22] hover:bg-[#F0EEF8]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={movingDealId === pendingLostMove.deal.id}
                onClick={submitLostMove}
                className="inline-flex items-center gap-2 rounded-xl bg-[#1B1D22] px-4 py-2 text-sm font-semibold text-white hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {movingDealId === pendingLostMove.deal.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Move to Lost
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-black/[0.06] bg-[#FFFCF9] shadow-sm md:grid-cols-5">
        {[
          ["Open pipeline", `£${openValue.toLocaleString()}`],
          ["Open opportunities", String(openDeals.length)],
          ["Weighted value", `£${Math.round(weightedValue).toLocaleString()}`],
          ["Needs attention", String(followUpsDue)],
          ["Average deal", `£${avgDealValue.toLocaleString()}`],
        ].map(([label, value], index) => (
          <div key={label} className={`px-4 py-3 ${index ? "border-l border-black/[0.06]" : ""}`}>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#8B8580]">{label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight text-[#1B1D22]">{value}</p>
          </div>
        ))}
      </div>

      <div className="sticky top-2 z-20 rounded-2xl border border-black/[0.06] bg-[#F7F5F2]/95 p-2.5 shadow-sm backdrop-blur">
        <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="relative min-w-64 flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7280]" />
          <input
            type="text"
            placeholder="Search clinic, contact, email, phone or opportunity…"
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
        <div className="flex flex-wrap gap-2">
          {[["Owner", ownerFilter, setOwnerFilter, filterOptions.owners], ["Status", statusFilter, setStatusFilter, ["open", "won", "lost"]], ["Service", serviceFilter, setServiceFilter, filterOptions.services], ["Source", sourceFilter, setSourceFilter, filterOptions.sources]] .map(([label, value, setter, options]) => (
            <select key={label as string} aria-label={`${label} filter`} value={value as string} onChange={(event) => (setter as (value: string) => void)(event.target.value)} className="rounded-xl border border-black/[0.07] bg-white px-3 py-2.5 text-sm text-[#5F5A55] outline-none focus:border-[#6E6AE8]/50">
              <option value="all">{label as string}: All</option>
              {(options as string[]).map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          ))}
          <select aria-label="Sort opportunities" value={sortBy} onChange={(event) => setSortBy(event.target.value)} className="rounded-xl border border-black/[0.07] bg-white px-3 py-2.5 text-sm text-[#5F5A55]">
            <option value="attention">Attention first</option><option value="value">Highest value</option><option value="newest">Newest</option><option value="close">Close date</option>
          </select>
          {activeFilterCount > 0 && <button onClick={() => { setOwnerFilter("all"); setStatusFilter("all"); setServiceFilter("all"); setSourceFilter("all"); }} className="px-3 text-sm font-medium text-[#6E6AE8]">Clear {activeFilterCount}</button>}
          <button
            aria-label="Configure pipeline stages"
            onClick={() => router.push("/app/crm/pipeline/settings")}
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FFFCF9] border border-[rgba(0,0,0,0.06)] rounded-xl hover:bg-[#F0EEF8] text-[#6B7280] hover:text-[#6E6AE8] text-sm transition-colors"
          >
            <Settings className="w-4 h-4" /> Stages
          </button>
          <div className="flex rounded-xl border border-black/[0.07] bg-white p-1">
            <button aria-label="Kanban view" onClick={() => setBoardView("kanban")} className={`rounded-lg p-1.5 ${boardView === "kanban" ? "bg-[#EEEAFB] text-[#6E6AE8]" : "text-[#8B8580]"}`}><LayoutGrid className="h-4 w-4" /></button>
            <button aria-label="List view" onClick={() => setBoardView("list")} className={`rounded-lg p-1.5 ${boardView === "list" ? "bg-[#EEEAFB] text-[#6E6AE8]" : "text-[#8B8580]"}`}><List className="h-4 w-4" /></button>
          </div>
        </div>
        </div>
      </div>

      {isLoading ? (
        <PipelineSkeleton columns={5} />
      ) : (
      <>
      {boardView === "kanban" ? <div ref={boardScrollRef} className="flex gap-3 overflow-x-auto pb-5 [scrollbar-color:#C9C3D8_transparent] [scrollbar-width:thin]">
        {filteredStages.map((stage) => (
          <div
            key={stage.id}
            role="region"
            aria-label={`${stage.name} pipeline stage, ${stage.deals.length} opportunities. Drop an opportunity here.`}
            onDragEnter={() => {
              if (draggedDealId) setDragOverStageId(stage.id);
            }}
            onDragOver={(event) => {
              if (!draggedDealId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverStageId(stage.id);
            }}
            onDrop={(event) => {
              event.preventDefault();
              stopBoardAutoScroll();
              handleDrop(stage);
            }}
            className={`w-[310px] min-w-[310px] rounded-2xl border border-black/[0.06] bg-[#F4F1ED] p-2 transition-colors ${
              dragOverStageId === stage.id
                ? "bg-[rgba(110,106,232,0.10)] ring-2 ring-[#6E6AE8]/35"
                : "bg-transparent"
            }`}
          >
            <div className="sticky top-0 z-10 mb-2 rounded-xl border-t-2 border-black/10 bg-[#FFFCF9] px-3 py-2.5 shadow-sm">
              <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-3 h-3 rounded-full ${stage.color}`} />
                <h3 className="font-semibold text-[#111111]">
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
              <p className="mt-1 text-xs font-medium text-[#8B8580]">£{(stage.deals.reduce((sum, deal) => sum + deal.raw.valueCents, 0) / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="min-h-32 space-y-2">
              {stage.deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  isSelected={selectedDeal === deal.id}
                  isMoving={movingDealId === deal.id}
                  isRemoving={removingDealId === deal.id}
                  canEdit={canWriteContacts}
                  canMovePrevious={findDealStageIndex(deal) > 0}
                  canMoveNext={findDealStageIndex(deal) < orderedStages.length - 1}
                  onClick={() => setSelectedDeal(deal.id)}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", deal.id);
                    setDraggedDealId(deal.id);
                    setSelectedDeal(null);
                  }}
                  onDragEnd={() => {
                    stopBoardAutoScroll();
                    setDraggedDealId(null);
                    setDragOverStageId(null);
                  }}
                  onMovePrevious={handleMovePrevious}
                  onMoveNext={handleMoveNext}
                  onRemove={handleRemoveDeal}
                  onCreateProposal={openProposalBuilder}
                />
              ))}
              {stage.deals.length === 0 && <button onClick={() => openAddDeal(stage.id)} className="flex min-h-28 w-full items-center justify-center gap-1 rounded-xl border border-dashed border-black/10 text-sm text-[#8B8580]"><Plus className="h-4 w-4" /> No opportunities · Add</button>}
            </div>
          </div>
        ))}
        {filteredStages.length === 0 && (
          <div className="rounded-2xl border border-[rgba(0,0,0,0.06)] bg-[#FFFCF9] p-6 text-sm text-[#6B7280]">
            No pipeline stages loaded yet.
          </div>
        )}
      </div> : <div className="overflow-hidden rounded-2xl border border-black/[0.06] bg-[#FFFCF9]">{filteredStages.flatMap((stage) => stage.deals.map((deal) => <button key={deal.id} onClick={() => setSelectedDeal(deal.id)} className="grid w-full grid-cols-[1fr_auto] gap-4 border-b border-black/[0.05] px-4 py-3 text-left hover:bg-[#F8F6F3] sm:grid-cols-[1.2fr_1fr_1fr_auto]"><span><strong className="block text-sm text-[#1B1D22]">{deal.raw.title}</strong><small className="text-[#8B8580]">{deal.name}</small></span><span className="hidden text-sm text-[#6F6A66] sm:block">{stage.name}</span><span className="hidden text-sm text-[#6F6A66] sm:block">{deal.treatment}</span><strong className="text-sm text-[#1B1D22]">{deal.value}</strong></button>))}{filteredStages.every((stage) => stage.deals.length === 0) && <p className="p-8 text-center text-sm text-[#8B8580]">No opportunities match these filters.</p>}</div>}
      </>
      )}

      {selectedOpportunity && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/20" role="dialog" aria-modal="true" aria-label={`${selectedOpportunity.name} opportunity details`} onClick={() => setSelectedDeal(null)}>
          <aside className="h-full w-full max-w-md overflow-y-auto bg-[#FFFCF9] p-6 shadow-2xl" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#6E6AE8]">Opportunity</p><h2 className="mt-1 text-2xl font-bold text-[#1B1D22]">{selectedOpportunity.raw.title}</h2><p className="mt-1 text-sm text-[#6F6A66]">{selectedOpportunity.name}</p></div>
              <button onClick={() => setSelectedDeal(null)} aria-label="Close opportunity details" className="rounded-xl p-2 hover:bg-black/5"><X className="h-5 w-5" /></button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#F4F1ED] p-3"><p className="text-xs text-[#8B8580]">Value</p><p className="mt-1 text-lg font-bold">{selectedOpportunity.value}</p></div>
              <div className="rounded-xl bg-[#F4F1ED] p-3"><p className="text-xs text-[#8B8580]">Probability</p><p className="mt-1 text-lg font-bold">{selectedOpportunity.raw.probability}%</p></div>
            </div>
            <dl className="mt-6 space-y-4 text-sm">
              {[["Stage", selectedOpportunity.raw.stageName || "Unassigned"], ["Package / service", selectedOpportunity.treatment], ["Owner", selectedOpportunity.owner], ["Lead source", selectedOpportunity.source], ["Expected close", selectedOpportunity.raw.expectedCloseDate ? formatFollowUpDate(selectedOpportunity.raw.expectedCloseDate) : "Not set"], ["Next action", selectedOpportunity.nextFollowUpDate ? formatFollowUpDate(selectedOpportunity.nextFollowUpDate) : "No next action"], ["Time in stage", `${selectedOpportunity.daysInStage} days`], ["Lost reason", selectedOpportunity.raw.lostReason ? salesOutcomeLabel(selectedOpportunity.raw.lostReason) : "Not set"], ["Objection type", selectedOpportunity.raw.objectionType ? salesOutcomeLabel(selectedOpportunity.raw.objectionType) : "Not set"]].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-4 border-b border-black/[0.06] pb-3"><dt className="text-[#8B8580]">{label}</dt><dd className="text-right font-medium text-[#1B1D22]">{value}</dd></div>)}
            </dl>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <a href={selectedOpportunity.raw.contactPhone ? `tel:${selectedOpportunity.raw.contactPhone}` : undefined} className="flex items-center justify-center gap-2 rounded-xl border border-black/[0.07] py-3 text-sm font-medium"><Phone className="h-4 w-4" /> Call</a>
              <a href={selectedOpportunity.raw.contactEmail ? `mailto:${selectedOpportunity.raw.contactEmail}` : undefined} className="flex items-center justify-center gap-2 rounded-xl border border-black/[0.07] py-3 text-sm font-medium"><Mail className="h-4 w-4" /> Email</a>
              <button onClick={() => openProposalBuilder(selectedOpportunity)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#315f51]/20 bg-[#edf5f3] py-3 text-sm font-semibold text-[#315f51]"><FileText className="h-4 w-4" /> Create proposal</button>
              {(selectedOpportunity.raw.status === "won" || selectedOpportunity.raw.stageKind === "won") && (
                selectedOpportunity.raw.clientAccountProfileId ? (
                  <div className="col-span-2 flex items-center justify-center gap-2 rounded-xl border border-[#315f51]/20 bg-[#edf5f3] py-3 text-sm font-semibold text-[#315f51]">
                    <CheckCircle className="h-4 w-4" /> Converted to client
                  </div>
                ) : (
                  <button
                    onClick={() => void handleConvertWonDeal(selectedOpportunity)}
                    disabled={!canWriteClientAccounts || convertingDealId === selectedOpportunity.id}
                    className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#315f51] py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {convertingDealId === selectedOpportunity.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                    Convert won to client
                  </button>
                )
              )}
              <button onClick={() => router.push(`/app/crm/contacts/detail?id=${encodeURIComponent(selectedOpportunity.raw.contactId)}`)} className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-[#6E6AE8] py-3 text-sm font-semibold text-white"><ExternalLink className="h-4 w-4" /> Open complete contact record</button>
            </div>
          </aside>
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
          packageOptions={packageOptions}
          stages={stages}
        />
      )}
    </div>
  );
}
