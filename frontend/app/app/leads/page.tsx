"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  PageHeader,
  StatCard,
  SearchInput,
  StatCardSkeleton,
  TableRowSkeleton,
} from "@/components/ui";
import { SubNav } from "@/components/sub-nav";
import {
  SortableHeader,
  PaginationControls,
} from "@/components/ui/table-controls";
import { useFilteredSortedPaginated } from "@/hooks/use-table";
import { api } from "@/lib/api-client";
import { mergeLeadRows } from "@/lib/lead-list";
import type {
  ContactRecord,
  DashboardSummaryRecord,
  PipelineDealRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { Plus, PoundSterling, Target, TrendingUp, Users } from "lucide-react";

const SALES_NAV = [
  { label: "Prospect List", href: "/app/leads", icon: Users },
  { label: "Sales Pipeline", href: "/app/crm/pipeline", icon: Target },
  { label: "Contacts", href: "/app/crm/contacts", icon: Users },
];

interface Lead {
  id: string;
  clinic: string;
  contact: string;
  email: string;
  source: string;
  stage: string;
  packageInterest: string;
  owner: string;
  followUpDate: string;
  followUpSort: number;
  followUpOverdue: boolean;
  status: string;
  revenue: number;
  createdDate: string;
  sortDate: number;
  contactId: string | null;
}

const STAGE_COLORS_WARM: Record<string, string> = {
  "New Enquiry": "bg-blue-50 text-blue-600 border border-blue-200",
  New: "bg-blue-50 text-blue-600 border border-blue-200",
  Contacted: "bg-cyan-50 text-cyan-600 border border-cyan-200",
  Qualified: "bg-violet-50 text-violet-600 border border-violet-200",
  "Discovery Call Booked": "bg-amber-50 text-amber-600 border border-amber-200",
  "Proposal Sent": "bg-purple-50 text-purple-600 border border-purple-200",
  "Follow-Up Needed": "bg-indigo-50 text-indigo-600 border border-indigo-200",
  Won: "bg-emerald-50 text-emerald-600 border border-emerald-200",
  Lost: "bg-red-50 text-red-600 border border-red-200",
};

const searchFn = (lead: Lead, query: string) =>
  lead.clinic.toLowerCase().includes(query) ||
  lead.contact.toLowerCase().includes(query) ||
  lead.email.toLowerCase().includes(query) ||
  lead.source.toLowerCase().includes(query) ||
  lead.packageInterest.toLowerCase().includes(query) ||
  lead.owner.toLowerCase().includes(query) ||
  lead.stage.toLowerCase().includes(query) ||
  lead.status.toLowerCase().includes(query) ||
  lead.followUpDate.toLowerCase().includes(query);

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(value: string | null | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function toDateSort(value: string | null | undefined) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? Number.MAX_SAFE_INTEGER : time;
}

function isPastDate(value: string | null | undefined) {
  if (!value) return false;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function isNewProspect(lead: Lead) {
  const stage = lead.stage.toLowerCase();
  const status = lead.status.toLowerCase();
  if (status === "won" || status === "lost" || stage.includes("won") || stage.includes("lost")) {
    return false;
  }
  const createdDays = Math.ceil((lead.sortDate - Date.now()) / 86400000);
  return (
    status === "open" ||
    stage.includes("new") ||
    stage.includes("enquiry") ||
    createdDays >= -7
  );
}

function uniqueOptions(values: string[]) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter((value) => value && value !== "-")),
  ).sort((a, b) => a.localeCompare(b));
}

function toLead(contact: ContactRecord): Lead {
  const packageInterest =
    contact.packageInterest ||
    contact.recommendedPackage ||
    contact.treatmentInterests?.[0] ||
    contact.tags?.[0] ||
    "-";
  const status = contact.leadStatus || contact.status || "New";

  return {
    id: contact.id,
    clinic: contact.accountName || "Unassigned account",
    contact: contact.name,
    email: contact.email || "-",
    source: contact.source || "Unknown",
    stage: contact.status || "New",
    packageInterest,
    owner: "Unassigned",
    followUpDate: "No follow-up set",
    followUpSort: Number.MAX_SAFE_INTEGER,
    followUpOverdue: false,
    status,
    revenue: contact.value,
    createdDate: formatDate(contact.createdAt || contact.updatedAt, "-"),
    sortDate: new Date(contact.createdAt || contact.updatedAt).getTime(),
    contactId: contact.id,
  };
}

