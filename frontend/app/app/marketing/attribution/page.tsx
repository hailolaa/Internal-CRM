"use client";

import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
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
import {
  attributionSourceDisplayName as sourceDisplayName,
  compareAttributionMetric,
  getAttributionBookingRatio,
  getAttributionConnectorFreshness,
  getAttributionFunnelCounts,
  getAttributionSoldAttendedAudit,
  getAttributionSourceMetricState,
  getAttributionSourceNextAction,
  getAttributionSourceReviewFields as weakSourceProvenanceFields,
  getAttributionSourceReviewLabel as sourceDataReviewLabel,
  getAttributionSpendAllocationNote,
  isAttributionRevenueLinked,
  isWeakAttributionProvenance as isWeakProvenance,
  normaliseAttributionSourceName as normaliseSourceName,
} from "@/lib/attribution-workspace";
import type { AttributionSourceEvidence } from "@/lib/attribution-workspace";
import type {
  AttributionSourceCoverageRecord,
  ConnectorStatusRecord,
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

function dataSourceBadgeLabel(
  sourceName: string,
  metric: "leads" | "revenue" | "spend",
  provenance: string,
) {
  const metricLabels = {
    leads: "Leads",
    revenue: "Revenue",
    spend: "Spend",
  };
  const provenanceKey = provenance.toLowerCase();

  if (provenanceKey.includes("connector")) {
    return `${metricLabels[metric]}: ${sourceDisplayName(sourceName)}`;
  }

  if (provenanceKey.includes("exact") || provenanceKey.includes("verified")) {
    return `${metricLabels[metric]}: CRM`;
  }

  if (provenanceKey.includes("manual")) {
    return `${metricLabels[metric]}: Manual`;
  }

  if (provenanceKey.includes("estimate")) {
    return `${metricLabels[metric]}: Estimated`;
  }

  if (provenanceKey.includes("fallback")) {
    return `${metricLabels[metric]}: Fallback`;
  }

  return `${metricLabels[metric]}: Unknown`;
}

function provenanceValue(
  provenance: Record<string, string> | undefined,
  key: string,
  fallback: string,
) {
  return provenance?.[key] || fallback;
}

function hasWeakSourceProvenance(source: AttributionSourceEvidence) {
  return weakSourceProvenanceFields(source).length > 0;
}

function sourceMetricBadgeLabel(
  source: AttributionSourceEvidence,
  metric: "leads" | "revenue" | "spend",
) {
  if (metric === "leads" && source.leads === 0) {
    return "Leads: None recorded";
  }
  if (
    metric === "revenue" &&
    source.revenueValue === 0 &&
    !isAttributionRevenueLinked(source.provenance.revenue)
  ) {
    return "Revenue: None linked";
  }
  if (metric === "spend" && source.spendValue === 0) {
    return "Spend: Not tracked";
  }
  return dataSourceBadgeLabel(
    source.name,
    metric,
    source.provenance[metric],
  );
}

function combineFunnelProvenance(
  provenance: DashboardFunnelRecord["provenance"] | undefined,
) {
  if (!provenance) return "unknown";
  const values = [
    provenance.leads,
    provenance.contactedLeads,
    provenance.bookedConsults,
    provenance.attendedConsults,
    provenance.soldTreatments,
  ];
  const confirmedValues = values.filter(
    (value): value is string => Boolean(value && value !== "unknown"),
  );

  if (confirmedValues.length === 0) return "unknown";
  if (confirmedValues.length < values.length) return "partial";
  if (confirmedValues.some((value) => value === "manual")) return "manual";
  if (confirmedValues.some((value) => value === "estimated")) return "estimated";
  return "exact";
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
    type: "seo",
    label: "SEO",
    improves: "organic search clicks, impressions and source context",
  },
  {
    type: "google_business_profile",
    label: "Google Business Profile",
    improves: "local organic and GBP lead-source attribution",
  },
];

function isConnectorConfigured(connector: ConnectorStatusRecord | undefined) {
  return Boolean(
    connector &&
      connector.configured &&
      connector.oauthConnected &&
      !connector.selectionRequired &&
      connector.setupStatus === "ready",
  );
}

function connectorByType(
  connectors: typeof ATTRIBUTION_CONNECTORS,
  type: MarketingConnectorType,
) {
  return connectors.find((connector) => connector.type === type);
}

