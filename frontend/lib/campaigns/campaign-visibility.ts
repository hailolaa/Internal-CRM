import type {
  CampaignMediaRecord,
  CampaignMetricRecord,
  CampaignRecord,
  PlatformMetricRecord,
} from "@/lib/api-types";

export type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  sourceKey: string;
  budgetValue: number;
  spentValue: number;
  leads: number;
  bookings: number;
  cplValue: number;
  roasValue: number;
  revenueValue: number;
  impressionsValue: number;
  clicksValue: number;
  conversionsValue: number;
  ctrValue: number;
  costPerClickValue: number;
  conversionRateValue: number;
  costPerConversionValue: number;
  spendAvailable: boolean;
  impressionsAvailable: boolean;
  clicksAvailable: boolean;
  conversionsAvailable: boolean;
  ctrAvailable: boolean;
  costPerClickAvailable: boolean;
  conversionRateAvailable: boolean;
  costPerConversionAvailable: boolean;
  status: string;
  attribution: string | null;
  media: CampaignMediaRecord[];
  readOnly: boolean;
  providerSynced: boolean;
  providerMetricsAvailable: boolean;
  outcomesLinked: boolean;
};

type AggregatedCampaignMetric = {
  key: string;
  name: string;
  sourceKey: string;
  spend: number;
  primarySpend: number;
  providerSpend: number;
  hasPrimarySpend: boolean;
  impressions: number;
  clicks: number;
  conversions: number;
  leads: number;
  bookedConsults: number;
  revenue: number;
  attribution: string | null;
  connectorManaged: boolean;
  providerMetricsAvailable: boolean;
  providerMetricSources: Record<ProviderMetricName, ProviderMetricSource>;
};

type ProviderMetricName = "spend" | "impressions" | "clicks" | "conversions";
type ProviderMetricSource = "connector" | "fallback" | null;

const PROVIDER_METRIC_FIELDS = {
  spend: "providerSpend",
  impressions: "impressions",
  clicks: "clicks",
  conversions: "conversions",
} as const;

const CAMPAIGN_PERFORMANCE_SOURCES = new Set(["google_ads", "meta"]);

const SOURCE_ALIASES: Record<string, string> = {
  facebook_ads: "meta",
  facebook: "meta",
  google: "google_ads",
  googleads: "google_ads",
  google_my_business: "google_business_profile",
  instagram_ads: "meta",
  instagram: "meta",
  meta_ads: "meta",
  paid_search: "google_ads",
  paid_social: "meta",
  ppc: "google_ads",
};

const SOURCE_LABELS: Record<string, string> = {
  ga4: "Google Analytics 4",
  google_ads: "Google Ads",
  google_business_profile: "Google Business Profile",
  meta: "Meta Ads",
  seo: "SEO",
};

export function normaliseCampaignSource(value: string | null | undefined) {
  const key = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

  return SOURCE_ALIASES[key] || key;
}

export function campaignSourceLabel(value: string | null | undefined) {
  const key = normaliseCampaignSource(value);
  if (!key) return "Marketing";
  return (
    SOURCE_LABELS[key] ||
    key.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase())
  );
}

export function isCampaignPerformanceSource(
  value: string | null | undefined,
) {
  return CAMPAIGN_PERFORMANCE_SOURCES.has(normaliseCampaignSource(value));
}

