import type {
  ConnectorStatusRecord,
  MarketingConnectorType,
} from "@/lib/api-types";
import { normaliseMarketingSource } from "@/lib/marketing-source-filter";

export type AttributionMetricComparison = {
  headline: number;
  represented: number;
  difference: number;
  direction: "balanced" | "headline_higher" | "source_rows_higher";
};

export type AttributionSourceEvidence = {
  name: string;
  leads: number;
  bookings: number;
  revenueValue: number;
  spendValue: number;
  provenance: {
    leads: string;
    revenue: string;
    spend: string;
  };
};

export type AttributionSourceReviewField = {
  label: "Leads" | "Spend" | "Revenue";
  value: string;
};

export type AttributionSpendAllocationMetadata = {
  method: string;
  description: string;
  proratedRows: number;
};

export type AttributionConnectorFreshnessInput = {
  configured: boolean;
  setupStatus: string;
  healthStatus?: string | null;
  lastSyncStatus?: string | null;
  dataFreshness?: {
    status: "fresh" | "stale" | "never_synced";
    ageHours: number | null;
  } | null;
};

export type AttributionSourceNextAction = {
  message: string;
  action: {
    label: string;
    href: string;
  } | null;
};

const SOURCE_CONNECTOR_TYPES = new Set<MarketingConnectorType>([
  "google_ads",
  "meta",
  "google_business_profile",
  "seo",
]);

const DEFAULT_SPEND_CONNECTOR_TYPES = new Set<MarketingConnectorType>([
  "google_ads",
  "meta",
]);

function filteredSourceHref(path: string, source: string) {
  return `${path}?source=${encodeURIComponent(source)}`;
}

function connectorImportsSpend(
  connectorType: MarketingConnectorType,
  connector: ConnectorStatusRecord | undefined,
) {
  if (!connector) return DEFAULT_SPEND_CONNECTOR_TYPES.has(connectorType);
  return connector.supportedMetrics.some(
    (metric) => metric.trim().toLowerCase() === "spend",
  );
}

export function getAttributionConnectorTypeForSource(
  source: string | null | undefined,
) {
  const normalised = normaliseMarketingSource(source);
  return SOURCE_CONNECTOR_TYPES.has(normalised as MarketingConnectorType)
    ? (normalised as MarketingConnectorType)
    : null;
}

