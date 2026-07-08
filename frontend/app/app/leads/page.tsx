"use client";

import { useEffect, useMemo, useState } from "react";
import {
  PageHeader,
  StatCard,
  SearchInput,
  StatCardSkeleton,
  TableRowSkeleton,
} from "@/components/ui";
import {
  SortableHeader,
  PaginationControls,
} from "@/components/ui/table-controls";
import { useFilteredSortedPaginated } from "@/hooks/use-table";
import { api } from "@/lib/api-client";
import type {
  ContactRecord,
  DashboardSummaryRecord,
  PipelineDealRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import { Target, Users, PoundSterling, TrendingUp } from "lucide-react";

interface Lead {
  id: string;
  name: string;
  email: string;
  source: string;
  campaign: string;
  practitioner: string;
  stage: string;
  revenue: number;
  date: string;
  sortDate: number;
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
  lead.name.toLowerCase().includes(query) ||
  lead.email.toLowerCase().includes(query) ||
  lead.source.toLowerCase().includes(query) ||
  lead.campaign.toLowerCase().includes(query) ||
  lead.practitioner.toLowerCase().includes(query) ||
  lead.stage.toLowerCase().includes(query);

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function toLead(contact: ContactRecord): Lead {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email || "—",
    source: contact.source || "Unknown",
    campaign: contact.treatmentInterests?.[0] || contact.tags?.[0] || "—",
    practitioner: "Unassigned",
    stage: contact.status || "New",
    revenue: contact.value,
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(contact.createdAt || contact.updatedAt)),
    sortDate: new Date(contact.createdAt || contact.updatedAt).getTime(),
  };
}

function toLeadFromDeal(deal: PipelineDealRecord): Lead {
  const createdAt = deal.createdAt || deal.updatedAt;

  return {
    id: deal.contactId || deal.id,
    name: deal.contactName || deal.title,
    email: deal.contactEmail || "—",
    source: deal.source || "Unknown",
    campaign: deal.treatment || deal.title || "—",
    practitioner: deal.ownerName || "Unassigned",
    stage: deal.stageName || deal.status || "New",
    revenue: deal.valueCents / 100,
    date: new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(new Date(createdAt)),
    sortDate: new Date(createdAt).getTime(),
  };
}

export default function LeadsPage() {
  const { session } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [dashboardSummary, setDashboardSummary] =
    useState<DashboardSummaryRecord | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

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

        const rows = dealRows.length > 0 ? dealRows : contactRows;

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
      (lead) => lead.practitioner === "Unassigned",
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
  } = useFilteredSortedPaginated(leads, searchFn, 10);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Prospect List"
        subtitle="Track incoming The Growth Group enquiries from sales opportunities and CRM contacts, including source, service/package, owner, stage, and value."
        icon={Target}
        iconColor="text-[#6E6AE8]"
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
              value={leadStats.costPerLead > 0 ? formatMoney(leadStats.costPerLead) : "—"}
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
        placeholder="Search by name, email, source, service/package, owner, stage..."
        className="max-w-lg"
      />

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
                  label="Name"
                  sortKey="name"
                  direction={getSortDirection("name")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Source"
                  sortKey="source"
                  direction={getSortDirection("source")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Service / Package"
                  sortKey="campaign"
                  direction={getSortDirection("campaign")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Owner"
                  sortKey="practitioner"
                  direction={getSortDirection("practitioner")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Stage"
                  sortKey="stage"
                  direction={getSortDirection("stage")}
                  onSort={toggleSort}
                />
                <SortableHeader
                  label="Value"
                  sortKey="revenue"
                  direction={getSortDirection("revenue")}
                  onSort={toggleSort}
                  className="text-right"
                />
                <SortableHeader
                  label="Date"
                  sortKey="date"
                  direction={getSortDirection("date")}
                  onSort={toggleSort}
                  className="text-right"
                />
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                Array.from({ length: 6 }, (_, index) => (
                  <TableRowSkeleton key={index} columns={7} />
                ))}
              {!isLoading && paginatedItems.map((lead) => (
                <tr
                  key={lead.id}
                  style={{ borderBottom: "1px solid #EDE8E2" }}
                  className="transition-colors hover:bg-[#F6F3EF]"
                >
                  <td className="px-5 py-4">
                    <div
                      className="text-sm font-semibold"
                      style={{ color: "#1B1D22" }}
                    >
                      {lead.name}
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
                    {lead.campaign}
                  </td>
                  <td
                    className="px-5 py-4 text-sm"
                    style={{ color: "#6F6A66" }}
                  >
                    {lead.practitioner}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${STAGE_COLORS_WARM[lead.stage] || "bg-[#F6F3EF] text-[#6F6A66] border border-[#E7E1DA]"}`}
                    >
                      {lead.stage}
                    </span>
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-right font-semibold"
                    style={{
                      color: lead.revenue > 0 ? "#059669" : "#9E9890",
                    }}
                  >
                    {lead.revenue > 0 ? formatMoney(lead.revenue) : "—"}
                  </td>
                  <td
                    className="px-5 py-4 text-sm text-right"
                    style={{ color: "#9E9890" }}
                  >
                    {lead.date}
                  </td>
                </tr>
              ))}
              {!isLoading && paginatedItems.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
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