export function buildCampaignRows(
  savedCampaigns: CampaignRecord[],
  metrics: CampaignMetricRecord[],
  platformMetrics: PlatformMetricRecord[] = [],
): CampaignRow[] {
  const aggregates = aggregateCampaignMetrics(metrics, platformMetrics);
  const unusedAggregates = new Map(
    aggregates.map((metric) => [metric.key, metric]),
  );

  const savedRows = savedCampaigns.map((campaign) => {
    const nameKey = normaliseCampaignName(campaign.name);
    const savedSourceKey = normaliseCampaignSource(campaign.channel);
    const exactKey = buildMetricKey(savedSourceKey, nameKey);
    let metric = savedSourceKey ? unusedAggregates.get(exactKey) : undefined;

    if (!metric && !savedSourceKey) {
      const nameMatches = [...unusedAggregates.values()].filter(
        (candidate) => normaliseCampaignName(candidate.name) === nameKey,
      );
      if (nameMatches.length === 1) metric = nameMatches[0];
    }

    if (metric) unusedAggregates.delete(metric.key);
    const sourceKey = savedSourceKey || metric?.sourceKey || "marketing";
    const spendAvailable = Boolean(
      metric?.hasPrimarySpend || metric?.providerMetricSources.spend,
    );
    const impressionsAvailable = Boolean(
      metric?.providerMetricSources.impressions,
    );
    const clicksAvailable = Boolean(metric?.providerMetricSources.clicks);
    const conversionsAvailable = Boolean(
      metric?.providerMetricSources.conversions,
    );
    const ctrAvailable = Boolean(
      impressionsAvailable && clicksAvailable && (metric?.impressions || 0) > 0,
    );
    const costPerClickAvailable = Boolean(
      spendAvailable && clicksAvailable && (metric?.clicks || 0) > 0,
    );
    const conversionRateAvailable = Boolean(
      clicksAvailable && conversionsAvailable && (metric?.clicks || 0) > 0,
    );
    const costPerConversionAvailable = Boolean(
      spendAvailable &&
        conversionsAvailable &&
        (metric?.conversions || 0) > 0,
    );

    return {
      id: campaign.id,
      name: campaign.name,
      channel:
        campaign.channel ||
        (metric ? campaignSourceLabel(metric.sourceKey) : campaign.type) ||
        "Marketing",
      sourceKey,
      budgetValue: campaign.budget || 0,
      spentValue: metric?.spend || 0,
      leads: metric?.leads || 0,
      bookings: metric?.bookedConsults || 0,
      cplValue: divideMetric(metric?.spend || 0, metric?.leads || 0),
      roasValue: divideMetric(metric?.revenue || 0, metric?.spend || 0),
      revenueValue: metric?.revenue || 0,
      impressionsValue: metric?.impressions || 0,
      clicksValue: metric?.clicks || 0,
      conversionsValue: metric?.conversions || 0,
      ctrValue: percentageMetric(metric?.clicks || 0, metric?.impressions || 0),
      costPerClickValue: divideMetric(metric?.spend || 0, metric?.clicks || 0),
      conversionRateValue: percentageMetric(
        metric?.conversions || 0,
        metric?.clicks || 0,
      ),
      costPerConversionValue: divideMetric(
        metric?.spend || 0,
        metric?.conversions || 0,
      ),
      spendAvailable,
      impressionsAvailable,
      clicksAvailable,
      conversionsAvailable,
      ctrAvailable,
      costPerClickAvailable,
      conversionRateAvailable,
      costPerConversionAvailable,
      status: campaign.status || "draft",
      attribution: metric?.attribution || null,
      media: campaign.media || [],
      readOnly: false,
      providerSynced: Boolean(metric?.connectorManaged),
      providerMetricsAvailable: Boolean(metric?.providerMetricsAvailable),
      outcomesLinked: false,
    } satisfies CampaignRow;
  });

  const importedRows = [...unusedAggregates.values()].map((metric) => ({
    id: `metric:${metric.key}`,
    name: metric.name,
    channel: campaignSourceLabel(metric.sourceKey),
    sourceKey: metric.sourceKey,
    budgetValue: 0,
    spentValue: metric.spend,
    leads: metric.leads,
    bookings: metric.bookedConsults,
    cplValue: divideMetric(metric.spend, metric.leads),
    roasValue: divideMetric(metric.revenue, metric.spend),
    revenueValue: metric.revenue,
    impressionsValue: metric.impressions,
    clicksValue: metric.clicks,
    conversionsValue: metric.conversions,
    ctrValue: percentageMetric(metric.clicks, metric.impressions),
    costPerClickValue: divideMetric(metric.spend, metric.clicks),
    conversionRateValue: percentageMetric(metric.conversions, metric.clicks),
    costPerConversionValue: divideMetric(metric.spend, metric.conversions),
    spendAvailable: Boolean(
      metric.hasPrimarySpend || metric.providerMetricSources.spend,
    ),
    impressionsAvailable: Boolean(metric.providerMetricSources.impressions),
    clicksAvailable: Boolean(metric.providerMetricSources.clicks),
    conversionsAvailable: Boolean(metric.providerMetricSources.conversions),
    ctrAvailable: Boolean(
      metric.providerMetricSources.impressions &&
        metric.providerMetricSources.clicks &&
        metric.impressions > 0,
    ),
    costPerClickAvailable: Boolean(
      (metric.hasPrimarySpend || metric.providerMetricSources.spend) &&
        metric.providerMetricSources.clicks &&
        metric.clicks > 0,
    ),
    conversionRateAvailable: Boolean(
      metric.providerMetricSources.clicks &&
        metric.providerMetricSources.conversions &&
        metric.clicks > 0,
    ),
    costPerConversionAvailable: Boolean(
      (metric.hasPrimarySpend || metric.providerMetricSources.spend) &&
        metric.providerMetricSources.conversions &&
        metric.conversions > 0,
    ),
    status: metric.connectorManaged ? "synced" : "tracked",
    attribution: metric.attribution,
    media: [],
    readOnly: true,
    providerSynced: metric.connectorManaged,
    providerMetricsAvailable: metric.providerMetricsAvailable,
    outcomesLinked: false,
  } satisfies CampaignRow));

  return [...savedRows, ...importedRows];
}