function toLeadFromDeal(deal: PipelineDealRecord): Lead {
  const createdAt = deal.createdAt || deal.updatedAt;
  const followUpOverdue =
    deal.status === "open" &&
    deal.stageKind === "open" &&
    isPastDate(deal.expectedCloseDate);

  return {
    id: deal.contactId || deal.id,
    clinic:
      deal.title && deal.title !== deal.contactName
        ? deal.title
        : "Unassigned account",
    contact: deal.contactName || deal.title,
    email: deal.contactEmail || "-",
    source: deal.source || "Unknown",
    stage: deal.stageName || deal.status || "New",
    packageInterest: deal.treatment || "-",
    owner: deal.ownerName || "Unassigned",
    followUpDate: formatDate(deal.expectedCloseDate, "No follow-up set"),
    followUpSort: toDateSort(deal.expectedCloseDate),
    followUpOverdue,
    status: deal.status,
    revenue: deal.valueCents / 100,
    createdDate: formatDate(createdAt, "-"),
    sortDate: new Date(createdAt).getTime(),
    contactId: deal.contactId || null,
  };
}

export default function LeadsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dashboardView = searchParams.get("view");
  const { session } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummaryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [packageFilter, setPackageFilter] = useState("all");
  const [followUpFilter, setFollowUpFilter] = useState("all");

  useEffect(() => {
    if (!session?.token) return;

    let isMounted = true;

    Promise.allSettled([
      api.pipelineDeals.list(session.token),
      api.contacts.list(session.token, {
        page: 1,
        pageSize: 100,
        sortBy: "createdAt",
        sortDir: "desc",
      }),
      api.reports.dashboardSummary(session.token),
    ])
      .then(([dealResult, contactResult, summaryResult]) => {
        if (!isMounted) return;

        const dealRows =
          dealResult.status === "fulfilled"
            ? dealResult.value.deals.map(toLeadFromDeal)
            : [];

        const contactRows =
          contactResult.status === "fulfilled"
            ? contactResult.value.contacts
                .filter((contact) => {
                  const status = contact.status.toLowerCase();
                  return (
                    status.includes("lead") ||
                    status.includes("prospect") ||
                    status.includes("consult") ||
                    status.includes("discovery") ||
                    status.includes("proposal") ||
                    status.includes("book") ||
                    status.includes("new")
                  );
                })
                .map(toLead)
            : [];

        const rows = mergeLeadRows(dealRows, contactRows);

        setLeads(rows.sort((a, b) => b.sortDate - a.sortDate));
        setDashboardSummary(
          summaryResult.status === "fulfilled" ? summaryResult.value : null,
        );

        const failedSources = [
          dealResult.status === "rejected" ? "pipeline deals" : "",
          contactResult.status === "rejected" ? "contacts" : "",
          summaryResult.status === "rejected" ? "report summary" : "",
        ].filter(Boolean);

        setLoadError(
          failedSources.length > 0
            ? `Some live lead data could not be loaded: ${failedSources.join(", ")}.`
            : "",
        );
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [session?.token]);

  const leadStats = useMemo(() => {
    const unassigned = leads.filter(
      (lead) => lead.owner === "Unassigned",
    ).length;
    const revenue = leads.reduce((total, lead) => total + lead.revenue, 0);
    const costPerLead = dashboardSummary?.financials.costPerLead ?? 0;

    return {
      total: leads.length,
      unassigned,
      revenue,
      costPerLead,
    };
  }, [dashboardSummary?.financials.costPerLead, leads]);

  const filterOptions = useMemo(
    () => ({
      stages: uniqueOptions(leads.map((lead) => lead.stage)),
      sources: uniqueOptions(leads.map((lead) => lead.source)),
      owners: uniqueOptions(leads.map((lead) => lead.owner)),
      packages: uniqueOptions(leads.map((lead) => lead.packageInterest)),
    }),
    [leads],
  );

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const dashboardViewMatches =
        dashboardView !== "new" || isNewProspect(lead);
      const stageMatches = stageFilter === "all" || lead.stage === stageFilter;
      const sourceMatches = sourceFilter === "all" || lead.source === sourceFilter;
      const ownerMatches = ownerFilter === "all" || lead.owner === ownerFilter;
      const packageMatches =
        packageFilter === "all" || lead.packageInterest === packageFilter;
      const followUpMatches =
        followUpFilter === "all" ||
        (followUpFilter === "overdue" && lead.followUpOverdue);

      return (
        dashboardViewMatches &&
        stageMatches &&
        sourceMatches &&
        ownerMatches &&
        packageMatches &&
        followUpMatches
      );
    });
  }, [dashboardView, followUpFilter, leads, ownerFilter, packageFilter, sourceFilter, stageFilter]);

  const hasActiveFilters =
    stageFilter !== "all" ||
    sourceFilter !== "all" ||
    ownerFilter !== "all" ||
    packageFilter !== "all" ||
    followUpFilter !== "all";

  const resetFilters = () => {
    setStageFilter("all");
    setSourceFilter("all");
    setOwnerFilter("all");
    setPackageFilter("all");
    setFollowUpFilter("all");
  };

  const {
    searchQuery,
    setSearchQuery,
    toggleSort,
    getSortDirection,
    paginatedItems,
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    totalItems,
    nextPage,
    prevPage,
    goToPage,
    hasNextPage,
    hasPrevPage,
  } = useFilteredSortedPaginated(filteredLeads, searchFn, 10);

  const openLead = (lead: Lead) => {
    if (!lead.contactId) return;
    router.push(`/app/crm/contacts/detail?id=${lead.contactId}`);
  };

  return (
    <div className="space-y-6">
      <SubNav items={SALES_NAV} />

      <PageHeader
        title="Prospect List"
        subtitle="Daily sales/admin lead list with source, owner, stage, package interest, follow-up date, and status."
        icon={Target}
        iconColor="text-[#6E6AE8]"
        right={
          <button
            type="button"
            onClick={() => router.push("/app/crm/contacts/new")}
            className="inline-flex items-center gap-2 rounded-xl bg-[#6E6AE8] px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#5A56D4]"
          >
            <Plus className="h-4 w-4" />
            Add Lead
          </button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Total Prospects"
              value={String(leadStats.total)}
              trend="up"
              color="teal"
              icon={Users}
            />
            <StatCard
              label="Unassigned"
              value={String(leadStats.unassigned)}
              sub="Needs attention"
              color="amber"
              icon={Target}
            />
            <StatCard
              label="Avg. Lead Cost"
              value={leadStats.costPerLead > 0 ? formatMoney(leadStats.costPerLead) : "-"}
              sub={
                leadStats.costPerLead > 0
                  ? "From live spend and prospects"
                  : "No live spend for this period"
              }
              color="teal"
              icon={TrendingUp}
            />
            <StatCard
              label="Pipeline Value"
              value={formatMoney(leadStats.revenue)}
              sub="Loaded from CRM"
              color="emerald"
              icon={PoundSterling}
            />
          </>
        )}
      </div>

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {loadError}
        </div>
      )}

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search account, contact, source, package, owner, stage, status..."
        className="max-w-lg"
      />

      <div className="grid grid-cols-1 gap-2 md:grid-cols-5">
        <select
          value={stageFilter}
          onChange={(event) => setStageFilter(event.target.value)}
          className="rounded-xl border border-[#E7E1DA] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8]/20"
          aria-label="Filter by stage"
        >
          <option value="all">All stages</option>
          {filterOptions.stages.map((stage) => (
            <option key={stage} value={stage}>
              {stage}
            </option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          className="rounded-xl border border-[#E7E1DA] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8]/20"
          aria-label="Filter by source"
        >
          <option value="all">All sources</option>
          {filterOptions.sources.map((source) => (
            <option key={source} value={source}>
              {source}
            </option>
          ))}
        </select>
        <select
          value={ownerFilter}
          onChange={(event) => setOwnerFilter(event.target.value)}
          className="rounded-xl border border-[#E7E1DA] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8]/20"
          aria-label="Filter by owner"
        >
          <option value="all">All owners</option>
          {filterOptions.owners.map((owner) => (
            <option key={owner} value={owner}>
              {owner}
            </option>
          ))}
        </select>
        <select
          value={packageFilter}
          onChange={(event) => setPackageFilter(event.target.value)}
          className="rounded-xl border border-[#E7E1DA] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8]/20"
          aria-label="Filter by package interest"
        >
          <option value="all">All package interests</option>
          {filterOptions.packages.map((packageInterest) => (
            <option key={packageInterest} value={packageInterest}>
              {packageInterest}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          <select
            value={followUpFilter}
            onChange={(event) => setFollowUpFilter(event.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-[#E7E1DA] bg-[#FFFCF9] px-3 py-2.5 text-sm text-[#151f21] focus:outline-none focus:ring-2 focus:ring-[#6E6AE8]/20"
            aria-label="Filter by follow-up"
          >
            <option value="all">All follow-ups</option>
            <option value="overdue">Overdue follow-up</option>
          </select>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-xl border border-[#E7E1DA] bg-[#FFFCF9] px-3 py-2.5 text-sm font-medium text-[#5e8a8d] hover:bg-[#F6F3EF]"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          backgroundColor: "#FFFCF9",
          border: "1px solid #E7E1DA",
          boxShadow: "0 2px 12px rgba(27, 29, 34, 0.05)",
        }}
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr
                style={{
                  borderBottom: "1px solid #E7E1DA",
                  backgroundColor: "#F6F3EF",
                }}
              >
                <SortableHeader
                  label="Account"
                  sortKey="clinic"
                  direction={getSortDirection("clinic")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Contact"
                  sortKey="contact"
                  direction={getSortDirection("contact")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Source"
                  sortKey="source"
                  direction={getSortDirection("source")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Stage"
                  sortKey="stage"
                  direction={getSortDirection("stage")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Package Interest"
                  sortKey="packageInterest"
                  direction={getSortDirection("packageInterest")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Owner"
                  sortKey="owner"
                  direction={getSortDirection("owner")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Follow-up Date"
                  sortKey="followUpSort"
                  direction={getSortDirection("followUpSort")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Status"
                  sortKey="status"
                  direction={getSortDirection("status")}
                  onSort={toggleSort}
                />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }, (_, index) => (
                  <TableRowSkeleton key={index} columns={8} />
                ))}
              {!isLoading && paginatedItems.map((lead) => (
                <tr
                  key={lead.id}
                  role={lead.contactId ? "button" : undefined}
                  tabIndex={lead.contactId ? 0 : undefined}
                  aria-label={
                    lead.contactId
                      ? `Open prospect ${lead.contact}`
                      : undefined
                  }
                  onClick={() => openLead(lead)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openLead(lead);
                    }
                  }}
                  style={{ borderBottom: "1px solid #EDE8E2" }}
                  className={`transition-colors hover:bg-[#F6F3EF] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#6E6AE8]/30 ${
                    lead.contactId ? "cursor-pointer" : ""
                  }`}
                >
                  <td className="px-5 py-4">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "#1B1D22" }}
                    >
                      {lead.clinic}
                    </div>
                    <div className="text-xs" style={{ color: "#9E9890" }}>
                      Created {lead.createdDate}
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "#1B1D22" }}
                    >
                      {lead.contact}
                    </div>
                    <div className="text-xs" style={{ color: "#9E9890" }}>
                      {lead.email}
                    </div>
                  </td>
                  <td
                    className="px-5 py-4 text-sm"
                    style={{ color: "#6F6A66" }}
                  >
                    {lead.source}
                  </td>
                  <td
                    className="px-5 py-4 text-sm"
                    style={{ color: "#6F6A66" }}
                  >
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS_WARM[lead.stage] || "bg-[#F6F3EF] text-[#6F6A66] border border-[#E7E1DA]"}`}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td
                    className="px-5 py-4 text-sm"
                    style={{ color: "#6F6A66" }}
                  >
                    {lead.packageInterest}
                  </td>
                  <td
                    className="px-5 py-4 text-sm"
                    style={{ color: "#6F6A66" }}
                  >
                    {lead.owner}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        lead.followUpOverdue
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-[#F6F3EF] text-[#6F6A66] border border-[#E7E1DA]"
                      }`}
                    >
                      {lead.followUpDate}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        lead.status === "won"
                          ? "bg-emerald-50 text-emerald-600 border border-emerald-200"
                          : lead.status === "lost"
                            ? "bg-red-50 text-red-600 border border-red-200"
                            : "bg-blue-50 text-blue-600 border border-blue-200"
                      }`}
                    >
                      {lead.status}
                    </span>
                  </td>
                </tr>
              ))}
              {!isLoading && paginatedItems.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="px-5 py-12 text-center"
                    style={{ color: "#9E9890" }}
                  >
                    {searchQuery
                      ? "No prospects match your search."
                      : "No live prospects are available for this workspace yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          startIndex={startIndex}
          endIndex={endIndex}
          totalItems={totalItems}
          onPrevious={prevPage}
          onNext={nextPage}
          onGoToPage={goToPage}
          hasPrevPage={hasPrevPage}
          hasNextPage={hasNextPage}
        />
      </div>
    </div>
  );
}
