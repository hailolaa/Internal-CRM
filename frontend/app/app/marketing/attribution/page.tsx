"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarCheck,
  ChevronDown,
  CheckCircle,
  ExternalLink,
  Link2,
  PoundSterling,
  Target,
  TrendingUp,
  Users,
  UserRound,
} from "lucide-react";
import { DataTable, TableRow, TableCell } from "@/components/ui/tables";
import { ReportPageTemplate } from "@/components/templates/report-page";
import {
  Badge,
  Card,
  CardSkeleton,
  DataProvenanceBadge,
  FilterTabs,
  ProgressBar,
  ProvenanceSummary,
  StatCardSkeleton,
  TableRowSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useReportCsvExport } from "@/hooks/use-report-csv-export";
import {
  REPORT_DATE_RANGES,
  getReportDateRangeParams,
} from "@/lib/report-date-ranges";
import type {
  ConnectorStatusRecord,
  ContactRecord,
  DashboardFunnelRecord,
  DashboardSummaryRecord,
  MarketingConnectorType,
  RevenueByChannelRecord,
  RevenueLeakDetailRecord,
  TopOpportunitiesRecord,
} from "@/lib/api-types";
import type { StatCardData } from "@/lib/types";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-GB").format(value);
}

function percent(part: number, total: number) {
  if (!total) return 0;
  return Math.round((part / total) * 100);
}

function sourceHref(path: string, source: string) {
  return `${path}?source=${encodeURIComponent(source)}`;
}

function provenanceValue(
  provenance: Record<string, string> | undefined,
  key: string,
  fallback: string,
) {
  return provenance?.[key] || fallback;
}

function isWeakProvenance(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("unknown") ||
    normalized.includes("manual") ||
    normalized.includes("estimate") ||
    normalized.includes("fallback") ||
    normalized.includes("sample")
  );
}

const ATTRIBUTION_CONNECTORS: Array<{
  type: MarketingConnectorType;
  label: string;
  improves: string;
}> = [
  {
    type: "google_ads",
    label: "Google Ads",
    improves: "paid spend, campaign source and ROAS attribution",
  },
  {
    type: "meta",
    label: "Meta Ads",
    improves: "paid social spend and lead-source attribution",
  },
  {
    type: "ga4",
    label: "Google Analytics 4",
    improves: "website funnel and conversion attribution",
  },
  {
    type: "google_business_profile",
    label: "Google Business Profile",
    improves: "local organic and GBP lead-source attribution",
  },
];

function isConnectorReady(connector: ConnectorStatusRecord | undefined) {
  return Boolean(
    connector &&
      connector.configured &&
      connector.oauthConnected &&
      !connector.selectionRequired &&
      connector.setupStatus === "ready" &&
      connector.healthStatus !== "error",
  );
}

function connectorByType(
  connectors: typeof ATTRIBUTION_CONNECTORS,
  type: MarketingConnectorType,
) {
  return connectors.find((connector) => connector.type === type);
}