export function filterCampaignRowsBySource(
  rows: CampaignRow[],
  source: string | null | undefined,
) {
  const sourceKey = normaliseCampaignSource(source);
  if (!sourceKey) return rows;
  return rows.filter((row) => row.sourceKey === sourceKey);
}

function aggregateCampaignMetrics(
  metrics: CampaignMetricRecord[],
  platformMetrics: PlatformMetricRecord[],
) {
  const aggregates = new Map<string, AggregatedCampaignMetric>();

  for (const metric of metrics) {
    const name = String(metric.campaign || "").trim();
    if (!name) continue;
    const sourceKey =
      normaliseCampaignSource(metric.source || metric.channel) || "marketing";
    const key = buildMetricKey(sourceKey, normaliseCampaignName(name));
    const connectorManaged = String(metric.attribution || "").startsWith("connector:");
    const current =
      aggregates.get(key) || createCampaignMetricAggregate(key, name, sourceKey);

    current.primarySpend += numberMetric(metric.spend);
    current.hasPrimarySpend = true;
    // The metrics API currently derives CRM outcomes by source and date, not by
    // campaign. Keep them blank here so multiple campaigns cannot duplicate them.
    current.connectorManaged ||= connectorManaged;
    if (connectorManaged || !current.attribution) {
      current.attribution = metric.attribution || null;
    }
    aggregates.set(key, current);
  }

  for (const metric of platformMetrics) {
    const name = String(metric.campaign || "").trim();
    if (!name) continue;
    const sourceKey = normaliseCampaignSource(metric.platform) || "marketing";
    if (!isCampaignPerformanceSource(sourceKey)) continue;
    const key = buildMetricKey(sourceKey, normaliseCampaignName(name));
    const current =
      aggregates.get(key) || createCampaignMetricAggregate(key, name, sourceKey);
    const metricName = normaliseMetricName(metric.metricName);
    const metricValue = numberMetric(metric.metricValue);

    const connectorManaged =
      String(metric.attributionLabel || "").startsWith("connector:") ||
      String(metric.dataSource || "").startsWith("connector:");
    if (isProviderMetricName(metricName)) {
      addProviderMetric(current, metricName, metricValue, connectorManaged);
      current.providerMetricsAvailable = true;
    }

    current.connectorManaged ||= connectorManaged;
    if (connectorManaged || !current.attribution) {
      current.attribution = metric.attributionLabel || null;
    }
    aggregates.set(key, current);
  }

  return [...aggregates.values()].map((aggregate) => ({
    ...aggregate,
    // Spend is also present in the provider metric stream. The campaign metrics
    // endpoint remains authoritative when it has a matching campaign so the
    // same connector spend is never counted twice.
    spend: aggregate.hasPrimarySpend
      ? aggregate.primarySpend
      : aggregate.providerSpend,
  }));
}

function createCampaignMetricAggregate(
  key: string,
  name: string,
  sourceKey: string,
): AggregatedCampaignMetric {
  return {
    key,
    name,
    sourceKey,
    spend: 0,
    primarySpend: 0,
    providerSpend: 0,
    hasPrimarySpend: false,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    leads: 0,
    bookedConsults: 0,
    revenue: 0,
    attribution: null,
    connectorManaged: false,
    providerMetricsAvailable: false,
    providerMetricSources: {
      spend: null,
      impressions: null,
      clicks: null,
      conversions: null,
    },
  };
}

function normaliseCampaignName(value: string | null | undefined) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function buildMetricKey(sourceKey: string, nameKey: string) {
  return `${sourceKey}:${nameKey}`;
}

function normaliseMetricName(value: string | null | undefined) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isProviderMetricName(value: string): value is ProviderMetricName {
  return value in PROVIDER_METRIC_FIELDS;
}

function addProviderMetric(
  aggregate: AggregatedCampaignMetric,
  metricName: ProviderMetricName,
  value: number,
  connectorManaged: boolean,
) {
  const field = PROVIDER_METRIC_FIELDS[metricName];
  const currentSource = aggregate.providerMetricSources[metricName];

  if (connectorManaged) {
    if (currentSource !== "connector") aggregate[field] = 0;
    aggregate[field] += value;
    aggregate.providerMetricSources[metricName] = "connector";
    return;
  }

  if (currentSource === "connector") return;
  aggregate[field] += value;
  aggregate.providerMetricSources[metricName] = "fallback";
}

function numberMetric(value: number | string | null | undefined) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function divideMetric(numerator: number, denominator: number) {
  return denominator > 0 ? Number((numerator / denominator).toFixed(2)) : 0;
}

function percentageMetric(numerator: number, denominator: number) {
  return denominator > 0
    ? Number(((numerator / denominator) * 100).toFixed(2))
    : 0;
}
