import type { CampaignRow } from "./campaign-visibility";

export type CampaignStatusFilter =
  | "all"
  | "active"
  | "paused"
  | "draft"
  | "completed"
  | "archived";

export type CampaignViewFilter =
  | "all"
  | "provider"
  | "managed"
  | "attention";

export type CampaignWorkspaceFilters = {
  channel: string;
  query: string;
  status: CampaignStatusFilter;
  view: CampaignViewFilter;
};

export type CampaignWorkspaceStats = {
  active: number;
  attention: number;
  clicks: number;
  clicksAvailable: boolean;
  costPerConversion: number;
  costPerConversionAvailable: boolean;
  conversions: number;
  conversionsAvailable: boolean;
  ctr: number;
  ctrAvailable: boolean;
  impressions: number;
  impressionsAvailable: boolean;
  managed: number;
  provider: number;
  providerSpend: number;
  providerSpendAvailable: boolean;
  spend: number;
  spendAvailable: boolean;
  total: number;
};

const TERMINAL_STATUSES = new Set(["completed", "archived"]);

const STATUS_PRIORITY: Record<string, number> = {
  active: 0,
  synced: 1,
  tracked: 2,
  scheduled: 3,
  draft: 4,
  paused: 5,
  completed: 6,
  archived: 7,
};

export function needsCampaignAttention(campaign: CampaignRow) {
  if (campaign.readOnly || TERMINAL_STATUSES.has(campaign.status)) {
    return false;
  }

  return (
    (campaign.outcomesLinked &&
      campaign.status === "active" &&
      campaign.spentValue > 0 &&
      campaign.leads === 0) ||
    (campaign.status === "active" &&
      campaign.budgetValue > 0 &&
      campaign.spentValue === 0) ||
    !campaign.attribution ||
    campaign.media.length === 0
  );
}

export function getCampaignIssue(campaign: CampaignRow) {
  if (
    campaign.outcomesLinked &&
    campaign.status === "active" &&
    campaign.spentValue > 0 &&
    campaign.leads === 0
  ) {
    return "Spend is live but no leads are attributed yet.";
  }

  if (
    campaign.status === "active" &&
    campaign.budgetValue > 0 &&
    campaign.spentValue === 0
  ) {
    return "Budget is set but no spend is tracked.";
  }

  if (!campaign.attribution) return "Attribution source is not linked.";
  if (campaign.media.length === 0) return "No creative assets are attached.";
  return "Review campaign setup and performance.";
}

export function filterCampaignRows(
  rows: CampaignRow[],
  filters: CampaignWorkspaceFilters,
) {
  const query = filters.query.trim().toLowerCase();

  return rows.filter((campaign) => {
    const matchesStatus =
      filters.status === "all" || campaign.status === filters.status;
    const matchesChannel =
      filters.channel === "all" || campaign.channel === filters.channel;
    const matchesView =
      filters.view === "all" ||
      (filters.view === "provider" &&
        (campaign.providerSynced || campaign.providerMetricsAvailable)) ||
      (filters.view === "managed" && !campaign.readOnly) ||
      (filters.view === "attention" && needsCampaignAttention(campaign));
    const matchesQuery =
      !query ||
      campaign.name.toLowerCase().includes(query) ||
      campaign.channel.toLowerCase().includes(query) ||
      campaign.status.toLowerCase().includes(query) ||
      campaign.sourceKey.toLowerCase().includes(query) ||
      String(campaign.attribution || "")
        .toLowerCase()
        .includes(query);

    return matchesStatus && matchesChannel && matchesView && matchesQuery;
  });
}