export function getAttributionSourceNextAction(
  source: AttributionSourceEvidence & {
    convRateValue: number | null;
  },
  options: {
    connectors: ConnectorStatusRecord[];
    connectorStatusAvailable: boolean;
    canManageConnectors: boolean;
  },
): AttributionSourceNextAction {
  const weakFields = getAttributionSourceReviewFields(source);
  const hasSpendGap = weakFields.some((field) => field.label === "Spend");
  const hasLeadGap = weakFields.some((field) => field.label === "Leads");
  const hasRevenueGap = weakFields.some((field) => field.label === "Revenue");
  const remainingCrmGapMessage =
    hasLeadGap && hasRevenueGap
      ? " Lead sources and revenue links still need separate CRM review."
      : hasLeadGap
        ? " Lead sources still need separate CRM review."
        : hasRevenueGap
          ? " Revenue links still need separate CRM review."
          : "";

  if (hasSpendGap) {
    const connectorType = getAttributionConnectorTypeForSource(source.name);
    const connector = connectorType
      ? options.connectors.find((item) => item.type === connectorType)
      : undefined;
    const connectorName =
      connector?.name ||
      (connectorType ? attributionSourceDisplayName(connectorType) : null);
    const connectorReady = Boolean(
      connector &&
        connector.configured &&
        connector.oauthConnected &&
        !connector.selectionRequired &&
        connector.setupStatus === "ready",
    );

    if (!connectorType || !connectorName) {
      return {
        message:
          "No supported connector is mapped to this source. Review how its campaign spend is imported." +
          remainingCrmGapMessage,
        action: {
          label: "Review campaigns",
          href: filteredSourceHref("/app/marketing/campaigns", source.name),
        },
      };
    }

    if (!connectorImportsSpend(connectorType, connector)) {
      return {
        message: `${connectorName} reports marketing activity but does not import spend. Review this source's campaign spend.${remainingCrmGapMessage}`,
        action: {
          label: "Review campaigns",
          href: filteredSourceHref("/app/marketing/campaigns", source.name),
        },
      };
    }

    if (!options.canManageConnectors) {
      return {
        message:
          "A team member with integration access needs to connect or sync spend data for this source." +
          remainingCrmGapMessage,
        action: {
          label: "Review campaigns",
          href: filteredSourceHref("/app/marketing/campaigns", source.name),
        },
      };
    }

    if (!options.connectorStatusAvailable) {
      return {
        message:
          "Connector status is unavailable, so review integrations before changing spend data." +
          remainingCrmGapMessage,
        action: {
          label: "Review integrations",
          href: "/app/integrations",
        },
      };
    }

    if (!connectorReady) {
      return {
        message: `Connect ${connectorName} to start importing spend for this source.${remainingCrmGapMessage}`,
        action: {
          label: `Connect ${connectorName}`,
          href: `/app/integrations?connector=${connectorType}`,
        },
      };
    }

    if (connector?.backfillSupported && connectorType !== "meta") {
      return {
        message: `${connectorName} is connected. Preview a historical backfill to recover missing spend for this source.${remainingCrmGapMessage}`,
        action: {
          label: `Backfill ${connectorName}`,
          href: `/app/integrations?connector=${connectorType}&action=backfill`,
        },
      };
    }

    return {
      message: `${connectorName} is connected, but historical backfill is not available. Review the connector and sync its latest data.${remainingCrmGapMessage}`,
      action: {
        label: `Review ${connectorName}`,
        href: `/app/integrations?connector=${connectorType}`,
      },
    };
  }

  if (hasRevenueGap) {
    return {
      message:
        "Review CRM revenue records; provider backfills cannot reconstruct source-to-revenue links.",
      action: {
        label: "Review revenue",
        href: "/app/revenue",
      },
    };
  }

  if (hasLeadGap) {
    return {
      message:
        "Review lead-source records for this source; provider backfills cannot relabel existing CRM leads.",
      action: {
        label: "Review leads",
        href: filteredSourceHref("/app/reports/leads", source.name),
      },
    };
  }

  if (source.convRateValue === null) {
    return {
      message:
        "Review source and date coverage; a period booking ratio needs at least one in-period lead.",
      action: {
        label: "Review leads",
        href: filteredSourceHref("/app/reports/leads", source.name),
      },
    };
  }

  if (source.convRateValue < 20) {
    return {
      message:
        "Review period lead and booking activity, then check source and date coverage.",
      action: {
        label: "Review leads",
        href: filteredSourceHref("/app/reports/leads", source.name),
      },
    };
  }

  return {
    message: "Keep monitoring spend, bookings, and revenue quality.",
    action: null,
  };
}

const SOURCE_LABELS: Record<string, string> = {
  direct: "Direct",
  email: "Email",
  facebook: "Meta Ads",
  facebook_ads: "Meta Ads",
  google: "Google Ads",
  google_adwords: "Google Ads",
  google_ads: "Google Ads",
  google_business_profile: "Google Business Profile",
  google_my_business: "Google Business Profile",
  instagram: "Meta Ads",
  instagram_ads: "Meta Ads",
  meta: "Meta Ads",
  meta_ads: "Meta Ads",
  organic: "Organic",
  organic_search: "Organic Search",
  paid_search: "Google Ads",
  paid_social: "Meta Ads",
  ppc: "Google Ads",
  referral: "Referral",
  seo: "SEO",
  tiktok_ads: "TikTok Ads",
  website: "Website",
};

const ORGANIC_SOURCE_KEYS = new Set([
  "direct",
  "organic",
  "organic_search",
  "referral",
  "seo",
]);

const PAID_SOURCE_KEYS = new Set([
  "adwords",
  "facebook",
  "facebook_ads",
  "google",
  "google_adwords",
  "google_ads",
  "instagram",
  "instagram_ads",
  "meta",
  "meta_ads",
  "paid_search",
  "paid_social",
  "ppc",
  "tiktok_ads",
]);