export default function AttributionPage() {
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canManageConnectors = hasPermission("webhooks:write");
  const [dateRange, setDateRange] = useState<string>(REPORT_DATE_RANGES[0]);
  const [sourceFilter, setSourceFilter] = useState("all");
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [showIntegrationActions, setShowIntegrationActions] = useState(false);
  const [showAuditDetails, setShowAuditDetails] = useState(false);
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
  const [sourceCoverage, setSourceCoverage] =
    useState<AttributionSourceCoverageRecord | null>(null);
  const [leakDetails, setLeakDetails] = useState<RevenueLeakDetailRecord[]>([]);
  const [opportunities, setOpportunities] =
    useState<TopOpportunitiesRecord | null>(null);
  const [connectorStatuses, setConnectorStatuses] = useState<
    ConnectorStatusRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [loadFailures, setLoadFailures] = useState<string[]>([]);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;
    const authToken = token;

    async function loadAttribution() {
      setIsLoading(true);
      setLoadError("");
      setLoadFailures([]);
      const [
        summaryResult,
        funnelResult,
        channelResult,
        coverageResult,
        leakResult,
        opportunityResult,
        connectorResult,
      ] = await Promise.allSettled([
        api.reports.dashboardSummary(authToken, reportParams),
        api.reports.dashboardFunnel(authToken, reportParams),
        api.reports.revenueByChannel(authToken, reportParams),
        api.reports.attributionSourceCoverage(authToken, reportParams),
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
      setSourceCoverage(
        coverageResult.status === "fulfilled" ? coverageResult.value : null,
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
        coverageResult.status === "rejected" ? "source coverage" : "",
        leakResult.status === "rejected" ? "leak details" : "",
        opportunityResult.status === "rejected" ? "opportunities" : "",
        connectorResult.status === "rejected" ? "integration status" : "",
      ].filter(Boolean);

      setLoadFailures(failedSources);
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

  const funnelCounts = useMemo(
    () => getAttributionFunnelCounts(funnel?.funnel),
    [funnel],
  );

  const liveMetrics = useMemo<StatCardData[]>(() => {
    const bookingRatio = getAttributionBookingRatio(
      funnelCounts.leads,
      funnelCounts.bookedConsults,
    );
    const headlineRoasIsMeasured = Boolean(
      summary &&
        summary.financials.spend > 0 &&
        (summary.financials.totalRevenue > 0 ||
          isAttributionRevenueLinked(
            channelRevenue?.totals.provenance?.revenue,
          )),
    );

    return [
      {
        label: "Total Leads",
        value: summary ? formatNumber(summary.cards.leads) : "N/A",
        change: summary ? "Live" : "No live summary",
        icon: Users,
        color: "blue",
      },
      {
        label: "Bookings",
        value: funnel ? formatNumber(funnelCounts.bookedConsults) : "N/A",
        change: funnel
          ? `${formatNumber(funnelCounts.attendedConsults)} attended`
          : "No live funnel",
        icon: Target,
        color: "green",
      },
      {
        label: "Booking Ratio",
        value: funnel ? bookingRatio.label : "N/A",
        change: funnel
          ? bookingRatio.value === null
            ? "No leads in period"
            : "Period bookings / leads"
          : "No live funnel",
        icon: TrendingUp,
        color: "indigo",
      },
      {
        label: "Revenue",
        value: summary ? formatCurrency(summary.financials.totalRevenue) : "N/A",
        change: summary
          ? headlineRoasIsMeasured
            ? `${summary.financials.roas.toFixed(1)}x ROAS`
            : summary.financials.spend > 0
              ? "ROAS unavailable · revenue not linked"
              : "ROAS unavailable · no tracked spend"
          : "No live summary",
        icon: PoundSterling,
        color: "indigo",
      },
    ];
  }, [channelRevenue, funnel, funnelCounts, summary]);

  const liveSources = useMemo(
    () =>
      channelRevenue?.bySource.length
        ? channelRevenue.bySource.map((source) => {
            const name = source.source || source.channel || "Unknown";
            const evidence: AttributionSourceEvidence = {
              name,
              leads: source.leads,
              bookings: source.bookedConsults,
              spendValue: source.spend,
              revenueValue: source.revenue,
              provenance: {
                leads: provenanceValue(
                  source.provenance,
                  "leads",
                  source.leads > 0 ? "exact" : "unknown",
                ),
                revenue: provenanceValue(
                  source.provenance,
                  "revenue",
                  source.revenue > 0 ? "exact" : "unknown",
                ),
                spend: provenanceValue(
                  source.provenance,
                  "spend",
                  source.spend > 0 ? "manual" : "unknown",
                ),
              },
            };
            const metricState = getAttributionSourceMetricState(evidence);
            const bookingRatio = getAttributionBookingRatio(
              source.leads,
              source.bookedConsults,
            );

            return {
              ...evidence,
              ...metricState,
              displayName: sourceDisplayName(name),
              spend: metricState.hasTrackedSpend
                ? formatCurrency(source.spend)
                : metricState.spendKind === "organic"
                  ? "Organic"
                  : "—",
              revenue: formatCurrency(source.revenue),
              cpl: metricState.hasMeasuredCpl
                ? formatCurrency(source.costPerLead)
                : metricState.spendKind === "organic"
                  ? "Organic"
                  : "—",
              roas: metricState.hasMeasuredRoas
                ? `${source.roas.toFixed(1)}×`
                : "—",
              convRateValue: bookingRatio.value,
              convRate: bookingRatio.label,
            };
          })
        : [],
    [channelRevenue],
  );

  const provenanceSummary = useMemo(
    () => {
      const coveragePercent = sourceCoverage?.coveragePercent ?? 0;
      const contactsWithSource =
        sourceCoverage?.contactsWithKnownSource ?? 0;

      return {
        leadSource:
          coveragePercent >= 80
            ? "live"
            : contactsWithSource > 0
              ? "partial"
              : "unknown",
        spend: channelRevenue?.totals.provenance?.spend || "unknown",
        revenue: channelRevenue?.totals.provenance?.revenue || "unknown",
        funnel: combineFunnelProvenance(funnel?.provenance),
      };
    },
    [channelRevenue, funnel, sourceCoverage],
  );

  const connectorFreshness = useMemo(
    () =>
      ATTRIBUTION_CONNECTORS.flatMap((definition) => {
        const connector = connectorStatuses.find(
          (item) => item.type === definition.type,
        );
        if (!connector || !isConnectorConfigured(connector)) return [];

        const freshness = getAttributionConnectorFreshness(connector);
        return freshness
          ? [{ ...definition, freshness }]
          : [];
      }),
    [connectorStatuses],
  );

  const attributionIntegrationIssues = useMemo(() => {
    const failedSources = new Set(loadFailures);
    const connectorStatusUnavailable = failedSources.has("integration status");
    const missingConnector = (type: MarketingConnectorType) => {
      if (connectorStatusUnavailable) return null;
      const status = connectorStatuses.find(
        (item) => item.type === type,
      );
      return isConnectorConfigured(status)
        ? null
        : connectorByType(ATTRIBUTION_CONNECTORS, type);
    };

    const paidConnectors = [
      missingConnector("google_ads"),
      missingConnector("meta"),
    ].filter(Boolean);
    const gbpConnector = missingConnector("google_business_profile");
    const issues: Array<{
      badge: string;
      status: string;
      statusLabel?: string;
      reason: string;
      actions: Array<{
        label: string;
        href: string;
      }>;
    }> = [];

    connectorFreshness
      .filter(({ freshness }) => freshness.needsReview)
      .forEach(({ type, label, freshness }) => {
        const lastGoodDataNote = freshness.ageLabel
          ? `The last successful data is ${freshness.ageLabel}.`
          : "No successful synced data is available.";
        let reason: string;
        if (freshness.status === "sync_failed") {
          reason = `${label} is configured, but its latest sync failed. ${lastGoodDataNote} Current-period figures may be incomplete.`;
        } else if (freshness.status === "connector_error") {
          reason = `${label} is configured, but the connector is reporting an error. ${lastGoodDataNote} Current-period figures may be incomplete.`;
        } else if (freshness.status === "never_synced") {
          reason = `${label} is configured, but it has not completed a sync. Current-period figures may be incomplete.`;
        } else {
          reason = `${label} is configured, but its latest synced data is ${freshness.ageLabel || "stale"}. Current-period figures may be incomplete.`;
        }

        issues.push({
          badge: `${label} freshness`,
          status: freshness.provenanceValue,
          statusLabel: freshness.statusLabel,
          reason,
          actions: [
            {
              label: `Sync ${label}`,
              href: `/app/integrations?connector=${type}`,
            },
          ],
        });
      });

    if (
      !failedSources.has("channel revenue") &&
      isWeakProvenance(provenanceSummary.spend)
    ) {
      issues.push({
        badge: "Spend",
        status: provenanceSummary.spend,
        reason:
          connectorStatusUnavailable
            ? "Live spend provenance is not confirmed, and connector status could not be checked."
            : paidConnectors.length > 0
            ? "Paid spend is not coming from live ad connectors, so the report is using manual, estimated or fallback spend."
            : "Paid connector setup looks ready, but live spend provenance is not confirmed for this selected period.",
        actions: connectorStatusUnavailable
          ? [{ label: "Review integrations", href: "/app/integrations" }]
          : paidConnectors.map((connector) => ({
              label: `Connect ${connector!.label}`,
              href: `/app/integrations?connector=${connector!.type}`,
            })),
      });
    }

    if (
      !failedSources.has("funnel") &&
      isWeakProvenance(provenanceSummary.funnel)
    ) {
      issues.push({
        badge: "Funnel",
        status: provenanceSummary.funnel,
        reason:
          "CRM funnel confidence needs completed calls, proposals and won outcomes linked to contacts in this selected period.",
        actions: [{ label: "Review lead funnel", href: "/app/reports/leads" }],
      });
    }

    if (
      !failedSources.has("source coverage") &&
      isWeakProvenance(provenanceSummary.leadSource)
    ) {
      const sourceConnectors = [
        missingConnector("google_ads"),
        missingConnector("meta"),
        gbpConnector,
      ].filter(Boolean);
      issues.push({
        badge: "Lead source",
        status: provenanceSummary.leadSource,
        reason:
          connectorStatusUnavailable
            ? "Lead source confidence is incomplete, and connector status could not be checked."
            : sourceConnectors.length > 0
            ? "Lead source is not being fully supplied by live marketing connectors."
            : "Lead source needs contact source fields to be backfilled or imported.",
        actions:
          !connectorStatusUnavailable && sourceConnectors.length > 0
            ? sourceConnectors.map((connector) => ({
                label: `Connect ${connector!.label}`,
                href: `/app/integrations?connector=${connector!.type}`,
              }))
            : [{ label: "Review contacts", href: "/app/crm/contacts" }],
      });
    }

    if (
      !failedSources.has("channel revenue") &&
      isWeakProvenance(provenanceSummary.revenue)
    ) {
      issues.push({
        badge: "Revenue",
        status: provenanceSummary.revenue,
        reason:
          "Revenue confidence needs proposal or client revenue linked to the original contact source for this selected period.",
        actions: [{ label: "Review revenue links", href: "/app/revenue" }],
      });
    }

    return issues;
  }, [
    connectorFreshness,
    connectorStatuses,
    loadFailures,
    provenanceSummary,
  ]);

  const filteredSources = useMemo(() => {
    return liveSources.filter((source) => {
      if (sourceFilter === "all") return true;
      if (sourceFilter === "needs attention") {
        return (
          source.leads === 0 ||
          (source.convRateValue !== null && source.convRateValue < 20) ||
          hasWeakSourceProvenance(source)
        );
      }
      if (sourceFilter === "high booking ratio") {
        return (
          source.bookings > 0 &&
          source.convRateValue !== null &&
          source.convRateValue >= 30
        );
      }
      if (sourceFilter === "untrusted data") {
        return hasWeakSourceProvenance(source);
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
      (source) =>
        source.convRateValue !== null && source.convRateValue < 20,
    ).length;
    const untrustedSources = liveSources.filter(
      (source) => hasWeakSourceProvenance(source),
    ).length;

    return {
      topSource,
      weakSources,
      untrustedSources,
      trackedSources: liveSources.length,
    };
  }, [liveSources]);

  const channelCoverage = useMemo(() => {
    const sourceBookings = liveSources.reduce(
      (total, source) => total + source.bookings,
      0,
    );
    const sourceRevenue = liveSources.reduce(
      (total, source) => total + source.revenueValue,
      0,
    );

    return {
      bookings: funnel
        ? compareAttributionMetric(
            funnelCounts.bookedConsults,
            sourceBookings,
          )
        : null,
      revenue: summary
        ? compareAttributionMetric(
            summary.financials.totalRevenue,
            sourceRevenue,
          )
        : null,
    };
  }, [funnel, funnelCounts.bookedConsults, liveSources, summary]);

  const attributionAudit = useMemo(() => {
    const totalContacts =
      sourceCoverage?.totalContacts ?? summary?.cards.leads ?? 0;
    const contactsWithSource =
      sourceCoverage?.contactsWithKnownSource ?? 0;
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
    const sourceCoveragePercent =
      sourceCoverage?.coveragePercent ??
      percent(contactsWithSource, totalContacts);
    const bookingCoverage = percent(
      funnelCounts.bookedConsults,
      funnelCounts.leads,
    );
    const leakLinkCoverage = percent(linkedLeakRecords, leakDetails.length);
    return {
      totalContacts,
      sourceCoverage: sourceCoveragePercent,
      bookingCoverage,
      leakLinkCoverage,
      missingSource:
        sourceCoverage?.contactsMissingSource ??
        Math.max(totalContacts - contactsWithSource, 0),
      linkedLeakRecords,
    };
  }, [funnelCounts, leakDetails, sourceCoverage, summary]);

  const soldAttendedAudit = useMemo(
    () =>
      getAttributionSoldAttendedAudit(
        funnelCounts.attendedConsults,
        funnelCounts.soldTreatments,
      ),
    [funnelCounts.attendedConsults, funnelCounts.soldTreatments],
  );

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
    const withScheduledWork = linkedRecords.filter((detail) =>
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
          label: "Scheduled work",
          value: withScheduledWork,
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
      value:
        loadFailures.includes("source coverage")
          ? "Unavailable"
          : attributionAudit.totalContacts === 0
            ? "No leads"
            : `${attributionAudit.sourceCoverage}%`,
      detail: loadFailures.includes("source coverage")
        ? "Contact source data could not be loaded."
        : attributionAudit.totalContacts === 0
          ? "No contacts in this period."
          : `${attributionAudit.missingSource} missing source`,
      action: "Backfill contact source or import campaign labels.",
      ok:
        !loadFailures.includes("source coverage") &&
        (attributionAudit.totalContacts === 0 ||
          attributionAudit.sourceCoverage >= 80),
      neutral:
        !loadFailures.includes("source coverage") &&
        attributionAudit.totalContacts === 0,
      informational: false,
    },
    {
      label: "Period bookings / leads",
      value: loadFailures.includes("funnel")
        ? "Unavailable"
        : funnelCounts.leads === 0
          ? "No leads"
          : `${attributionAudit.bookingCoverage}%`,
      detail: loadFailures.includes("funnel")
        ? "Funnel data could not be loaded."
        : funnelCounts.leads === 0
          ? "No lead-to-booking activity in this period."
          : `${formatNumber(funnelCounts.leads)} leads · ${formatNumber(funnelCounts.bookedConsults)} bookings recorded`,
      action:
        "Check source and date coverage before interpreting this period ratio.",
      ok:
        !loadFailures.includes("funnel") &&
        (funnelCounts.leads === 0 ||
          attributionAudit.bookingCoverage >= 20),
      neutral:
        !loadFailures.includes("funnel") && funnelCounts.leads === 0,
      informational: false,
    },
    {
      label: "Period sold / attended counts",
      value: loadFailures.includes("funnel")
        ? "Unavailable"
        : soldAttendedAudit.label,
      detail: loadFailures.includes("funnel")
        ? "Funnel data could not be loaded."
        : soldAttendedAudit.neutral
          ? "No attended or sold outcomes were recorded in this period."
          : `${formatNumber(funnelCounts.attendedConsults)} attended · ${formatNumber(funnelCounts.soldTreatments)} sold outcomes recorded independently. These aggregate period totals cannot be divided into a cohort conversion rate.`,
      action:
        "A cohort conversion needs record-level links between attendance and the resulting sale.",
      ok: !loadFailures.includes("funnel"),
      neutral:
        !loadFailures.includes("funnel") &&
        soldAttendedAudit.neutral,
      informational:
        !loadFailures.includes("funnel") &&
        soldAttendedAudit.informational,
    },
    {
      label: "Leak evidence linked",
      value: loadFailures.includes("leak details")
        ? "Unavailable"
        : leakDetails.length === 0
          ? "No risks"
          : `${attributionAudit.leakLinkCoverage}%`,
      detail: loadFailures.includes("leak details")
        ? "Recovery evidence could not be loaded."
        : leakDetails.length === 0
          ? "No recovery risks need evidence."
          : `${attributionAudit.linkedLeakRecords}/${leakDetails.length} linked`,
      action: "Link recovery risks to contacts, calls, proposals or tasks.",
      ok:
        !loadFailures.includes("leak details") &&
        (attributionAudit.leakLinkCoverage >= 80 || leakDetails.length === 0),
      neutral:
        !loadFailures.includes("leak details") && leakDetails.length === 0,
      informational: false,
    },
  ];

  const toggleSource = (sourceName: string) => {
    setExpandedSource((current) =>
      current === sourceName ? null : sourceName,
    );
  };

  const channelDataFailed = loadFailures.includes("channel revenue");
  const unavailableAuditCount = chainChecks.filter(
    (check) => check.value === "Unavailable",
  ).length;
  const auditReviewCount = chainChecks.filter(
    (check) => !check.ok && check.value !== "Unavailable",
  ).length;
  const neutralAuditCount = chainChecks.filter((check) => check.neutral).length;
  const informationalAuditCount = chainChecks.filter(
    (check) => check.informational,
  ).length;
  const healthyAuditCount = chainChecks.filter(
    (check) => check.ok && !check.neutral && !check.informational,
  ).length;
  const auditSummaryParts = [
    auditReviewCount > 0
      ? `${auditReviewCount} check${auditReviewCount === 1 ? "" : "s"} need${auditReviewCount === 1 ? "s" : ""} review`
      : null,
    healthyAuditCount > 0
      ? `${healthyAuditCount} check${healthyAuditCount === 1 ? "" : "s"} ${healthyAuditCount === 1 ? "is" : "are"} healthy`
      : null,
    informationalAuditCount > 0
      ? `${informationalAuditCount} count comparison${informationalAuditCount === 1 ? " is" : "s are"} informational`
      : null,
    unavailableAuditCount > 0
      ? `${unavailableAuditCount} check${unavailableAuditCount === 1 ? " is" : "s are"} unavailable`
      : null,
    neutralAuditCount > 0
      ? `${neutralAuditCount} check${neutralAuditCount === 1 ? "" : "s"} had no activity`
      : null,
  ].filter((part): part is string => Boolean(part));
  const auditSummary =
    unavailableAuditCount === chainChecks.length
      ? "Funnel and evidence inputs could not be loaded for this period."
      : auditSummaryParts.length > 0
        ? `${auditSummaryParts.join("; ")}.`
        : "No funnel or evidence checks were available for this period.";

  const renderSourceDetails = (source: (typeof liveSources)[number]) => {
    const hasDataGap = hasWeakSourceProvenance(source);
    const nextAction = getAttributionSourceNextAction(source, {
      connectors: connectorStatuses,
      connectorStatusAvailable: !loadFailures.includes("integration status"),
      canManageConnectors,
    });

    return (
      <div className="grid gap-5 2xl:grid-cols-[minmax(0,1fr)_auto] 2xl:items-center">
        <div className="grid gap-4 text-sm sm:grid-cols-2 xl:grid-cols-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#5E6E70]">
              Source health
            </p>
            <p className="mt-2 font-medium leading-relaxed text-[#151f21]">
              {source.convRateValue === null
                ? "Period booking ratio unavailable"
                : source.convRateValue >= 30
                  ? "Strong period booking ratio"
                  : source.convRateValue >= 20
                    ? "Watch period booking ratio"
                    : "Needs booking-ratio review"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-[#5E6E70]">
              Data confidence
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <DataProvenanceBadge
                value={source.provenance.leads}
                label={sourceMetricBadgeLabel(source, "leads")}
              />
              <DataProvenanceBadge
                value={source.provenance.revenue}
                label={sourceMetricBadgeLabel(source, "revenue")}
              />
              {(source.paid || source.hasTrackedSpend) && (
                <DataProvenanceBadge
                  value={source.provenance.spend}
                  label={sourceMetricBadgeLabel(source, "spend")}
                />
              )}
            </div>
          </div>
          <div className="sm:col-span-2 xl:col-span-1">
            <p className="text-xs font-medium uppercase tracking-wide text-[#5E6E70]">
              Next action
            </p>
            <p className="mt-2 font-medium leading-relaxed text-[#151f21]">
              {nextAction.message}
            </p>
            {nextAction.action && (
              <Link
                href={nextAction.action.href}
                className="mt-3 inline-flex min-h-10 w-fit items-center gap-2 rounded-xl bg-[#9A5524] px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#151F21] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4A9A95]"
              >
                {nextAction.action.label}
                <ArrowRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2 2xl:max-w-[320px] 2xl:justify-end">
          <Link
            href={sourceHref("/app/reports/leads", source.name)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[rgba(21,31,33,0.08)] bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
          >
            <Users className="h-4 w-4" />
            Lead report
          </Link>
          <Link
            href={sourceHref("/app/comms/calls/analytics", source.name)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[rgba(21,31,33,0.08)] bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
          >
            <CalendarCheck className="h-4 w-4" />
            Call analytics
          </Link>
          <Link
            href={sourceHref("/app/marketing/campaigns", source.name)}
            className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[rgba(21,31,33,0.08)] bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
          >
            <ExternalLink className="h-4 w-4" />
            Campaigns
          </Link>
        </div>
        {hasDataGap && (
          <p className="text-xs text-[#B42318] 2xl:col-span-2">
            {sourceDataReviewLabel(source)}. Start with the recommended action
            above, then review any remaining gaps separately.
          </p>
        )}
      </div>
    );
  };

  return (
    <ReportPageTemplate
      title="Attribution"
      subtitle="Track where leads, calls and client opportunities come from."
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
      <div className="space-y-6">
        {exportStatus && (
          <div
            role="status"
            aria-live="polite"
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
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, index) => (
              <StatCardSkeleton key={index} />
            ))}
          </div>
        )}

        {loadError && (
          <div
            role="alert"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800"
          >
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{loadError}</span>
          </div>
        )}

        <section aria-labelledby="data-confidence-heading">
          {isLoading ? (
            <CardSkeleton lines={3} />
          ) : (
            <Card padding="p-5 sm:p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[rgba(96,180,175,0.08)] text-[#4A9A95]">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div>
                    <h2
                      id="data-confidence-heading"
                      className="text-base font-semibold text-[#151f21]"
                    >
                      Data confidence
                    </h2>
                    <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#5E6E70]">
                      {loadFailures.length > 0
                        ? "Some provenance inputs are unavailable; loaded sources remain visible below. Funnel health and evidence are summarised separately."
                        : attributionIntegrationIssues.length > 0
                          ? `${attributionIntegrationIssues.length} provenance ${attributionIntegrationIssues.length === 1 ? "input needs" : "inputs need"} review. This checks connector and source completeness; funnel health and evidence are summarised separately below.`
                          : "Source, spend, revenue, and funnel provenance is healthy. Funnel health and evidence are summarised separately below."}
                    </p>
                  </div>
                </div>
                {attributionIntegrationIssues.length > 0 && (
                  <button
                    type="button"
                    aria-expanded={showIntegrationActions}
                    aria-controls="attribution-confidence-issues"
                    onClick={() =>
                      setShowIntegrationActions((current) => !current)
                    }
                    className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-[rgba(96,180,175,0.18)] bg-[rgba(96,180,175,0.08)] px-4 py-2 text-sm font-medium text-[#151F21] transition-colors hover:bg-[rgba(96,180,175,0.12)]"
                  >
                    {showIntegrationActions ? "Hide issues" : "Review issues"}
                    <ChevronDown
                      className={`h-4 w-4 transition-transform ${
                        showIntegrationActions ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>

              <div className="mt-4 border-t border-[rgba(21,31,33,0.06)] pt-4">
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
                {connectorFreshness.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="mr-1 text-[11px] font-medium text-[#5E6E70]">
                      Connector freshness
                    </span>
                    {connectorFreshness.map(
                      ({ type, label, freshness }) => (
                        <div
                          key={type}
                          className="inline-flex items-center gap-2 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-white px-3 py-2"
                        >
                          <span className="text-[11px] font-medium text-[#5E6E70]">
                            {label}
                          </span>
                          <DataProvenanceBadge
                            value={freshness.provenanceValue}
                            label={freshness.statusLabel}
                          />
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              {showIntegrationActions &&
                attributionIntegrationIssues.length > 0 && (
                  <div
                    id="attribution-confidence-issues"
                    className="mt-5 border-t border-[rgba(21,31,33,0.06)] pt-5"
                  >
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[#151f21]">
                        Provenance fixes
                      </p>
                      <Link
                        href="/app/integrations"
                        className="inline-flex items-center gap-1 text-sm font-medium text-[#151F21] hover:underline"
                      >
                        Open integrations
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {attributionIntegrationIssues.map((issue) => (
                        <div
                          key={issue.badge}
                          className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] p-4"
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-[#151f21]">
                              {issue.badge}
                            </p>
                            <DataProvenanceBadge
                              value={issue.status}
                              label={issue.statusLabel}
                            />
                          </div>
                          <p className="mt-2 text-sm leading-relaxed text-[#5E6E70]">
                            {issue.reason}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {issue.actions.map((action) => (
                              <Link
                                key={`${issue.badge}-${action.href}`}
                                href={action.href}
                                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[rgba(21,31,33,0.08)] bg-white px-3 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.05)]"
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
        </section>

        <section className="space-y-4" aria-labelledby="source-performance-heading">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h2
                id="source-performance-heading"
                className="text-lg font-semibold text-[#151f21]"
              >
                Source performance
              </h2>
              <p className="mt-1 text-sm text-[#5E6E70]">
                Compare leads, bookings, revenue, and data quality by channel.
                {!isLoading && !channelDataFailed && sourceSummary.topSource && (
                  <span className="ml-1 font-medium text-[#5E6E70]">
                    Top revenue source: {sourceSummary.topSource.displayName}.
                  </span>
                )}
                <span className="mt-1 block text-xs">
                  Bookings / leads compares activity recorded in the period; it
                  is not a cohort conversion rate.
                </span>
              </p>
            </div>
            {!isLoading && !channelDataFailed && (
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-[#5E6E70]">
                <span>{sourceSummary.trackedSources} tracked</span>
                <span>{sourceSummary.weakSources} weak booking ratio</span>
                <span>{sourceSummary.untrustedSources} data gaps</span>
              </div>
            )}
          </div>

          {!channelDataFailed && (
            <div>
              <div className="relative [&>div]:pr-8 sm:[&>div]:pr-0">
                <FilterTabs
                  tabs={[
                    "All",
                    "Needs Attention",
                    "High Booking Ratio",
                    "Untrusted Data",
                  ]}
                  active={sourceFilter}
                  onChange={(value) => {
                    setSourceFilter(value);
                    setExpandedSource(null);
                  }}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-y-0 right-0 w-9 bg-gradient-to-l from-[#F7F8F7] to-transparent sm:hidden"
                />
              </div>
              <p className="mt-1 text-[11px] text-[#5E6E70] sm:hidden">
                Swipe to view all filters
              </p>
            </div>
          )}

          {!isLoading &&
            !channelDataFailed &&
            (channelCoverage.bookings || channelCoverage.revenue) && (
              <div className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-white p-4 sm:p-5">
                <div className="grid gap-3 sm:grid-cols-[150px_minmax(0,1fr)_minmax(0,1fr)] sm:items-stretch">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(96,180,175,0.08)] text-[#4A9A95]">
                      <Link2 className="h-4 w-4" />
                    </div>
                    <p className="pt-1.5 text-sm font-semibold text-[#151f21]">
                      Source totals
                    </p>
                  </div>
                  {channelCoverage.bookings && (
                    <div className="rounded-xl bg-[#FAF9F7] px-3 py-3">
                      <p className="text-xs font-medium text-[#5E6E70]">
                        Call/demo bookings
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#151f21]">
                        {formatNumber(channelCoverage.bookings.represented)} in
                        source rows ·{" "}
                        {formatNumber(channelCoverage.bookings.headline)} in
                        funnel
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#5E6E70]">
                        {channelCoverage.bookings.direction ===
                        "headline_higher"
                          ? `${formatNumber(channelCoverage.bookings.difference)} fewer bookings appear in source rows.`
                          : channelCoverage.bookings.direction ===
                              "source_rows_higher"
                            ? `Source rows are ${formatNumber(channelCoverage.bookings.difference)} bookings higher than the funnel; review source aliases.`
                            : "Funnel and source-row booking totals match."}
                      </p>
                    </div>
                  )}
                  {channelCoverage.revenue && (
                    <div className="rounded-xl bg-[#FAF9F7] px-3 py-3">
                      <p className="text-xs font-medium text-[#5E6E70]">
                        Source-linked revenue
                      </p>
                      <p className="mt-1 text-sm font-semibold text-[#151f21]">
                        {formatCurrency(channelCoverage.revenue.represented)}{" "}
                        source-linked ·{" "}
                        {formatCurrency(channelCoverage.revenue.headline)}{" "}
                        overall
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-[#5E6E70]">
                        {channelCoverage.revenue.direction ===
                        "headline_higher"
                          ? `${formatCurrency(channelCoverage.revenue.difference)} is other or unallocated revenue.`
                          : channelCoverage.revenue.direction ===
                              "source_rows_higher"
                            ? `Source rows are ${formatCurrency(channelCoverage.revenue.difference)} higher than overall revenue; review source aliases.`
                            : "Overall and source-linked revenue totals match."}
                      </p>
                    </div>
                  )}
                </div>
                <p className="mt-3 text-xs leading-relaxed text-[#5E6E70] sm:ml-[162px]">
                  These are aggregate comparisons, not record-level matching.
                  Revenue differences can include won deals or records without
                  a source.{" "}
                  {getAttributionSpendAllocationNote(
                    channelRevenue?.spendAllocation,
                  )}
                </p>
              </div>
            )}

          <div className="space-y-3 2xl:hidden">
            {isLoading && <CardSkeleton lines={5} />}
            {!isLoading && channelDataFailed && (
              <Card padding="p-5">
                <p className="text-sm font-semibold text-[#151f21]">
                  Channel performance is unavailable
                </p>
                <p className="mt-1 text-sm text-[#5E6E70]">
                  Try this report again once channel revenue data can be loaded.
                </p>
              </Card>
            )}
            {!isLoading && !channelDataFailed && filteredSources.length === 0 && (
              <Card padding="p-5">
                <p className="text-sm text-[#5E6E70]">
                  No attribution sources match this filter for the selected
                  period.
                </p>
              </Card>
            )}
            {!isLoading &&
              !channelDataFailed &&
              filteredSources.map((source) => {
                const isExpanded = expandedSource === source.name;
                const weakFields = weakSourceProvenanceFields(source);
                const detailsId = `source-details-mobile-${normaliseSourceName(source.name)}`;

                return (
                  <Card key={source.name} padding="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-[#151f21]">
                          {source.displayName}
                        </p>
                        <p className="mt-0.5 text-xs text-[#5E6E70]">
                          Revenue
                        </p>
                        <p className="mt-0.5 text-lg font-semibold text-[#151F21]">
                          {source.revenue}
                        </p>
                      </div>
                      <DataProvenanceBadge
                        value={weakFields[0]?.value || "exact"}
                        label={sourceDataReviewLabel(source)}
                        size="sm"
                      />
                    </div>
                    <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-3 border-y border-[rgba(21,31,33,0.06)] py-3 text-sm">
                      <div>
                        <dt className="text-[11px] text-[#5E6E70]">Leads</dt>
                        <dd className="mt-1 font-semibold text-[#151f21]">
                          {source.leads}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#5E6E70]">
                          Bookings
                        </dt>
                        <dd className="mt-1 font-semibold text-[#151f21]">
                          {source.bookings}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#5E6E70]">Spend</dt>
                        <dd className="mt-1 font-semibold text-[#151f21]">
                          {source.spend}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#5E6E70]">CPL</dt>
                        <dd className="mt-1 font-semibold text-[#151f21]">
                          {source.cpl}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#5E6E70]">ROAS</dt>
                        <dd className="mt-1 font-semibold text-[#151f21]">
                          {source.roas}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-[11px] text-[#5E6E70]">
                          Bookings / leads
                        </dt>
                        <dd className="mt-1 font-semibold text-[#151f21]">
                          {source.convRate}
                        </dd>
                      </div>
                    </dl>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      aria-controls={detailsId}
                      aria-label={`${isExpanded ? "Hide" : "Show"} actions for ${source.displayName}`}
                      onClick={() => toggleSource(source.name)}
                      className="mt-3 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-xl bg-[rgba(96,180,175,0.08)] px-4 py-2 text-sm font-medium text-[#151F21] transition-colors hover:bg-[rgba(96,180,175,0.12)]"
                    >
                      {isExpanded ? "Hide details" : "Details & actions"}
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                    {isExpanded && (
                      <div
                        id={detailsId}
                        className="mt-4 border-t border-[rgba(21,31,33,0.06)] pt-4"
                      >
                        {renderSourceDetails(source)}
                      </div>
                    )}
                  </Card>
                );
              })}
          </div>

          <div className="hidden 2xl:block">
            <DataTable
              className="[&_table]:min-w-[1020px] [&_td]:px-3 [&_th]:px-3"
              headers={[
                { label: "Source" },
                { label: "Leads" },
                { label: "Bookings" },
                { label: "Spend" },
                { label: "Revenue" },
                { label: "CPL" },
                { label: "ROAS" },
                { label: "Bookings / leads" },
                { label: "Data" },
                { label: "", className: "text-right" },
              ]}
            >
              {isLoading &&
                Array.from({ length: 5 }, (_, index) => (
                  <TableRowSkeleton key={index} columns={10} />
                ))}
              {!isLoading && channelDataFailed && (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-10 text-center text-sm text-[#5E6E70]"
                  >
                    Channel performance could not be loaded for this period.
                  </td>
                </tr>
              )}
              {!isLoading &&
                !channelDataFailed &&
                filteredSources.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-6 py-10 text-center text-sm text-[#5E6E70]"
                    >
                      No attribution sources match this filter for the selected
                      period.
                    </td>
                  </tr>
                )}
              {!isLoading &&
                !channelDataFailed &&
                filteredSources.map((source) => {
                  const isExpanded = expandedSource === source.name;
                  const weakFields = weakSourceProvenanceFields(source);
                  const detailsId = `source-details-desktop-${normaliseSourceName(source.name)}`;

                  return (
                    <Fragment key={source.name}>
                      <TableRow>
                        <TableCell className="min-w-[160px] font-medium text-[#151F21]">
                          {source.displayName}
                        </TableCell>
                        <TableCell className="text-[#5E6E70]">
                          {source.leads}
                        </TableCell>
                        <TableCell className="text-[#5E6E70]">
                          {source.bookings}
                        </TableCell>
                        <TableCell className="font-medium text-[#151F21]">
                          {source.spend}
                        </TableCell>
                        <TableCell className="font-medium text-[#151F21]">
                          {source.revenue}
                        </TableCell>
                        <TableCell className="text-[#5E6E70]">
                          {source.cpl}
                        </TableCell>
                        <TableCell className="font-medium text-[#151F21]">
                          {source.roas}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`text-sm font-medium ${
                              source.convRateValue === null
                                ? "text-[#5E6E70]"
                                : source.convRateValue >= 30
                                ? "text-green-600"
                                : source.convRateValue < 20
                                  ? "text-[#B42318]"
                                  : "text-[#5E6E70]"
                            }`}
                          >
                            {source.convRate}
                          </span>
                        </TableCell>
                        <TableCell>
                          <DataProvenanceBadge
                            value={weakFields[0]?.value || "exact"}
                            label={sourceDataReviewLabel(source)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <button
                            type="button"
                            aria-expanded={isExpanded}
                            aria-controls={detailsId}
                            aria-label={`${isExpanded ? "Hide" : "Show"} actions for ${source.displayName}`}
                            onClick={() => toggleSource(source.name)}
                            className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-[rgba(96,180,175,0.18)] bg-[rgba(96,180,175,0.08)] px-3 py-2 text-xs font-medium text-[#151F21] transition-colors hover:bg-[rgba(96,180,175,0.12)]"
                          >
                            {isExpanded ? "Close" : "Details"}
                            <ChevronDown
                              className={`h-3.5 w-3.5 transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            />
                          </button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <tr className="border-b border-[rgba(21,31,33,0.04)]">
                          <td colSpan={10} className="px-6 py-5">
                            <div
                              id={detailsId}
                              className="rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] p-5"
                            >
                              {renderSourceDetails(source)}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
            </DataTable>
          </div>
        </section>

        {!isLoading && (
          <section aria-labelledby="attribution-audit-heading">
            <Card padding="p-0" className="overflow-hidden">
              <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h2
                    id="attribution-audit-heading"
                    className="text-base font-semibold text-[#151f21]"
                  >
                    Funnel health &amp; evidence
                  </h2>
                  <p className="mt-1 text-sm text-[#5E6E70]">
                    Summarises aggregate period counts, source completeness,
                    and linked recovery evidence. Period ratios are not cohort
                    conversion rates, and this does not claim record-level
                    source-to-revenue tracing.
                  </p>
                  <p className="mt-2 text-sm font-medium text-[#151f21]">
                    {auditSummary}
                  </p>
                </div>
                <button
                  type="button"
                  aria-expanded={showAuditDetails}
                  aria-controls="attribution-audit-details"
                  onClick={() => setShowAuditDetails((current) => !current)}
                  className="inline-flex min-h-11 w-fit items-center gap-2 rounded-xl border border-[rgba(21,31,33,0.08)] bg-white px-4 py-2 text-sm font-medium text-[#151f21] transition-colors hover:bg-[rgba(21,31,33,0.04)]"
                >
                  {showAuditDetails ? "Hide checks" : "View checks"}
                  <ChevronDown
                    className={`h-4 w-4 transition-transform ${
                      showAuditDetails ? "rotate-180" : ""
                    }`}
                  />
                </button>
              </div>

              {showAuditDetails && (
                <div
                  id="attribution-audit-details"
                  className="grid border-t border-[rgba(21,31,33,0.06)] lg:grid-cols-2"
                >
                  <div className="p-5 sm:p-6 lg:border-r lg:border-[rgba(21,31,33,0.06)]">
                    <h3 className="text-sm font-semibold text-[#151f21]">
                      Funnel checks
                    </h3>
                    <div className="mt-4 space-y-3">
                      {chainChecks.map((check) => {
                        const Icon =
                          check.neutral || check.informational
                            ? Target
                            : check.ok
                              ? CheckCircle
                              : AlertTriangle;
                        return (
                          <div
                            key={check.label}
                            className="flex items-start gap-3 rounded-2xl bg-[#FAF9F7] p-4"
                          >
                            <div
                              className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${
                                check.neutral || check.informational
                                  ? "bg-[rgba(94,110,112,0.1)] text-[#5E6E70]"
                                  : check.ok
                                  ? "bg-[rgba(96,180,175,0.1)] text-[#151f21]"
                                  : "bg-[rgba(183,103,46,0.1)] text-[#9A5524]"
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-[#151f21]">
                                  {check.label}
                                </p>
                                <span className="shrink-0 text-sm font-bold text-[#151f21]">
                                  {check.value}
                                </span>
                              </div>
                              <p className="mt-1 text-xs text-[#5E6E70]">
                                {check.detail}
                              </p>
                              {!check.ok && !check.value.includes("Unavailable") && (
                                <p className="mt-2 text-xs font-medium text-[#B42318]">
                                  {check.action}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-5 sm:p-6">
                    <div className="flex items-center justify-between gap-3">
                      <h3 className="text-sm font-semibold text-[#151f21]">
                        Linked evidence
                      </h3>
                      <Link2 className="h-4 w-4 text-[#4A9A95]" />
                    </div>
                    <div className="mt-4 space-y-3">
                      {loadFailures.includes("leak details") ? (
                        <div className="rounded-2xl bg-[#FAF9F7] p-4 text-sm text-[#5E6E70]">
                          Recovery evidence could not be loaded for this period.
                        </div>
                      ) : leakDetails.length === 0 ? (
                        <div className="rounded-2xl bg-[#FAF9F7] p-4 text-sm text-[#5E6E70]">
                          No recovery risks need supporting evidence in this
                          period.
                        </div>
                      ) : (
                        <div className="rounded-2xl bg-[#FAF9F7] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[#151f21]">
                              Recovery evidence linked
                            </span>
                            <span className="text-sm font-bold text-[#151f21]">
                              {attributionAudit.linkedLeakRecords}/
                              {leakDetails.length}
                            </span>
                          </div>
                          <div className="mt-3">
                            <ProgressBar
                              value={attributionAudit.leakLinkCoverage}
                              color="green"
                            />
                          </div>
                        </div>
                      )}

                      {linkedEvidenceSummary.evidenceTypes.length > 0 && (
                        <div className="grid grid-cols-2 gap-2">
                          {linkedEvidenceSummary.evidenceTypes.map((item) => (
                            <Link
                              key={item.label}
                              href={item.href}
                              className="flex min-h-10 items-center justify-between gap-3 rounded-xl border border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] px-3 py-2 text-sm transition-colors hover:bg-[rgba(96,180,175,0.08)]"
                            >
                              <span className="font-medium text-[#151f21]">
                                {item.label}
                              </span>
                              <span className="font-semibold text-[#151f21]">
                                {item.value}
                              </span>
                            </Link>
                          ))}
                        </div>
                      )}

                      {linkedEvidenceSummary.sampleRecords.length > 0 && (
                        <div className="rounded-2xl bg-[#FAF9F7] p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-[#151f21]">
                              Sample evidence
                            </span>
                            <Link
                              href="/app/revenue"
                              className="text-xs font-medium text-[#151F21] hover:underline"
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
                                    <UserRound className="h-4 w-4 shrink-0 text-[#4A9A95]" />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium text-[#151f21]">
                                        {record.contactName || "Unknown contact"}
                                      </p>
                                      <p className="truncate text-xs text-[#5E6E70]">
                                        {record.reason || record.nextAction}
                                      </p>
                                    </div>
                                  </div>
                                  <span className="shrink-0 text-xs font-semibold text-[#5E6E70]">
                                    {formatCurrency(record.estimatedRisk)}
                                  </span>
                                </>
                              );

                              return contactHref ? (
                                <Link
                                  key={record.id}
                                  href={contactHref}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(21,31,33,0.06)] bg-white px-3 py-2 transition-colors hover:bg-[rgba(96,180,175,0.08)]"
                                >
                                  {rowContent}
                                </Link>
                              ) : (
                                <div
                                  key={record.id}
                                  className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(21,31,33,0.06)] bg-white px-3 py-2"
                                >
                                  {rowContent}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      <div className="rounded-2xl bg-[#FAF9F7] p-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-[#151f21]">
                            Open opportunities tracked
                          </span>
                          <span className="text-sm font-bold text-[#151f21]">
                            {loadFailures.includes("opportunities")
                              ? "Unavailable"
                              : opportunities?.summary.dealsCount || 0}
                          </span>
                        </div>
                        {!loadFailures.includes("opportunities") && (
                          <p className="mt-2 text-xs text-[#5E6E70]">
                            {formatCurrency(
                              (opportunities?.summary.totalValueCents || 0) / 100,
                            )}{" "}
                            in open pipeline value.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </Card>
          </section>
        )}
      </div>
    </ReportPageTemplate>
  );
}