export function sortCampaignRows(rows: CampaignRow[]) {
  return [...rows].sort((left, right) => {
    const attentionDifference =
      Number(needsCampaignAttention(right)) -
      Number(needsCampaignAttention(left));
    if (attentionDifference !== 0) return attentionDifference;

    const statusDifference =
      (STATUS_PRIORITY[left.status] ?? 99) -
      (STATUS_PRIORITY[right.status] ?? 99);
    if (statusDifference !== 0) return statusDifference;

    if (right.conversionsValue !== left.conversionsValue) {
      return right.conversionsValue - left.conversionsValue;
    }

    if (right.spentValue !== left.spentValue) {
      return right.spentValue - left.spentValue;
    }

    return left.name.localeCompare(right.name);
  });
}

export function getCampaignChannels(rows: CampaignRow[]) {
  return Array.from(
    new Set(rows.map((campaign) => campaign.channel).filter(Boolean)),
  ).sort((left, right) => left.localeCompare(right));
}

export function getCampaignWorkspaceStats(
  rows: CampaignRow[],
): CampaignWorkspaceStats {
  const spendRows = rows.filter((campaign) => campaign.spendAvailable);
  const providerRows = rows.filter(
    (campaign) =>
      campaign.providerSynced || campaign.providerMetricsAvailable,
  );
  const providerSpendRows = providerRows.filter(
    (campaign) => campaign.spendAvailable,
  );
  const impressionRows = rows.filter(
    (campaign) => campaign.impressionsAvailable,
  );
  const clickRows = rows.filter((campaign) => campaign.clicksAvailable);
  const conversionRows = rows.filter(
    (campaign) => campaign.conversionsAvailable,
  );
  const ctrRows = rows.filter(
    (campaign) =>
      campaign.impressionsAvailable &&
      campaign.clicksAvailable &&
      campaign.impressionsValue > 0,
  );
  const costPerConversionRows = rows.filter(
    (campaign) =>
      campaign.spendAvailable &&
      campaign.conversionsAvailable &&
      campaign.conversionsValue > 0,
  );

  const ctrImpressions = sumMetric(
    ctrRows,
    (campaign) => campaign.impressionsValue,
  );
  const ctrClicks = sumMetric(ctrRows, (campaign) => campaign.clicksValue);
  const conversionSpend = sumMetric(
    costPerConversionRows,
    (campaign) => campaign.spentValue,
  );
  const pricedConversions = sumMetric(
    costPerConversionRows,
    (campaign) => campaign.conversionsValue,
  );

  return {
    active: rows.filter(
      (campaign) => !campaign.readOnly && campaign.status === "active",
    ).length,
    attention: rows.filter(needsCampaignAttention).length,
    clicks: sumMetric(clickRows, (campaign) => campaign.clicksValue),
    clicksAvailable: clickRows.length > 0,
    costPerConversion:
      pricedConversions > 0 ? conversionSpend / pricedConversions : 0,
    costPerConversionAvailable:
      costPerConversionRows.length > 0 && pricedConversions > 0,
    conversions: sumMetric(
      conversionRows,
      (campaign) => campaign.conversionsValue,
    ),
    conversionsAvailable: conversionRows.length > 0,
    ctr: ctrImpressions > 0 ? (ctrClicks / ctrImpressions) * 100 : 0,
    ctrAvailable: ctrRows.length > 0 && ctrImpressions > 0,
    impressions: sumMetric(
      impressionRows,
      (campaign) => campaign.impressionsValue,
    ),
    impressionsAvailable: impressionRows.length > 0,
    managed: rows.filter((campaign) => !campaign.readOnly).length,
    provider: providerRows.length,
    providerSpend: sumMetric(
      providerSpendRows,
      (campaign) => campaign.spentValue,
    ),
    providerSpendAvailable: providerSpendRows.length > 0,
    spend: sumMetric(spendRows, (campaign) => campaign.spentValue),
    spendAvailable: spendRows.length > 0,
    total: rows.length,
  };
}

function sumMetric(
  rows: CampaignRow[],
  select: (campaign: CampaignRow) => number,
) {
  return rows.reduce((total, campaign) => total + select(campaign), 0);
}