function finiteNonNegative(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

export function normaliseAttributionSourceName(
  value: string | null | undefined,
) {
  return String(value || "unknown")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

export function attributionSourceDisplayName(
  value: string | null | undefined,
) {
  const key = normaliseAttributionSourceName(value);
  if (SOURCE_LABELS[key]) return SOURCE_LABELS[key];
  if (key === "unknown") return "Unknown";

  return key
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function isOrganicAttributionSource(
  value: string | null | undefined,
) {
  return ORGANIC_SOURCE_KEYS.has(normaliseAttributionSourceName(value));
}

export function isPaidAttributionSource(
  value: string | null | undefined,
) {
  const key = normaliseAttributionSourceName(value);
  return (
    PAID_SOURCE_KEYS.has(key) ||
    key.startsWith("paid_") ||
    key.endsWith("_ads")
  );
}

export function isWeakAttributionProvenance(value: string) {
  const normalized = value.toLowerCase();
  return (
    normalized.includes("unknown") ||
    normalized.includes("manual") ||
    normalized.includes("estimate") ||
    normalized.includes("fallback") ||
    normalized.includes("partial") ||
    normalized.includes("sample")
  );
}

export function isAttributionRevenueLinked(
  provenance: string | null | undefined,
) {
  const normalized = String(provenance || "")
    .trim()
    .toLowerCase();
  return Boolean(
    normalized &&
      !normalized.includes("unknown") &&
      !normalized.includes("unlinked") &&
      !normalized.includes("missing"),
  );
}

export function getAttributionSourceMetricState(
  source: AttributionSourceEvidence,
) {
  const organic = isOrganicAttributionSource(source.name);
  const paid = isPaidAttributionSource(source.name);
  const hasTrackedSpend = source.spendValue > 0;

  return {
    organic,
    paid,
    hasTrackedSpend,
    hasMeasuredCpl: hasTrackedSpend && source.leads > 0,
    hasMeasuredRoas:
      hasTrackedSpend &&
      isAttributionRevenueLinked(source.provenance.revenue),
    spendKind: hasTrackedSpend
      ? ("tracked" as const)
      : organic
        ? ("organic" as const)
        : ("untracked" as const),
  };
}

export function getAttributionSpendAllocationNote(
  allocation: AttributionSpendAllocationMetadata | null | undefined,
) {
  if (!allocation) {
    return "Spend allocation details were not returned for this report.";
  }

  const description =
    allocation.description.trim() ||
    (allocation.method === "calendar_day_proration"
      ? "Spend entries overlapping a partial selected period are allocated by inclusive calendar days."
      : "Spend is allocated using the method returned by the report.");
  const punctuatedDescription = /[.!?]$/.test(description)
    ? description
    : `${description}.`;
  const proratedRows = Number.isFinite(allocation.proratedRows)
    ? Math.max(Math.round(allocation.proratedRows), 0)
    : 0;

  if (proratedRows === 0) {
    return `${punctuatedDescription} No overlapping spend rows required proration.`;
  }

  return `${punctuatedDescription} ${proratedRows} overlapping spend ${
    proratedRows === 1 ? "row was" : "rows were"
  } prorated.`;
}

function formatAttributionConnectorAge(ageHours: number | null) {
  if (ageHours === null || !Number.isFinite(ageHours)) return null;
  const safeHours = Math.max(Math.round(ageHours), 0);
  if (safeHours < 48) return `${safeHours}h old`;
  return `${Math.round(safeHours / 24)}d old`;
}

export function getAttributionConnectorFreshness(
  connector: AttributionConnectorFreshnessInput,
) {
  if (!connector.configured || connector.setupStatus !== "ready") return null;

  const freshnessStatus = connector.dataFreshness?.status || "never_synced";
  const status =
    connector.lastSyncStatus === "failed"
      ? "sync_failed"
      : connector.healthStatus === "error"
        ? "connector_error"
        : freshnessStatus;
  const ageLabel = formatAttributionConnectorAge(
    connector.dataFreshness?.ageHours ?? null,
  );
  let statusLabel: string;
  if (status === "sync_failed") {
    statusLabel = `Sync failed${ageLabel ? ` · last good data ${ageLabel}` : ""}`;
  } else if (status === "connector_error") {
    statusLabel = `Connector error${ageLabel ? ` · last good data ${ageLabel}` : ""}`;
  } else if (status === "never_synced") {
    statusLabel = "Never synced";
  } else {
    statusLabel = `${status === "fresh" ? "Fresh" : "Stale"}${
      ageLabel ? ` · ${ageLabel}` : ""
    }`;
  }

  return {
    status,
    statusLabel,
    ageLabel,
    needsReview: status !== "fresh",
    provenanceValue:
      status === "fresh"
        ? ("live" as const)
        : status === "stale" ||
            ((status === "sync_failed" || status === "connector_error") &&
              freshnessStatus !== "never_synced")
          ? ("partial" as const)
          : ("unknown" as const),
  };
}

export function getAttributionSoldAttendedAudit(
  attendedValue: number,
  soldValue: number,
) {
  const attended = finiteNonNegative(attendedValue);
  const sold = finiteNonNegative(soldValue);

  if (attended === 0 && sold === 0) {
    return {
      attended,
      sold,
      value: null,
      label: "No outcomes",
      neutral: true,
      informational: false,
    };
  }

  return {
    attended,
    sold,
    value: null,
    label: "Counts only",
    neutral: false,
    informational: true,
  };
}

export function getAttributionSourceReviewFields(
  source: AttributionSourceEvidence,
): AttributionSourceReviewField[] {
  const { paid, hasTrackedSpend } = getAttributionSourceMetricState(source);
  const hasOutcomes =
    source.leads > 0 || source.bookings > 0 || source.revenueValue > 0;
  const expectsSpend = hasTrackedSpend || (paid && hasOutcomes);

  return [
    {
      label: "Leads" as const,
      value: source.provenance.leads,
      relevant: source.leads > 0 || hasTrackedSpend,
    },
    {
      label: "Spend" as const,
      value: source.provenance.spend,
      relevant: expectsSpend,
    },
    {
      label: "Revenue" as const,
      value: source.provenance.revenue,
      relevant: source.revenueValue > 0 || hasOutcomes || hasTrackedSpend,
    },
  ]
    .filter(
      (field) =>
        field.relevant && isWeakAttributionProvenance(field.value),
    )
    .map(({ label, value }) => ({ label, value }));
}

export function attributionProvenanceReviewLabel(value: string) {
  const normalized = value.toLowerCase();
  if (normalized.includes("unknown")) return "Missing";
  if (normalized.includes("manual")) return "Manual";
  if (normalized.includes("estimate")) return "Estimated";
  if (normalized.includes("fallback")) return "Fallback";
  if (normalized.includes("partial")) return "Partial";
  if (normalized.includes("sample")) return "Sample";
  return "Review";
}

export function getAttributionSourceReviewLabel(
  source: AttributionSourceEvidence,
) {
  const weakFields = getAttributionSourceReviewFields(source);
  if (weakFields.length === 0) return "Complete";
  if (weakFields.length > 1) return `${weakFields.length} fields to review`;
  return `${weakFields[0].label}: ${attributionProvenanceReviewLabel(
    weakFields[0].value,
  )}`;
}

export function getAttributionFunnelCounts(
  stages:
    | Array<{
        key: string;
        count: number;
      }>
    | null
    | undefined,
) {
  const count = (key: string) =>
    stages?.find((stage) => stage.key === key)?.count ?? 0;

  return {
    leads: count("leads"),
    bookedConsults: count("bookedConsults"),
    attendedConsults: count("attendedConsults"),
    soldTreatments: count("soldTreatments"),
  };
}

export function getAttributionBookingRatio(
  leadsValue: number,
  bookingsValue: number,
) {
  const leads = finiteNonNegative(leadsValue);
  const bookings = finiteNonNegative(bookingsValue);
  if (leads === 0) {
    return {
      value: null,
      label: "—",
    };
  }

  const value = Math.round((bookings / leads) * 100);
  return {
    value,
    label: `${value}%`,
  };
}

export function compareAttributionMetric(
  headlineValue: number,
  sourceRowsValue: number,
): AttributionMetricComparison {
  const headline = finiteNonNegative(headlineValue);
  const represented = finiteNonNegative(sourceRowsValue);
  const rawDifference = headline - represented;
  const difference =
    Math.abs(rawDifference) < 0.005 ? 0 : Math.abs(rawDifference);

  return {
    headline,
    represented,
    difference,
    direction:
      difference === 0
        ? "balanced"
        : rawDifference > 0
          ? "headline_higher"
          : "source_rows_higher",
  };
}
