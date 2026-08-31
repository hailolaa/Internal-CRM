import type {
  ClientAccountSummaryRecord,
  FinanceRevenueViewRecord,
  RevenueRiskModelReportRecord,
} from "@/lib/api-types";

export type Phase2LocationMetricRow = {
  id: string;
  label: string;
  clientCount: number;
  currentMrrCents: number;
  recognizedRevenueCents: number;
  costCents: number;
  marginCents: number;
  marginPercent: number | null;
  retentionRiskCount: number;
  href: string;
};

export type Phase2ClientMetricRow = {
  id: string;
  clinicId: string;
  clinicName: string;
  locationLabel: string;
  currentMrrCents: number;
  marginCents: number;
  marginPercent: number | null;
  retentionRisk: "low" | "medium" | "high" | "critical";
  source: string;
  href: string;
};

export type Phase2ClientMetrics = {
  latestMonth: string | null;
  currentMrrCents: number;
  recognizedRevenueCents: number;
  costCents: number;
  marginCents: number;
  marginPercent: number | null;
  retentionRiskCount: number;
  locationCount: number;
  locationRows: Phase2LocationMetricRow[];
  clientRows: Phase2ClientMetricRow[];
  sourceLabel: string;
  emptyState: boolean;
};

function monthValue(value: string | null | undefined) {
  return String(value || "").slice(0, 10);
}

function safeNumber(value: unknown) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function marginPercent(revenueCents: number, marginCents: number) {
  if (revenueCents <= 0) return null;
  return Math.round((marginCents / revenueCents) * 10000) / 100;
}

export function clientLocationLabel(account: Pick<ClientAccountSummaryRecord, "address" | "city" | "state" | "country">) {
  return [account.city, account.state, account.country].filter(Boolean).join(", ")
    || account.address
    || "Location not set";
}

export function buildPhase2ClientMetrics({
  accounts,
  revenueView,
  riskReport,
}: {
  accounts: ClientAccountSummaryRecord[];
  revenueView: FinanceRevenueViewRecord | null;
  riskReport: RevenueRiskModelReportRecord | null;
}): Phase2ClientMetrics {
  const latestMonth = revenueView?.periods
    .map((period) => monthValue(period.periodMonth))
    .sort()
    .at(-1) || null;
  const latestPeriods = new Map(
    (revenueView?.periods || [])
      .filter((period) => monthValue(period.periodMonth) === latestMonth)
      .map((period) => [period.clientAccountProfileId, period]),
  );
  const risks = new Map((riskReport?.predictions || []).map((risk) => [risk.clientAccountProfileId, risk]));

  const clientRows = accounts
    .filter((account) => account.id)
    .map((account) => {
      const period = latestPeriods.get(account.id!);
      const risk = risks.get(account.id!);
      const retentionRisk: Phase2ClientMetricRow["retentionRisk"] = account.churnRisk === "critical"
        ? "critical"
        : risk?.riskLevel || account.churnRisk || "low";
      const currentMrrCents = period ? safeNumber(period.mrrCents) : Math.round(safeNumber(account.monthlyPrice) * 100);
      const recognizedRevenueCents = safeNumber(period?.recognizedRevenueCents);
      const costCents = safeNumber(period?.costCents);
      const marginCents = period ? safeNumber(period.marginCents) : currentMrrCents - costCents;

      return {
        id: account.id!,
        clinicId: account.clinicId,
        clinicName: account.clinicName,
        locationLabel: clientLocationLabel(account),
        currentMrrCents,
        marginCents,
        marginPercent: period?.marginPercent ?? marginPercent(recognizedRevenueCents || currentMrrCents, marginCents),
        retentionRisk,
        source: period ? "Finance movement" : "Client account profile",
        href: `/app/ops/client-accounts/detail?id=${encodeURIComponent(account.clinicId)}&from=dashboard`,
      };
    });

  const locationRows = Array.from(clientRows.reduce((rows, client) => {
    const row = rows.get(client.locationLabel) || {
      id: client.locationLabel.toLowerCase(),
      label: client.locationLabel,
      clientCount: 0,
      currentMrrCents: 0,
      recognizedRevenueCents: 0,
      costCents: 0,
      marginCents: 0,
      marginPercent: null as number | null,
      retentionRiskCount: 0,
      href: `/app/ops/client-accounts?search=${encodeURIComponent(client.locationLabel)}&from=dashboard`,
    };
    const period = latestPeriods.get(client.id);
    row.clientCount += 1;
    row.currentMrrCents += client.currentMrrCents;
    row.recognizedRevenueCents += safeNumber(period?.recognizedRevenueCents);
    row.costCents += safeNumber(period?.costCents);
    row.marginCents += client.marginCents;
    if (client.retentionRisk !== "low") row.retentionRiskCount += 1;
    rows.set(client.locationLabel, row);
    return rows;
  }, new Map<string, Phase2LocationMetricRow>()).values())
    .map((row) => ({
      ...row,
      marginPercent: marginPercent(row.recognizedRevenueCents || row.currentMrrCents, row.marginCents),
    }))
    .sort((left, right) => right.currentMrrCents - left.currentMrrCents || left.label.localeCompare(right.label));

  const recognizedRevenueCents = revenueView?.totals.recognizedRevenueCents ?? clientRows.reduce((sum, row) => sum + row.currentMrrCents, 0);
  const costCents = revenueView?.totals.costCents ?? 0;
  const marginCents = revenueView?.totals.marginCents ?? recognizedRevenueCents - costCents;
  const currentMrrCents = revenueView?.totals.mrrCents ?? clientRows.reduce((sum, row) => sum + row.currentMrrCents, 0);

  return {
    latestMonth,
    currentMrrCents,
    recognizedRevenueCents,
    costCents,
    marginCents,
    marginPercent: revenueView?.totals.marginPercent ?? marginPercent(recognizedRevenueCents, marginCents),
    retentionRiskCount: clientRows.filter((row) => row.retentionRisk !== "low").length,
    locationCount: locationRows.length,
    locationRows: locationRows.slice(0, 6),
    clientRows: clientRows
      .sort((left, right) => {
        const riskSort = { critical: 0, high: 1, medium: 2, low: 3 };
        return riskSort[left.retentionRisk] - riskSort[right.retentionRisk]
          || right.marginCents - left.marginCents
          || left.clinicName.localeCompare(right.clinicName);
      })
      .slice(0, 6),
    sourceLabel: revenueView ? "Finance movement, client services and account health" : "Client account profile fallback",
    emptyState: clientRows.length === 0,
  };
}