export default function AttributionPage() {
  const { session } = useAuth();
  const token = session?.token;
  const [dateRange, setDateRange] = useState<string>(REPORT_DATE_RANGES[0]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [showIntegrationActions, setShowIntegrationActions] = useState(false);
  const reportParams = useMemo(
    () => getReportDateRangeParams(dateRange),
    [dateRange],
  );
  const {
    exportCsv: exportAttributionCsv,
    exportStatus,
    isExporting,
  } = useReportCsvExport({
    params: reportParams,
    token,
    type: "attribution",
  });
  const [summary, setSummary] = useState<DashboardSummaryRecord | null>(null);
  const [funnel, setFunnel] = useState<DashboardFunnelRecord | null>(null);
  const [channelRevenue, setChannelRevenue] =
    useState<RevenueByChannelRecord | null>(null);
  const [contacts, setContacts] = useState<ContactRecord[]>([]);
  const [leakDetails, setLeakDetails] = useState<RevenueLeakDetailRecord[]>([]);
  const [opportunities, setOpportunities] =
    useState<TopOpportunitiesRecord | null>(null);
  const [connectorStatuses, setConnectorStatuses] = useState<
    ConnectorStatusRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadAttribution() {
      setIsLoading(true);
      const [
        summaryResult,
        funnelResult,
        channelResult,
        contactResult,
        leakResult,
        opportunityResult,
        connectorResult,
      ] = await Promise.allSettled([
        api.reports.dashboardSummary(authToken, reportParams),
        api.reports.dashboardFunnel(authToken, reportParams),
        api.reports.revenueByChannel(authToken, reportParams),
        api.contacts.list(authToken, { page: 1, pageSize: 100 }),
        api.reports.revenueLeakDetails(authToken, reportParams),
        api.reports.topOpportunities(authToken, reportParams),
        api.integrations.listConnectorStatuses(authToken),
      ]);

      if (cancelled) return;

      setSummary(
        summaryResult.status === "fulfilled" ? summaryResult.value : null,
      );
      setFunnel(funnelResult.status === "fulfilled" ? funnelResult.value : null);
      setChannelRevenue(
        channelResult.status === "fulfilled" ? channelResult.value : null,
      );
      setContacts(
        contactResult.status === "fulfilled" ? contactResult.value.contacts : [],
      );
      setLeakDetails(
        leakResult.status === "fulfilled"
          ? Object.values(leakResult.value.items).flat()
          : [],
      );
      setOpportunities(
        opportunityResult.status === "fulfilled"
          ? opportunityResult.value
          : null,
      );
      setConnectorStatuses(
        connectorResult.status === "fulfilled" ? connectorResult.value : [],
      );

      const failedSources = [
        summaryResult.status === "rejected" ? "summary" : "",
        funnelResult.status === "rejected" ? "funnel" : "",
        channelResult.status === "rejected" ? "channel revenue" : "",
        contactResult.status === "rejected" ? "contacts" : "",
        leakResult.status === "rejected" ? "leak details" : "",
        opportunityResult.status === "rejected" ? "opportunities" : "",
        connectorResult.status === "rejected" ? "integration status" : "",
      ].filter(Boolean);

      setLoadError(
        failedSources.length > 0
          ? `Some live attribution data could not be loaded: ${failedSources.join(", ")}.`
          : "",
      );
      setIsLoading(false);
    }

    void loadAttribution();

    return () => {
      cancelled = true;
    };
  }, [reportParams, token]);

  const liveMetrics = useMemo<StatCardData[]>(() => {
    return [
      {
        label: "Total Leads",
        value: summary ? formatNumber(summary.cards.leads) : "N/A",
        change: summary ? "Live" : "No live summary",
        trend: "up",
        icon: Users,
        color: "blue",
      },
      {
        label: "Bookings",
        value: summary ? formatNumber(summary.cards.bookedConsults) : "N/A",
        change: summary
          ? `${summary.cards.attendedConsults} attended`
          : "No live summary",
        trend: "up",
        icon: Target,
        color: "green",
      },
      {
        label: "Conversion Rate",
        value: summary
          ? `${percent(summary.cards.bookedConsults, summary.cards.leads)}%`
          : "N/A",
        change: summary ? "Lead to booking" : "No live summary",
        trend: "up",
        icon: TrendingUp,
        color: "indigo",
      },
      {
        label: "Revenue",
        value: summary ? formatCurrency(summary.financials.totalRevenue) : "N/A",
        change: summary
          ? `${summary.financials.roas.toFixed(1)}x ROAS`
          : "No live summary",
        trend: "up",
        icon: PoundSterling,
        color: "indigo",
      },
    ];
  }, [summary]);

  const liveSources = useMemo(
    () =>
      channelRevenue?.bySource.length
        ? channelRevenue.bySource.slice(0, 10).map((source) => ({
          name: source.source || source.channel || "Unknown",
          leads: source.leads,
          bookings: source.bookedConsults,
          revenueValue: source.revenue,
          revenue: formatCurrency(source.revenue),
          cpl: formatCurrency(source.costPerLead),
          convRateValue: percent(source.bookedConsults, source.leads),
          convRate: `${percent(source.bookedConsults, source.leads)}%`,
          provenance: {
            leads: provenanceValue(
              source.provenance,
              "leads",
              source.leads > 0 ? "exact" : "unknown",
            ),
            revenue: provenanceValue(
              source.provenance,
              "revenue",
              source.revenue > 0 ? "manual" : "unknown",
            ),
            spend: provenanceValue(
              source.provenance,
              "spend",
              source.spend > 0 ? "manual" : "unknown",
            ),
          },
        }))
        : [],
    [channelRevenue],
  );

  const provenanceSummary = useMemo(
    () => ({
      leadSource: contacts.length ? "live" : "unknown",
      spend: channelRevenue?.totals.provenance?.spend || "unknown",
      revenue: channelRevenue?.totals.provenance?.revenue || "unknown",
      funnel: funnel?.provenance?.soldTreatments || "unknown",
    }),
    [channelRevenue, contacts.length, funnel],
  );

  const attributionIntegrationIssues = useMemo(() => {
    const missingConnector = (type: MarketingConnectorType) => {
      const status = connectorStatuses.find(
        (item) => item.type === type,
      );
      return isConnectorReady(status)
        ? null
        : connectorByType(ATTRIBUTION_CONNECTORS, type);
    };

    const paidConnectors = [
      missingConnector("google_ads"),
      missingConnector("meta"),
    ].filter(Boolean);
    const ga4Connector = missingConnector("ga4");
    const gbpConnector = missingConnector("google_business_profile");
    const issues: Array<{
      badge: string;
      status: string;
      reason: string;
      actions: Array<{
        label: string;
        href: string;
      }>;
    }> = [];

    if (isWeakProvenance(provenanceSummary.spend)) {
      issues.push({
        badge: "Spend",
        status: provenanceSummary.spend,
        reason:
          paidConnectors.length > 0
            ? "Paid spend is not coming from live ad connectors, so the report is using manual, estimated or fallback spend."
            : "Paid connector setup looks ready, but live spend provenance is not confirmed for this selected period.",
        actions: paidConnectors.map((connector) => ({
          label: `Connect ${connector!.label}`,
          href: `/app/integrations?connector=${connector!.type}`,
        })),
      });
    }

    if (isWeakProvenance(provenanceSummary.funnel)) {
      issues.push({
        badge: "Funnel",
        status: provenanceSummary.funnel,
        reason: ga4Connector
          ? "Website funnel attribution is not coming from live GA4 data because GA4 is not fully connected for this clinic."
          : "GA4 setup looks ready, but funnel provenance is not confirmed for this selected period.",
        actions: ga4Connector
          ? [
              {
                label: `Connect ${ga4Connector.label}`,
                href: `/app/integrations?connector=${ga4Connector.type}`,
              },
            ]
          : [{ label: "Review funnel report", href: "/app/reports/leads" }],
      });
    }

    if (isWeakProvenance(provenanceSummary.leadSource)) {
      const sourceConnectors = [
        missingConnector("google_ads"),
        missingConnector("meta"),
        gbpConnector,
      ].filter(Boolean);
      issues.push({
        badge: "Lead source",
        status: provenanceSummary.leadSource,
        reason:
          sourceConnectors.length > 0
            ? "Lead source is not being fully supplied by live marketing connectors."
            : "Lead source needs contact source fields to be backfilled or imported.",
        actions:
          sourceConnectors.length > 0
            ? sourceConnectors.map((connector) => ({
                label: `Connect ${connector!.label}`,
                href: `/app/integrations?connector=${connector!.type}`,
              }))
            : [{ label: "Review contacts", href: "/app/crm/contacts" }],
      });
    }

    if (isWeakProvenance(provenanceSummary.revenue)) {
      issues.push({
        badge: "Revenue",
        status: provenanceSummary.revenue,
        reason:
          "Revenue is not live-attributed because sold treatment or consult outcome data is not linked back to source and campaign records.",
        actions: [{ label: "Review revenue attribution", href: "/app/revenue" }],
      });
    }

    return issues;
  }, [connectorStatuses, provenanceSummary]);

  const filteredSources = useMemo(() => {
    return liveSources.filter((source) => {
      if (sourceFilter === "all") return true;
      if (sourceFilter === "needs attention") {
        return (
          source.leads === 0 ||
          source.convRateValue < 20 ||
          source.provenance.leads === "unknown" ||
          source.provenance.revenue === "unknown" ||
          source.provenance.spend === "unknown"
        );
      }
      if (sourceFilter === "strong performers") {
        return source.bookings > 0 && source.convRateValue >= 30;
      }
      if (sourceFilter === "untrusted data") {
        return (
          source.provenance.leads === "unknown" ||
          source.provenance.revenue === "unknown" ||
          source.provenance.spend === "unknown"
        );
      }
      return true;
    });
  }, [liveSources, sourceFilter]);

  const sourceSummary = useMemo(() => {
    const topSource = liveSources.reduce<(typeof liveSources)[number] | null>(
      (best, source) =>
        !best || source.revenueValue > best.revenueValue ? source : best,
      null,
    );
    const weakSources = liveSources.filter(
      (source) => source.leads > 0 && source.convRateValue < 20,
    ).length;
    const untrustedSources = liveSources.filter(
      (source) =>
        source.provenance.leads === "unknown" ||
        source.provenance.revenue === "unknown" ||
        source.provenance.spend === "unknown",
    ).length;

    return {
      topSource,
      weakSources,
      untrustedSources,
      trackedSources: liveSources.length,
    };
  }, [liveSources]);

  const attributionAudit = useMemo(() => {
    const totalContacts = contacts.length || summary?.cards.leads || 0;
    const contactsWithSource = contacts.filter((contact) =>
      Boolean(contact.source && contact.source !== "Unknown"),
    ).length;
    const linkedLeakRecords = leakDetails.filter((detail) => {
      const context = detail.context;
      return Boolean(
        detail.contactId ||
          context?.latestAppointmentId ||
          context?.latestCallId ||
          context?.latestFormSubmissionId ||
          context?.insightId ||
          context?.actionTaskId,
      );
    }).length;
    const sourceCoverage = percent(contactsWithSource, totalContacts);
    const bookingCoverage = percent(
      summary?.cards.bookedConsults || 0,
      summary?.cards.leads || 0,
    );
    const revenueCoverage = percent(
      summary?.cards.soldTreatments || 0,
      summary?.cards.attendedConsults || 0,
    );
    const leakLinkCoverage = percent(linkedLeakRecords, leakDetails.length);
    const scoreParts = [
      sourceCoverage,
      bookingCoverage,
      revenueCoverage,
      leakDetails.length === 0 ? 100 : leakLinkCoverage,
    ].filter((value) => Number.isFinite(value));
    const completeScore =
      summary || contacts.length || leakDetails.length
        ? Math.round(scoreParts.reduce((sum, value) => sum + value, 0) / scoreParts.length)
        : 0;

    return {
      completeScore,
      sourceCoverage,
      bookingCoverage,
      revenueCoverage,
      leakLinkCoverage,
      missingSource: Math.max(totalContacts - contactsWithSource, 0),
      missingBooking: Math.max(
        (summary?.cards.leads || 0) - (summary?.cards.bookedConsults || 0),
        0,
      ),
      missingRevenue: Math.max(
        (summary?.cards.attendedConsults || 0) -
          (summary?.cards.soldTreatments || 0),
        0,
      ),
      linkedLeakRecords,
    };
  }, [contacts, leakDetails, summary]);

  const linkedEvidenceSummary = useMemo(() => {
    const linkedRecords = leakDetails.filter((detail) => {
      const context = detail.context;
      return Boolean(
        detail.contactId ||
          context?.latestAppointmentId ||
          context?.latestCallId ||
          context?.latestFormSubmissionId ||
          context?.insightId ||
          context?.actionTaskId,
      );
    });
    const withContacts = linkedRecords.filter((detail) =>
      Boolean(detail.contactId),
    ).length;
    const withCalls = linkedRecords.filter((detail) =>
      Boolean(detail.context?.latestCallId),
    ).length;
    const withAppointments = linkedRecords.filter((detail) =>
      Boolean(detail.context?.latestAppointmentId),
    ).length;
    const withForms = linkedRecords.filter((detail) =>
      Boolean(detail.context?.latestFormSubmissionId),
    ).length;
    const withActions = linkedRecords.filter((detail) =>
      Boolean(detail.context?.actionTaskId || detail.context?.insightId),
    ).length;

    return {
      linkedRecords,
      evidenceTypes: [
        {
          label: "Contacts",
          value: withContacts,
          href: "/app/crm/contacts",
        },
        {
          label: "Calls",
          value: withCalls,
          href: "/app/comms/calls/analytics",
        },
        {
          label: "Appointments",
          value: withAppointments,
          href: "/app/crm/calendar",
        },
        {
          label: "Forms",
          value: withForms,
          href: "/app/crm/forms/submissions",
        },
        {
          label: "Actions",
          value: withActions,
          href: "/app/alerts",
        },
      ].filter((item) => item.value > 0),
      sampleRecords: linkedRecords.slice(0, 3),
    };
  }, [leakDetails]);

  const chainChecks = [
    {
      label: "Lead source captured",
      value: `${attributionAudit.sourceCoverage}%`,
      detail: `${attributionAudit.missingSource} missing source`,
      ok: attributionAudit.sourceCoverage >= 80,
    },
    {
      label: "Lead to booking trace",
      value: `${attributionAudit.bookingCoverage}%`,
      detail: `${attributionAudit.missingBooking} not booked yet`,
      ok: attributionAudit.bookingCoverage >= 20,
    },
    {
      label: "Consult to revenue trace",
      value: `${attributionAudit.revenueCoverage}%`,
      detail: `${attributionAudit.missingRevenue} without sold revenue`,
      ok: attributionAudit.revenueCoverage >= 40,
    },
    {
      label: "Leak evidence linked",
      value: `${attributionAudit.leakLinkCoverage}%`,
      detail: `${attributionAudit.linkedLeakRecords}/${leakDetails.length} linked`,
      ok: attributionAudit.leakLinkCoverage >= 80 || leakDetails.length === 0,
    },
  ];

  const toggleSource = (sourceName: string) => {
    setExpandedSource((current) =>
      current === sourceName ? null : sourceName,
    );
  };

  return (
    <ReportPageTemplate
      title="Attribution"
      subtitle="Track where your leads and bookings come from."
      metrics={isLoading ? undefined : liveMetrics}
      dateRanges={[...REPORT_DATE_RANGES]}
      selectedDateRange={dateRange}
      onDateRangeChange={setDateRange}
      exportDisabled={!token || isLoading}
      exportLabel="Export CSV"
      isExporting={isExporting}
      onExport={() => void exportAttributionCsv()}
      showExport
    >
      <div className="space-y-8">
      {exportStatus && (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            exportStatus.tone === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : exportStatus.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {exportStatus.message}
        </div>
      )}

      {isLoading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))}
        </div>
      )}

      {loadError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Attribution audit data could not fully load: {loadError}
        </div>
      )}

      <ProvenanceSummary
        items={[
          {
            label: "Lead source",
            value: provenanceSummary.leadSource,
          },
          {
            label: "Spend",
            value: provenanceSummary.spend,
          },
          {
            label: "Revenue",
            value: provenanceSummary.revenue,
          },
          {
            label: "Funnel",
            value: provenanceSummary.funnel,
          },
        ]}
      />

      {!isLoading && attributionIntegrationIssues.length > 0 && (
        <Card padding="p-5 sm:p-6">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <p className="text-sm font-semibold text-[#151f21]">
                Review attribution confidence issues
              </p>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-[#5e8a8d]">
                {attributionIntegrationIssues.length} attribution confidence
                issue
                {attributionIntegrationIssues.length === 1 ? "" : "s"} need
                attention for this selected period.
              </p>
            </div>
            <button
              type="button"
              aria-expanded={showIntegrationActions}
              onClick={() => setShowIntegrationActions((current) => !current)}
              className="inline-flex w-fit items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-[rgba(96,180,175,0.12)]"
              style={{
                backgroundColor: "rgba(96,180,175,0.08)",
                color: "#2f7f7a",
                border: "1px solid rgba(96,180,175,0.18)",
              }}
            >
              {showIntegrationActions ? "Hide issues" : "Show issues"}
              <ChevronDown
                className={`h-4 w-4 transition-transform ${
                  showIntegrationActions ? "rotate-180" : ""
                }`}
              />
            </button>
          </div>
          {showIntegrationActions && (
            <div className="mt-5">
              <div className="mb-4">
                <Link
                  href="/app/integrations"
                  className="inline-flex w-fit items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
                  style={{ border: "1px solid rgba(21,31,33,0.08)" }}
                >
                  Open integrations
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </div>
              <div className="grid grid-cols-1 gap-x-3 gap-y-4 lg:grid-cols-2">
                {attributionIntegrationIssues.map((issue) => (
                  <div
                    key={issue.badge}
                    className="rounded-lg px-4 py-4"
                    style={{
                      backgroundColor: "#FBFAF8",
                      border: "1px solid rgba(21,31,33,0.06)",
                    }}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-[#151f21]">
                        {issue.badge}
                      </p>
                      <DataProvenanceBadge value={issue.status} />
                    </div>
                    <p className="mt-3 text-sm leading-relaxed text-[#5e8a8d]">
                      {issue.reason}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {issue.actions.map((action) => (
                        <Link
                          key={`${issue.badge}-${action.href}`}
                          href={action.href}
                          className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
                          style={{ border: "1px solid rgba(21,31,33,0.08)" }}
                        >
                          {action.label}
                          <ExternalLink className="h-4 w-4" />
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {!isLoading && (
        <div className="grid grid-cols-1 gap-x-4 gap-y-7 sm:grid-cols-2 2xl:grid-cols-4">
          {[
            {
              label: "Top source",
              value: sourceSummary.topSource?.name || "No source",
              detail: sourceSummary.topSource
                ? `${formatCurrency(sourceSummary.topSource.revenueValue)} revenue`
                : "No channel revenue yet",
            },
            {
              label: "Sources tracked",
              value: String(sourceSummary.trackedSources),
              detail: "Live channel rows",
            },
            {
              label: "Weak conversion",
              value: String(sourceSummary.weakSources),
              detail: "Below 20% booking rate",
            },
            {
              label: "Data gaps",
              value: String(sourceSummary.untrustedSources),
              detail: "Unknown spend/source/revenue",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="min-h-[118px] rounded-lg px-5 py-4"
              style={{
                backgroundColor: "#FFFCF9",
                border: "1px solid rgba(21,31,33,0.06)",
                boxShadow: "0 1px 6px rgba(21,31,33,0.03)",
              }}
            >
              <p className="text-xs font-medium uppercase text-[#7A746A]">
                {item.label}
              </p>
              <p className="mt-3 text-2xl font-semibold leading-tight text-[#151f21]">
                {item.value}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[#5e8a8d]">
                {item.detail}
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 gap-x-5 gap-y-8 xl:grid-cols-[0.85fr_1.65fr]">
        {isLoading ? (
          <CardSkeleton lines={4} />
        ) : (
          <Card padding="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-sm font-semibold text-[#151f21]">
                  Attribution chain score
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#5e8a8d]">
                  Checks whether source, booking, revenue, and recovery
                  evidence can be traced end to end.
                </p>
              </div>
              <Badge
                variant={
                  attributionAudit.completeScore >= 75
                    ? "success"
                    : attributionAudit.completeScore >= 45
                      ? "warning"
                      : "error"
                }
              >
                {attributionAudit.completeScore}%
              </Badge>
            </div>
            <div className="mt-5">
              <ProgressBar
                value={attributionAudit.completeScore}
                color={
                  attributionAudit.completeScore >= 75
                    ? "green"
                    : attributionAudit.completeScore >= 45
                      ? "amber"
                      : "red"
                }
                showLabel
              />
            </div>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-x-4 gap-y-7 lg:grid-cols-2">
          {isLoading
            ? Array.from({ length: 4 }, (_, index) => (
                <CardSkeleton key={index} lines={3} className="p-4" />
              ))
            : chainChecks.map((check) => {
                const Icon = check.ok ? CheckCircle : AlertTriangle;
                return (
                  <Card key={check.label} padding="p-5">
                    <div className="flex items-start gap-4">
                      <div
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-2xl"
                        style={{
                          backgroundColor: check.ok
                            ? "rgba(96,180,175,0.08)"
                            : "rgba(183,103,46,0.08)",
                          color: check.ok ? "#60b4af" : "#b7672e",
                        }}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#151f21]">
                          {check.label}
                        </p>
                        <p className="mt-1 text-xl font-bold text-[#151f21]">
                          {check.value}
                        </p>
                        <p className="mt-2 text-sm leading-relaxed text-[#5e8a8d]">
                          {check.detail}
                        </p>
                      </div>
                    </div>
                  </Card>
                );
              })}
        </div>
      </div>

      <div className="space-y-6">
        <FilterTabs
          tabs={[
            "All",
            "Needs Attention",
            "Strong Performers",
            "Untrusted Data",
          ]}
          active={sourceFilter}
          onChange={(value) => {
            setSourceFilter(value);
            setExpandedSource(null);
          }}
        />

        <DataTable
          headers={[
            { label: "Source" },
            { label: "Leads" },
            { label: "Bookings" },
            { label: "Revenue" },
            { label: "CPL" },
            { label: "Conv. Rate" },
            { label: "Data" },
            { label: "Actions", className: "text-right" },
          ]}
        >
          {isLoading &&
            Array.from({ length: 5 }, (_, index) => (
              <TableRowSkeleton key={index} columns={8} />
            ))}
          {!isLoading && filteredSources.length === 0 && (
            <tr>
              <td
                colSpan={8}
                className="px-6 py-10 text-center text-sm text-[#5e8a8d]"
              >
                No live attribution source data matches this filter for the
                selected period.
              </td>
            </tr>
          )}
          {!isLoading &&
            filteredSources.map((source) => {
              const isExpanded = expandedSource === source.name;
              const hasDataGap =
                source.provenance.leads === "unknown" ||
                source.provenance.revenue === "unknown" ||
                source.provenance.spend === "unknown";
              const nextAction = hasDataGap
                ? "Connect or backfill spend/revenue data for this source."
                : source.convRateValue < 20
                  ? "Review follow-up and booking conversion for this source."
                  : "Keep monitoring spend, bookings, and revenue quality.";

              return (
                <Fragment key={source.name}>
                  <TableRow onClick={() => toggleSource(source.name)}>
                    <TableCell className="min-w-[260px] font-medium text-[#111111]">
                      <div className="max-w-[340px]">
                        <p>{source.name}</p>
                        <p className="mt-2 text-sm font-normal leading-relaxed text-[#5e8a8d]">
                          {nextAction}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {source.leads}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {source.bookings}
                    </TableCell>
                    <TableCell className="font-medium text-[#6E6AE8]">
                      {source.revenue}
                    </TableCell>
                    <TableCell className="text-[#6B7280]">
                      {source.cpl}
                    </TableCell>
                    <TableCell>
                      <span
                        className={`text-sm font-medium ${
                          source.convRateValue >= 30
                            ? "text-green-600"
                            : source.convRateValue < 20
                              ? "text-[#8A4A4A]"
                              : "text-[#6B7280]"
                        }`}
                      >
                        {source.convRate}
                      </span>
                    </TableCell>
                    <TableCell className="min-w-[190px]">
                      <div className="flex flex-wrap gap-2">
                        <DataProvenanceBadge value={source.provenance.leads} />
                        <DataProvenanceBadge
                          value={source.provenance.revenue}
                        />
                        <DataProvenanceBadge value={source.provenance.spend} />
                      </div>
                    </TableCell>
                    <TableCell className="min-w-[120px] text-right">
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSource(source.name);
                        }}
                        className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors hover:bg-[rgba(96,180,175,0.12)]"
                        style={{
                          backgroundColor: "rgba(96,180,175,0.08)",
                          color: "#2f7f7a",
                          border: "1px solid rgba(96,180,175,0.18)",
                        }}
                      >
                        Actions
                        <ChevronDown
                          className={`h-3.5 w-3.5 transition-transform ${
                            isExpanded ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </TableCell>
                  </TableRow>
                  {isExpanded && (
                    <tr
                      style={{
                        borderBottom: "1px solid rgba(21,31,33,0.04)",
                      }}
                    >
                      <td colSpan={8} className="px-6 py-5">
                        <div
                          className="flex flex-col gap-5 rounded-lg px-5 py-5 xl:flex-row xl:items-center xl:justify-between"
                          style={{
                            backgroundColor: "#FBFAF8",
                            border: "1px solid rgba(21,31,33,0.06)",
                          }}
                        >
                          <div className="grid flex-1 gap-4 text-sm md:grid-cols-3">
                            <div>
                              <p className="text-xs font-medium uppercase text-[#9A948C]">
                                Source health
                              </p>
                              <p className="mt-2 font-medium leading-relaxed text-[#151f21]">
                                {source.convRateValue >= 30
                                  ? "Strong booking conversion"
                                  : source.convRateValue >= 20
                                    ? "Watch conversion efficiency"
                                    : "Needs conversion review"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase text-[#9A948C]">
                                Data confidence
                              </p>
                              <p className="mt-2 font-medium leading-relaxed text-[#151f21]">
                                {hasDataGap
                                  ? "One or more data points are unknown"
                                  : "Lead, spend, and revenue data present"}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs font-medium uppercase text-[#9A948C]">
                                Next action
                              </p>
                              <p className="mt-2 font-medium leading-relaxed text-[#151f21]">
                                {nextAction}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2.5 xl:justify-end">
                            <Link
                              href={sourceHref(
                                "/app/reports/leads",
                                source.name,
                              )}
                              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
                              style={{
                                border: "1px solid rgba(21,31,33,0.08)",
                              }}
                            >
                              <Users className="h-4 w-4" />
                              Lead report
                            </Link>
                            <Link
                              href={sourceHref(
                                "/app/comms/calls/analytics",
                                source.name,
                              )}
                              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
                              style={{
                                border: "1px solid rgba(21,31,33,0.08)",
                              }}
                            >
                              <CalendarCheck className="h-4 w-4" />
                              Call analytics
                            </Link>
                            <Link
                              href={sourceHref(
                                "/app/marketing/campaigns",
                                source.name,
                              )}
                              className="inline-flex items-center gap-2 rounded-md bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
                              style={{
                                border: "1px solid rgba(21,31,33,0.08)",
                              }}
                            >
                              <ExternalLink className="h-4 w-4" />
                              Campaigns
                            </Link>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
        </DataTable>
      </div>

      <div className="grid grid-cols-1 gap-x-4 gap-y-7 lg:grid-cols-2">
        {isLoading ? (
          <CardSkeleton lines={5} />
        ) : (
          <Card padding="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#151f21]">
                Open attribution gaps
              </h2>
              <p className="mt-1 text-xs text-[#5e8a8d]">
                Records that need source, booking, revenue, or action-plan links.
              </p>
            </div>
            <AlertTriangle className="h-5 w-5 text-[#b7672e]" />
          </div>
          <div className="space-y-3">
            {[
              {
                label: "Missing lead source",
                value: attributionAudit.missingSource,
                action: "Backfill contact source or import campaign labels.",
              },
              {
                label: "Leads without booking",
                value: attributionAudit.missingBooking,
                action: "Review nurture, call handling, and booking follow-up.",
              },
              {
                label: "Consults without sold revenue",
                value: attributionAudit.missingRevenue,
                action: "Log consult outcomes and treatment revenue.",
              },
            ].map((gap) => (
              <div
                key={gap.label}
                className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#eaedeb] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-[#151f21]">
                      {gap.label}
                    </p>
                    <p className="mt-1 text-xs text-[#5e8a8d]">{gap.action}</p>
                  </div>
                  <span className="text-xl font-bold text-[#151f21]">
                    {gap.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
          </Card>
        )}

        {isLoading ? (
          <CardSkeleton lines={5} />
        ) : (
          <Card padding="p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#151f21]">
                Linked evidence coverage
              </h2>
              <p className="mt-1 text-xs text-[#5e8a8d]">
                Recovery risks and opportunities with source records attached.
              </p>
            </div>
            <Link2 className="h-5 w-5 text-[#60b4af]" />
          </div>
          <div className="space-y-3">
            <div className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#eaedeb] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#151f21]">
                  Recovery evidence linked
                </span>
                <span className="text-sm font-bold text-[#151f21]">
                  {attributionAudit.linkedLeakRecords}/{leakDetails.length}
                </span>
              </div>
              <div className="mt-3">
                <ProgressBar
                  value={attributionAudit.leakLinkCoverage}
                  color="green"
                />
              </div>
            </div>
            {linkedEvidenceSummary.evidenceTypes.length > 0 && (
              <div className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#eaedeb] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#151f21]">
                    Evidence sources
                  </span>
                  <span className="text-xs font-medium text-[#5e8a8d]">
                    Linked records
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {linkedEvidenceSummary.evidenceTypes.map((item) => (
                    <Link
                      key={item.label}
                      href={item.href}
                      className="flex items-center justify-between gap-3 rounded-lg bg-[#FFFCF9] px-3 py-2 text-sm transition-colors hover:bg-[rgba(96,180,175,0.08)]"
                      style={{ border: "1px solid rgba(21,31,33,0.06)" }}
                    >
                      <span className="font-medium text-[#151f21]">
                        {item.label}
                      </span>
                      <span className="font-semibold text-[#60b4af]">
                        {item.value}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {linkedEvidenceSummary.sampleRecords.length > 0 && (
              <div className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#eaedeb] p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-[#151f21]">
                    Sample linked evidence
                  </span>
                  <Link
                    href="/app/revenue"
                    className="text-xs font-medium text-[#2f7f7a] hover:underline"
                  >
                    View revenue
                  </Link>
                </div>
                <div className="space-y-2">
                  {linkedEvidenceSummary.sampleRecords.map((record) => {
                    const contactHref = record.contactId
                      ? `/app/crm/contacts/detail?id=${encodeURIComponent(record.contactId)}`
                      : "";
                    const rowContent = (
                      <>
                        <div className="flex min-w-0 items-center gap-2">
                          <UserRound className="h-4 w-4 flex-shrink-0 text-[#60b4af]" />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-[#151f21]">
                              {record.contactName || "Unknown contact"}
                            </p>
                            <p className="truncate text-xs text-[#5e8a8d]">
                              {record.reason || record.nextAction}
                            </p>
                          </div>
                        </div>
                        <span className="flex-shrink-0 text-xs font-semibold text-[#7A746A]">
                          {formatCurrency(record.estimatedRisk)}
                        </span>
                      </>
                    );

                    return contactHref ? (
                      <Link
                        key={record.id}
                        href={contactHref}
                        className="flex items-center justify-between gap-3 rounded-lg bg-[#FFFCF9] px-3 py-2 transition-colors hover:bg-[rgba(96,180,175,0.08)]"
                        style={{ border: "1px solid rgba(21,31,33,0.06)" }}
                      >
                        {rowContent}
                      </Link>
                    ) : (
                      <div
                        key={record.id}
                        className="flex items-center justify-between gap-3 rounded-lg bg-[#FFFCF9] px-3 py-2"
                        style={{ border: "1px solid rgba(21,31,33,0.06)" }}
                      >
                        {rowContent}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#eaedeb] p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#151f21]">
                  Open opportunities tracked
                </span>
                <span className="text-sm font-bold text-[#151f21]">
                  {opportunities?.summary.dealsCount || 0}
                </span>
              </div>
              <p className="mt-2 text-xs text-[#5e8a8d]">
                {formatCurrency(
                  (opportunities?.summary.totalValueCents || 0) / 100,
                )}{" "}
                in traceable pipeline value.
              </p>
            </div>
          </div>
          </Card>
        )}
      </div>
      </div>
    </ReportPageTemplate>
  );
}
