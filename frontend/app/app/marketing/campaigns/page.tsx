"use client";

import {
  AlertCircle,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  Filter,
  Image as ImageIcon,
  Loader2,
  Megaphone,
  Plus,
  RefreshCw,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  type ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AlertBanner,
  Card,
  PageHeader,
  SearchInput,
  SkeletonLine,
  StatusBadge,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type { CampaignMediaRecord } from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  CAMPAIGN_MEDIA_ACCEPT,
  CAMPAIGN_MEDIA_MAX_ITEMS,
  readCampaignMediaDataUrl,
  validateCampaignMediaFile,
} from "@/lib/campaign-media";
import {
  buildCampaignRows,
  campaignSourceLabel,
  filterCampaignRowsBySource,
  isCampaignPerformanceSource,
  normaliseCampaignSource,
  type CampaignRow,
} from "@/lib/campaigns/campaign-visibility";
import {
  filterCampaignRows,
  getCampaignChannels,
  getCampaignIssue,
  getCampaignWorkspaceStats,
  needsCampaignAttention,
  sortCampaignRows,
  type CampaignStatusFilter,
  type CampaignViewFilter,
} from "@/lib/campaigns/campaign-workspace";

const CAMPAIGN_STATUSES = [
  "draft",
  "active",
  "paused",
  "completed",
  "archived",
] as const;

type FilterOption = {
  label: string;
  value: string;
};

type RowMetric = {
  detail: string;
  label: string;
  value: string;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function formatPreciseCurrency(value: number) {
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency: "GBP",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function formatCount(value: number) {
  return Number(value || 0).toLocaleString("en-GB", {
    maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
  });
}

function formatPercent(value: number, available: boolean) {
  return available ? `${value.toFixed(1)}%` : "—";
}

function formatRoas(value: number) {
  return value > 0 ? `${value.toFixed(2)}x` : "—";
}

function formatFileSize(value: number) {
  return `${Math.max(1, Math.round(value / 1024)).toLocaleString()} KB`;
}

function formatStatus(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => {
    return letter.toUpperCase();
  });
}

function settledError(
  result: PromiseSettledResult<unknown>,
  fallback: string,
) {
  if (result.status === "fulfilled") return "";
  return result.reason instanceof Error ? result.reason.message : fallback;
}

function getCampaignRowMetrics(campaign: CampaignRow): RowMetric[] {
  if (!campaign.providerMetricsAvailable && campaign.outcomesLinked) {
    return [
      {
        detail:
          campaign.budgetValue > 0
            ? `Budget ${formatCurrency(campaign.budgetValue)}`
            : "No budget recorded",
        label: "Spend",
        value: campaign.spendAvailable
          ? formatPreciseCurrency(campaign.spentValue)
          : "—",
      },
      {
        detail:
          campaign.cplValue > 0
            ? `${formatPreciseCurrency(campaign.cplValue)} CPL`
            : "Campaign linked",
        label: "CRM leads",
        value: formatCount(campaign.leads),
      },
      {
        detail: "Campaign-linked bookings",
        label: "Bookings",
        value: formatCount(campaign.bookings),
      },
      {
        detail: "Campaign-linked revenue",
        label: "ROAS",
        value: formatRoas(campaign.roasValue),
      },
    ];
  }

  return [
    {
      detail:
        !campaign.readOnly && campaign.budgetValue > 0
          ? `Budget ${formatCurrency(campaign.budgetValue)}`
          : campaign.spendAvailable
            ? "All synced history"
            : "Not reported",
      label: "Spend",
      value: campaign.spendAvailable
        ? formatPreciseCurrency(campaign.spentValue)
        : "—",
    },
    {
      detail: campaign.impressionsAvailable
        ? `${formatCount(campaign.impressionsValue)} impressions${
            campaign.ctrAvailable
              ? ` · ${formatPercent(campaign.ctrValue, true)} CTR`
              : ""
          }`
        : "Traffic unavailable",
      label: "Clicks",
      value: campaign.clicksAvailable
        ? formatCount(campaign.clicksValue)
        : "—",
    },
    {
      detail: campaign.conversionRateAvailable
        ? `${formatPercent(campaign.conversionRateValue, true)} from clicks`
        : "Rate unavailable",
      label: "Conversions",
      value: campaign.conversionsAvailable
        ? formatCount(campaign.conversionsValue)
        : "—",
    },
    {
      detail: campaign.costPerClickAvailable
        ? `${formatPreciseCurrency(campaign.costPerClickValue)} CPC`
        : "CPC unavailable",
      label: "Cost / conversion",
      value: campaign.costPerConversionAvailable
        ? formatPreciseCurrency(campaign.costPerConversionValue)
        : "—",
    },
  ];
}

function FilterSelect({
  icon: Icon,
  label,
  name,
  onChange,
  options,
  value,
}: {
  icon: typeof Filter;
  label: string;
  name: string;
  onChange: (value: string) => void;
  options: FilterOption[];
  value: string;
}) {
  return (
    <label className="relative min-w-0">
      <span className="sr-only">{label}</span>
      <Icon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#5E6E70]" />
      <select
        aria-label={label}
        className="btn-secondary min-h-11 w-full appearance-none py-2 pl-9 pr-8 text-sm"
        name={name}
        onChange={(event) => onChange(event.target.value)}
        value={value}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-[#5E6E70]" />
    </label>
  );
}

export default function CampaignsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission, session } = useAuth();
  const token = session?.token;
  const canReadCampaigns = hasPermission("marketing:read");
  const canWriteCampaigns = hasPermission("marketing:write");
  const sourceFilterKey = normaliseCampaignSource(searchParams.get("source"));
  const sourceFilterLabel = campaignSourceLabel(sourceFilterKey);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [loadError, setLoadError] = useState("");
  const [loadWarning, setLoadWarning] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] =
    useState<CampaignStatusFilter>("all");
  const [viewFilter, setViewFilter] = useState<CampaignViewFilter>("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedCampaignId, setExpandedCampaignId] = useState<string | null>(
    null,
  );
  const [updatingCampaignId, setUpdatingCampaignId] = useState<string | null>(
    null,
  );
  const [mediaMutationId, setMediaMutationId] = useState<string | null>(null);
  const campaignRefs = useRef<Record<string, HTMLLIElement | null>>({});

  useEffect(() => {
    let isActive = true;

    async function loadCampaigns() {
      await Promise.resolve();
      if (!isActive) return;

      if (!token || !canReadCampaigns) {
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setLoadError("");
      setLoadWarning("");
      const canLoadProviderMetrics =
        !sourceFilterKey || isCampaignPerformanceSource(sourceFilterKey);
      const platformMetricsRequest = canLoadProviderMetrics
        ? api.integrationInputs.listPlatformMetrics(token, {
            aggregate: "campaign",
            ...(sourceFilterKey ? { platform: sourceFilterKey } : {}),
          })
        : Promise.resolve([]);

      const [campaignResult, metricResult, platformResult] =
        await Promise.allSettled([
          api.campaigns.list(token),
          api.reports.campaignMetrics(token),
          platformMetricsRequest,
        ]);

      if (!isActive) return;

      const hasUsableResponse =
        campaignResult.status === "fulfilled" ||
        metricResult.status === "fulfilled" ||
        (canLoadProviderMetrics && platformResult.status === "fulfilled");

      if (!hasUsableResponse) {
        const message =
          settledError(campaignResult, "") ||
          settledError(metricResult, "") ||
          settledError(platformResult, "") ||
          "Unable to load campaign data.";
        setLoadError(message);
        setCampaigns([]);
        setIsLoading(false);
        return;
      }

      const unavailableSources = [
        campaignResult.status === "rejected" ? "saved campaign plans" : "",
        metricResult.status === "rejected" ? "recorded campaign spend" : "",
        canLoadProviderMetrics && platformResult.status === "rejected"
          ? "provider performance"
          : "",
      ].filter(Boolean);

      setCampaigns(
        buildCampaignRows(
          campaignResult.status === "fulfilled" ? campaignResult.value : [],
          metricResult.status === "fulfilled" ? metricResult.value : [],
          platformResult.status === "fulfilled" ? platformResult.value : [],
        ),
      );
      setLoadWarning(
        unavailableSources.length > 0
          ? `Some data is temporarily unavailable: ${unavailableSources.join(
              ", ",
            )}. The available campaign data is still shown below.`
          : "",
      );
      setIsLoading(false);
    }

    void loadCampaigns();
    return () => {
      isActive = false;
    };
  }, [
    canReadCampaigns,
    loadAttempt,
    sourceFilterKey,
    token,
  ]);

  const sourceCampaigns = useMemo(
    () => filterCampaignRowsBySource(campaigns, sourceFilterKey),
    [campaigns, sourceFilterKey],
  );
  const stats = useMemo(
    () => getCampaignWorkspaceStats(sourceCampaigns),
    [sourceCampaigns],
  );
  const channelOptions = useMemo(
    () => getCampaignChannels(sourceCampaigns),
    [sourceCampaigns],
  );
  const effectiveChannelFilter =
    channelFilter === "all" || channelOptions.includes(channelFilter)
      ? channelFilter
      : "all";
  const filteredCampaigns = useMemo(
    () =>
      sortCampaignRows(
        filterCampaignRows(sourceCampaigns, {
          channel: effectiveChannelFilter,
          query: searchQuery,
          status: statusFilter,
          view: viewFilter,
        }),
      ),
    [
      effectiveChannelFilter,
      searchQuery,
      sourceCampaigns,
      statusFilter,
      viewFilter,
    ],
  );
  const attentionCampaigns = useMemo(
    () => sortCampaignRows(sourceCampaigns.filter(needsCampaignAttention)),
    [sourceCampaigns],
  );
  const attentionPreview = attentionCampaigns.slice(0, 4);
  const hasConnectorCampaigns = sourceCampaigns.some(
    (campaign) => campaign.providerSynced,
  );
  const campaignOutcomesUnavailable =
    sourceCampaigns.length > 0 &&
    sourceCampaigns.every((campaign) => !campaign.outcomesLinked);
  const showProviderSnapshot =
    stats.provider > 0 ||
    stats.impressionsAvailable ||
    stats.conversionsAvailable;
  const facetFilterCount = [
    statusFilter !== "all",
    viewFilter !== "all",
    effectiveChannelFilter !== "all",
    Boolean(sourceFilterKey),
  ].filter(Boolean).length;
  const hasActiveFilters =
    searchQuery.trim().length > 0 || facetFilterCount > 0;

  const clearWorkspaceFilters = useCallback(() => {
    setSearchQuery("");
    setStatusFilter("all");
    setViewFilter("all");
    setChannelFilter("all");
    setFiltersOpen(false);
  }, []);

  const clearAllFilters = useCallback(() => {
    clearWorkspaceFilters();
    if (sourceFilterKey) router.replace("/app/marketing/campaigns");
  }, [clearWorkspaceFilters, router, sourceFilterKey]);

  const revealCampaign = useCallback(
    (campaignId: string) => {
      clearWorkspaceFilters();
      setExpandedCampaignId(campaignId);
      window.setTimeout(() => {
        const campaignElement = campaignRefs.current[campaignId];
        campaignElement?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        campaignElement?.focus({ preventScroll: true });
      }, 50);
    },
    [clearWorkspaceFilters],
  );

  const updateCampaignStatus = async (
    campaign: CampaignRow,
    status: string,
  ) => {
    if (
      !token ||
      !canWriteCampaigns ||
      campaign.readOnly ||
      updatingCampaignId
    ) {
      return;
    }

    if (
      status === "archived" &&
      !window.confirm(
        `Archive “${campaign.name}”? Its history will remain available.`,
      )
    ) {
      return;
    }

    setUpdatingCampaignId(campaign.id);
    setActionMessage("");
    setActionError("");

    try {
      await api.campaigns.updateStatus(token, campaign.id, status);
      setCampaigns((current) =>
        current.map((item) =>
          item.id === campaign.id ? { ...item, status } : item,
        ),
      );
      setActionMessage(`${campaign.name} marked as ${formatStatus(status)}.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to update campaign.",
      );
    } finally {
      setUpdatingCampaignId(null);
    }
  };

  const uploadCampaignMedia = async (
    campaign: CampaignRow,
    file: File,
    mediaId?: string,
  ) => {
    if (
      !token ||
      !canWriteCampaigns ||
      campaign.readOnly ||
      mediaMutationId
    ) {
      return;
    }

    const validationError = validateCampaignMediaFile(file);
    if (validationError) {
      setActionError(`${file.name}: ${validationError}`);
      return;
    }

    if (!mediaId && campaign.media.length >= CAMPAIGN_MEDIA_MAX_ITEMS) {
      setActionError(
        `Campaigns can have up to ${CAMPAIGN_MEDIA_MAX_ITEMS} media assets.`,
      );
      return;
    }

    const mutationId = mediaId
      ? `${campaign.id}:${mediaId}:replace`
      : `${campaign.id}:upload`;
    setMediaMutationId(mutationId);
    setActionMessage("");
    setActionError("");

    try {
      const dataUrl = await readCampaignMediaDataUrl(file);
      const payload = {
        dataUrl,
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      };
      const media = mediaId
        ? await api.campaigns.replaceMedia(
            token,
            campaign.id,
            mediaId,
            payload,
          )
        : await api.campaigns.uploadMedia(token, campaign.id, payload);

      setCampaigns((current) =>
        current.map((item) => {
          if (item.id !== campaign.id) return item;
          return {
            ...item,
            media: mediaId
              ? item.media.map((existing) =>
                  existing.id === mediaId ? media : existing,
                )
              : [media, ...item.media],
          };
        }),
      );
      setActionMessage(
        mediaId
          ? `${campaign.name} media replaced.`
          : `${file.name} uploaded to ${campaign.name}.`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to upload campaign media.",
      );
    } finally {
      setMediaMutationId(null);
    }
  };

  const handleMediaInputChange = (
    campaign: CampaignRow,
    event: ChangeEvent<HTMLInputElement>,
    mediaId?: string,
  ) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    void uploadCampaignMedia(campaign, file, mediaId);
  };

  const deleteCampaignMedia = async (
    campaign: CampaignRow,
    media: CampaignMediaRecord,
  ) => {
    if (
      !token ||
      !canWriteCampaigns ||
      campaign.readOnly ||
      mediaMutationId ||
      !window.confirm(`Remove “${media.fileName}” from ${campaign.name}?`)
    ) {
      return;
    }

    const mutationId = `${campaign.id}:${media.id}:delete`;
    setMediaMutationId(mutationId);
    setActionMessage("");
    setActionError("");

    try {
      await api.campaigns.deleteMedia(token, campaign.id, media.id);
      setCampaigns((current) =>
        current.map((item) =>
          item.id === campaign.id
            ? {
                ...item,
                media: item.media.filter(
                  (existing) => existing.id !== media.id,
                ),
              }
            : item,
        ),
      );
      setActionMessage(`${media.fileName} removed from ${campaign.name}.`);
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : "Unable to delete campaign media.",
      );
    } finally {
      setMediaMutationId(null);
    }
  };

  const snapshotMetrics = showProviderSnapshot
    ? [
        {
          detail: `${stats.provider} provider synced · ${stats.managed} managed`,
          label: "Campaigns",
          tone: "text-[#151f21]",
          value: stats.total.toLocaleString(),
        },
        {
          detail: stats.impressionsAvailable
            ? `${formatCount(stats.impressions)} impressions · all history`
            : "All synced history",
          label: stats.providerSpendAvailable
            ? "Provider spend"
            : "Tracked spend",
          tone: "text-[#5E6E70]",
          value: stats.providerSpendAvailable
            ? formatPreciseCurrency(stats.providerSpend)
            : stats.spendAvailable
              ? formatPreciseCurrency(stats.spend)
              : "—",
        },
        {
          detail: stats.clicksAvailable
            ? `${formatCount(stats.clicks)} provider clicks`
            : "Provider result data unavailable",
          label: "Conversions",
          tone: "text-[#315F5C]",
          value: stats.conversionsAvailable
            ? formatCount(stats.conversions)
            : "—",
        },
        {
          detail: stats.ctrAvailable
            ? `${formatPercent(stats.ctr, true)} blended CTR`
            : "Calculated where spend and conversions exist",
          label: "Cost / conversion",
          tone: "text-[#9A5524]",
          value: stats.costPerConversionAvailable
            ? formatPreciseCurrency(stats.costPerConversion)
            : "—",
        },
      ]
    : [
        {
          detail: `${stats.managed} internally managed`,
          label: "Campaigns",
          tone: "text-[#151f21]",
          value: stats.total.toLocaleString(),
        },
        {
          detail: "Internal campaigns currently live",
          label: "Active",
          tone: "text-[#315F5C]",
          value: stats.active.toLocaleString(),
        },
        {
          detail: "All recorded campaign history",
          label: "Tracked spend",
          tone: "text-[#5E6E70]",
          value: stats.spendAvailable
            ? formatPreciseCurrency(stats.spend)
            : "—",
        },
        {
          detail: "Setup checks to review",
          label: "Needs attention",
          tone: "text-[#9A5524]",
          value: stats.attention.toLocaleString(),
        },
      ];

  const resultSummary = isLoading
    ? "Loading campaign performance…"
    : hasActiveFilters
      ? `${filteredCampaigns.length} of ${sourceCampaigns.length} campaigns shown`
      : `${sourceCampaigns.length} campaign${
          sourceCampaigns.length === 1 ? "" : "s"
        } across all synced history`;

  return (
    <div className="space-y-5">
      <PageHeader
        icon={Megaphone}
        right={
          canWriteCampaigns ? (
            <Link
              className="btn-primary !bg-[#9A5524] text-sm hover:!bg-[#151F21]"
              href="/app/marketing/campaigns/new"
            >
              <Plus className="h-4 w-4" />
              New campaign
            </Link>
          ) : undefined
        }
        subtitle="Compare provider performance and manage Mission Control campaign work."
        title="Campaigns"
      />

      {!canReadCampaigns ? (
        <div role="alert">
          <AlertBanner
            description="Your role does not include permission to view Mission Control marketing campaigns."
            icon={AlertTriangle}
            title="Campaign access is unavailable"
            variant="info"
          />
        </div>
      ) : loadError ? (
        <div role="alert">
          <AlertBanner
            action={
              <button
                className="btn-secondary shrink-0 text-sm"
                onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                type="button"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            }
            description={loadError}
            icon={AlertTriangle}
            title="Campaign performance could not be loaded"
            variant="error"
          />
        </div>
      ) : (
        <>
          <Card className="overflow-hidden" padding="p-0">
            <section aria-labelledby="campaign-snapshot-heading">
              <h2 className="sr-only" id="campaign-snapshot-heading">
                Campaign snapshot
              </h2>
              <div className="grid grid-cols-2 gap-px bg-[rgba(21,31,33,0.06)] lg:grid-cols-4">
                {snapshotMetrics.map((metric) => (
                  <div
                    className="min-h-[6.25rem] bg-[#FFFFFF] px-5 py-4"
                    key={metric.label}
                  >
                    {isLoading ? (
                      <SkeletonLine className="mb-2 h-7 w-20" />
                    ) : (
                      <p
                        className={`text-2xl font-bold tracking-tight ${metric.tone}`}
                      >
                        {metric.value}
                      </p>
                    )}
                    <p className="mt-1 text-sm font-medium text-[#151f21]">
                      {metric.label}
                    </p>
                    <p className="mt-0.5 text-xs leading-4 text-[#5E6E70]">
                      {metric.detail}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          </Card>

          {loadWarning && (
            <div role="status">
              <AlertBanner
                action={
                  <button
                    className="btn-secondary shrink-0 text-sm"
                    onClick={() => setLoadAttempt((attempt) => attempt + 1)}
                    type="button"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Retry
                  </button>
                }
                description={loadWarning}
                icon={AlertTriangle}
                title="Showing partial campaign data"
                variant="warning"
              />
            </div>
          )}

          {actionMessage && (
            <div aria-live="polite" role="status">
              <AlertBanner title={actionMessage} variant="success" />
            </div>
          )}

          {actionError && (
            <div role="alert">
              <AlertBanner
                description={actionError}
                icon={AlertTriangle}
                title="Campaign action failed"
                variant="error"
              />
            </div>
          )}

          <Card className="overflow-hidden" padding="p-0">
            <section aria-labelledby="campaign-workspace-heading">
              <div className="flex flex-col gap-3 border-b border-[rgba(21,31,33,0.06)] px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5">
                <div>
                  <h2
                    className="font-semibold text-[#151f21]"
                    id="campaign-workspace-heading"
                  >
                    Campaign workspace
                  </h2>
                  <p
                    aria-live="polite"
                    className="mt-1 text-sm text-[#5E6E70]"
                  >
                    {resultSummary}
                    {!canWriteCampaigns && !isLoading
                      ? " · Read-only access"
                      : ""}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {sourceFilterKey && (
                    <span className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[rgba(96,180,175,0.2)] bg-[rgba(96,180,175,0.08)] px-3 text-xs font-semibold text-[#151F21]">
                      {sourceFilterLabel}
                      <button
                        aria-label={`Clear ${sourceFilterLabel} source filter`}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9A95]"
                        onClick={() => {
                          clearWorkspaceFilters();
                          router.replace("/app/marketing/campaigns");
                        }}
                        type="button"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  )}
                  <span className="inline-flex min-h-9 items-center rounded-full border border-[#E5E7EB] bg-[#FAF9F7] px-3 text-xs font-medium text-[#5E6E70]">
                    All synced history
                  </span>
                </div>
              </div>

              {!isLoading && hasConnectorCampaigns && (
                <div className="border-b border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] px-4 py-3 sm:px-5">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[rgba(96,180,175,0.16)] bg-[#FFFFFF]">
                      <BarChart3 className="h-4 w-4 text-[#4A9A95]" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#151f21]">
                        Provider performance is synced
                      </p>
                      <p className="mt-0.5 text-xs leading-5 text-[#5E6E70]">
                        Spend, impressions, clicks, and conversions come from
                        the connected ad platform.
                        {campaignOutcomesUnavailable
                          ? " CRM leads, bookings, and revenue are kept separate until campaign-level attribution is available."
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {!isLoading &&
                attentionPreview.length > 0 &&
                viewFilter !== "attention" && (
                  <div className="border-b border-[rgba(21,31,33,0.06)] bg-[#FAF9F7] px-4 py-4 sm:px-5">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
                      <div className="flex shrink-0 items-center justify-between gap-4 lg:w-44 lg:block">
                        <div>
                          <p className="flex items-center gap-2 text-sm font-semibold text-[#151f21]">
                            <AlertCircle className="h-4 w-4 text-[#9a5524]" />
                            Setup checks
                          </p>
                          <p className="mt-1 text-xs text-[#5E6E70]">
                            {attentionCampaigns.length} campaign
                            {attentionCampaigns.length === 1 ? "" : "s"} to
                            review
                          </p>
                        </div>
                        <button
                          className="inline-flex min-h-11 items-center text-xs font-semibold text-[#5E6E70] hover:text-[#151f21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9A95] lg:mt-1"
                          onClick={() => {
                            setSearchQuery("");
                            setStatusFilter("all");
                            setViewFilter("attention");
                            setChannelFilter("all");
                            setFiltersOpen(false);
                          }}
                          type="button"
                        >
                          Show all
                        </button>
                      </div>
                      <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:overflow-visible lg:pb-0">
                        {attentionPreview.map((campaign) => (
                          <button
                            className="w-[min(74vw,18rem)] shrink-0 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2.5 text-left transition-colors hover:border-[rgba(96,180,175,0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9A95] sm:w-auto sm:min-w-0"
                            key={campaign.id}
                            onClick={() => revealCampaign(campaign.id)}
                            type="button"
                          >
                            <span className="block truncate text-sm font-semibold text-[#151f21]">
                              {campaign.name}
                            </span>
                            <span className="mt-1 block truncate text-xs font-medium text-[#9a5524]">
                              {getCampaignIssue(campaign)}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

              <div className="space-y-3 border-b border-[rgba(21,31,33,0.06)] px-4 py-4 sm:px-5">
                <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:gap-3">
                  <SearchInput
                    ariaLabel="Search campaign name, channel, source, or status"
                    className="min-w-0"
                    name="campaign-search"
                    onChange={setSearchQuery}
                    placeholder="Search campaigns…"
                    value={searchQuery}
                  />
                  <button
                    aria-controls="campaign-filter-controls"
                    aria-expanded={filtersOpen}
                    className="btn-secondary min-h-11 px-3 text-sm xl:hidden"
                    onClick={() => setFiltersOpen((open) => !open)}
                    type="button"
                  >
                    <Filter className="h-4 w-4" />
                    <span>Filters</span>
                    {facetFilterCount > 0 && (
                      <span className="rounded-full bg-[rgba(96,180,175,0.14)] px-1.5 py-0.5 text-[11px] font-semibold text-[#151F21]">
                        {facetFilterCount}
                      </span>
                    )}
                  </button>

                  <div
                    className={`col-span-2 grid grid-cols-1 gap-2 sm:grid-cols-3 xl:col-span-1 xl:flex xl:flex-wrap ${
                      filtersOpen ? "grid" : "hidden xl:flex"
                    }`}
                    id="campaign-filter-controls"
                  >
                    <FilterSelect
                      icon={CheckCircle2}
                      label="Filter campaigns by status"
                      name="campaign-status-filter"
                      onChange={(value) =>
                        setStatusFilter(value as CampaignStatusFilter)
                      }
                      options={[
                        { label: "All statuses", value: "all" },
                        { label: "Active", value: "active" },
                        { label: "Paused", value: "paused" },
                        { label: "Draft", value: "draft" },
                        { label: "Completed", value: "completed" },
                        { label: "Archived", value: "archived" },
                      ]}
                      value={statusFilter}
                    />
                    <FilterSelect
                      icon={BarChart3}
                      label="Filter campaigns by workspace view"
                      name="campaign-view-filter"
                      onChange={(value) =>
                        setViewFilter(value as CampaignViewFilter)
                      }
                      options={[
                        { label: "All campaigns", value: "all" },
                        { label: "Provider synced", value: "provider" },
                        { label: "Internally managed", value: "managed" },
                        { label: "Needs attention", value: "attention" },
                      ]}
                      value={viewFilter}
                    />
                    <FilterSelect
                      icon={Megaphone}
                      label="Filter campaigns by channel"
                      name="campaign-channel-filter"
                      onChange={setChannelFilter}
                      options={[
                        { label: "All channels", value: "all" },
                        ...channelOptions.map((channel) => ({
                          label: channel,
                          value: channel,
                        })),
                      ]}
                      value={effectiveChannelFilter}
                    />
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#5E6E70]">
                    <p>
                      Showing {filteredCampaigns.length} matching campaign
                      {filteredCampaigns.length === 1 ? "" : "s"}
                    </p>
                    <button
                      className="min-h-9 font-semibold text-[#5E6E70] hover:text-[#151f21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9A95]"
                      onClick={clearAllFilters}
                      type="button"
                    >
                      Clear all
                    </button>
                  </div>
                )}
              </div>

              {isLoading ? (
                <div
                  aria-label="Loading campaigns"
                  className="divide-y divide-[rgba(21,31,33,0.06)]"
                >
                  {Array.from({ length: 5 }, (_, index) => (
                    <div className="px-4 py-5 sm:px-5" key={index}>
                      <div className="flex items-start gap-3">
                        <SkeletonLine className="h-11 w-11 shrink-0 rounded-xl" />
                        <div className="min-w-0 flex-1">
                          <SkeletonLine className="h-5 w-52" />
                          <SkeletonLine className="mt-3 h-4 w-full max-w-xl" />
                          <SkeletonLine className="mt-4 h-10 w-full" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : filteredCampaigns.length > 0 ? (
                <ul className="divide-y divide-[rgba(21,31,33,0.06)]">
                  {filteredCampaigns.map((campaign) => {
                    const isExpanded = expandedCampaignId === campaign.id;
                    const isUpdating = updatingCampaignId === campaign.id;
                    const campaignMediaBusy = Boolean(
                      mediaMutationId?.startsWith(`${campaign.id}:`),
                    );
                    const rowMetrics = getCampaignRowMetrics(campaign);
                    const setupIssue = needsCampaignAttention(campaign);
                    const detailsId = `campaign-details-${campaign.id}`;
                    const uploadId = `campaign-media-${campaign.id}`;

                    return (
                      <li
                        className="scroll-mt-24 outline-none transition-colors focus:bg-[rgba(96,180,175,0.06)]"
                        key={campaign.id}
                        ref={(element) => {
                          campaignRefs.current[campaign.id] = element;
                        }}
                        tabIndex={-1}
                      >
                        <article className="px-4 py-5 sm:px-5">
                          <div className="flex flex-col gap-4 xl:grid xl:grid-cols-[minmax(15rem,1.1fr)_minmax(32rem,1.55fr)_auto] xl:items-center">
                            <div className="flex min-w-0 items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[rgba(96,180,175,0.14)] bg-[rgba(96,180,175,0.08)]">
                                {campaign.providerMetricsAvailable ? (
                                  <BarChart3 className="h-5 w-5 text-[#4A9A95]" />
                                ) : (
                                  <Megaphone className="h-5 w-5 text-[#4A9A95]" />
                                )}
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold leading-5 text-[#151f21]">
                                  {campaign.name}
                                </h3>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                  <span className="rounded-full border border-[#E5E7EB] bg-[#F4F7F6] px-2 py-0.5 text-xs font-medium text-[#5E6E70]">
                                    {campaign.channel}
                                  </span>
                                  <StatusBadge
                                    status={formatStatus(campaign.status)}
                                  />
                                  {campaign.providerSynced && (
                                    <span className="rounded-full border border-[rgba(96,180,175,0.2)] bg-[rgba(96,180,175,0.08)] px-2 py-0.5 text-xs font-medium text-[#151F21]">
                                      Synced data
                                    </span>
                                  )}
                                  {campaign.readOnly && (
                                    <span className="rounded-full border border-[#E5E7EB] bg-[#FAF9F7] px-2 py-0.5 text-xs font-medium text-[#5E6E70]">
                                      Provider managed
                                    </span>
                                  )}
                                </div>
                                {setupIssue && (
                                  <p className="mt-2 line-clamp-2 text-xs leading-4 text-[#9a5524]">
                                    {getCampaignIssue(campaign)}
                                  </p>
                                )}
                              </div>
                            </div>

                            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-[rgba(21,31,33,0.06)] bg-[rgba(21,31,33,0.06)] sm:grid-cols-4">
                              {rowMetrics.map((metric) => (
                                <div
                                  className="min-w-0 bg-[#FAF9F7] px-3 py-2.5"
                                  key={metric.label}
                                >
                                  <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5E6E70]">
                                    {metric.label}
                                  </dt>
                                  <dd className="mt-1 truncate text-sm font-semibold text-[#151f21]">
                                    {metric.value}
                                  </dd>
                                  <dd className="mt-0.5 truncate text-[11px] text-[#5E6E70]">
                                    {metric.detail}
                                  </dd>
                                </div>
                              ))}
                            </dl>

                            <button
                              aria-controls={detailsId}
                              aria-expanded={isExpanded}
                              className="btn-secondary min-h-11 w-full justify-center text-sm sm:w-fit xl:justify-self-end"
                              onClick={() =>
                                setExpandedCampaignId((current) =>
                                  current === campaign.id ? null : campaign.id,
                                )
                              }
                              type="button"
                            >
                              {isExpanded
                                ? "Hide details"
                                : campaign.readOnly || !canWriteCampaigns
                                  ? "View details"
                                  : "Manage"}
                              <ChevronDown
                                className={`h-4 w-4 transition-transform ${
                                  isExpanded ? "rotate-180" : ""
                                }`}
                              />
                            </button>
                          </div>

                          {isExpanded && (
                            <div
                              className="mt-4 grid gap-4 rounded-2xl border border-[rgba(21,31,33,0.07)] bg-[#FAF9F7] p-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"
                              id={detailsId}
                            >
                              <section aria-labelledby={`${detailsId}-data`}>
                                <h4
                                  className="text-sm font-semibold text-[#151f21]"
                                  id={`${detailsId}-data`}
                                >
                                  Data detail
                                </h4>
                                <p className="mt-1 text-xs leading-5 text-[#5E6E70]">
                                  Figures cover all history currently synced for
                                  this campaign.
                                </p>
                                <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                  {[
                                    {
                                      label: "Impressions",
                                      value: campaign.impressionsAvailable
                                        ? formatCount(
                                            campaign.impressionsValue,
                                          )
                                        : "—",
                                    },
                                    {
                                      label: "Clicks",
                                      value: campaign.clicksAvailable
                                        ? formatCount(campaign.clicksValue)
                                        : "—",
                                    },
                                    {
                                      label: "CTR",
                                      value: formatPercent(
                                        campaign.ctrValue,
                                        campaign.ctrAvailable,
                                      ),
                                    },
                                    {
                                      label: "Conversions",
                                      value: campaign.conversionsAvailable
                                        ? formatCount(
                                            campaign.conversionsValue,
                                          )
                                        : "—",
                                    },
                                    {
                                      label: "CPC",
                                      value:
                                        campaign.costPerClickAvailable
                                          ? formatPreciseCurrency(
                                              campaign.costPerClickValue,
                                            )
                                          : "—",
                                    },
                                    {
                                      label: "Conversion rate",
                                      value: formatPercent(
                                        campaign.conversionRateValue,
                                        campaign.conversionRateAvailable,
                                      ),
                                    },
                                  ].map((metric) => (
                                    <div
                                      className="rounded-xl bg-[#FFFFFF] px-3 py-2.5"
                                      key={metric.label}
                                    >
                                      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#5E6E70]">
                                        {metric.label}
                                      </dt>
                                      <dd className="mt-1 text-sm font-semibold text-[#151f21]">
                                        {metric.value}
                                      </dd>
                                    </div>
                                  ))}
                                </dl>
                                <div className="mt-3 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-3">
                                  <p className="text-xs font-semibold text-[#151f21]">
                                    CRM attribution
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-[#5E6E70]">
                                    {campaign.outcomesLinked
                                      ? `${campaign.leads} leads and ${campaign.bookings} bookings are linked to this campaign.`
                                      : "Leads, bookings, and revenue are not campaign-linked yet, so they are not estimated or repeated here."}
                                  </p>
                                </div>
                              </section>

                              <section
                                aria-labelledby={`${detailsId}-management`}
                                className="border-t border-[#E5E7EB] pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <h4
                                      className="text-sm font-semibold text-[#151f21]"
                                      id={`${detailsId}-management`}
                                    >
                                      {campaign.readOnly ||
                                      !canWriteCampaigns
                                        ? "Campaign source"
                                        : "Campaign controls"}
                                    </h4>
                                    <p className="mt-1 text-xs leading-5 text-[#5E6E70]">
                                      {campaign.readOnly
                                        ? `This campaign is managed in ${campaign.channel}.`
                                        : !canWriteCampaigns
                                          ? "Your access is read-only."
                                          : "Update lifecycle status and creative assets."}
                                    </p>
                                  </div>
                                  <Link
                                    className="btn-secondary min-h-11 text-sm"
                                    href="/app/integrations"
                                  >
                                    <RefreshCw className="h-4 w-4" />
                                    Integrations
                                  </Link>
                                </div>

                                {!campaign.readOnly &&
                                  canWriteCampaigns && (
                                    <>
                                      <div className="mt-4">
                                        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#5E6E70]">
                                          Status
                                        </p>
                                        <div className="mt-2 flex flex-wrap gap-2">
                                          {CAMPAIGN_STATUSES.map((status) => (
                                            <button
                                              className="min-h-11 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] px-3 py-2 text-sm font-medium capitalize text-[#5E6E70] transition-colors hover:border-[rgba(96,180,175,0.35)] hover:text-[#151f21] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9A95] disabled:cursor-not-allowed disabled:opacity-50"
                                              disabled={
                                                isUpdating ||
                                                campaign.status === status
                                              }
                                              key={status}
                                              onClick={() =>
                                                void updateCampaignStatus(
                                                  campaign,
                                                  status,
                                                )
                                              }
                                              type="button"
                                            >
                                              {isUpdating ? (
                                                <Loader2 className="mr-1 inline h-3.5 w-3.5 animate-spin" />
                                              ) : null}
                                              {status}
                                            </button>
                                          ))}
                                        </div>
                                      </div>

                                      <div className="mt-4 border-t border-[#E5E7EB] pt-4">
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                          <div>
                                            <p className="text-sm font-semibold text-[#151f21]">
                                              Creative assets
                                            </p>
                                            <p className="mt-1 text-xs text-[#5E6E70]">
                                              {campaign.media.length} of{" "}
                                              {CAMPAIGN_MEDIA_MAX_ITEMS} assets
                                              attached
                                            </p>
                                          </div>
                                          <input
                                            accept={CAMPAIGN_MEDIA_ACCEPT}
                                            className="peer sr-only"
                                            disabled={
                                              campaignMediaBusy ||
                                              campaign.media.length >=
                                                CAMPAIGN_MEDIA_MAX_ITEMS
                                            }
                                            id={uploadId}
                                            onChange={(event) =>
                                              handleMediaInputChange(
                                                campaign,
                                                event,
                                              )
                                            }
                                            type="file"
                                          />
                                          <label
                                            className={`btn-secondary min-h-11 text-sm peer-focus-visible:ring-2 peer-focus-visible:ring-[#4A9A95] ${
                                              campaignMediaBusy ||
                                              campaign.media.length >=
                                                CAMPAIGN_MEDIA_MAX_ITEMS
                                                ? "cursor-not-allowed opacity-50"
                                                : "cursor-pointer"
                                            }`}
                                            htmlFor={uploadId}
                                          >
                                            <Upload className="h-4 w-4" />
                                            Upload
                                          </label>
                                        </div>

                                        {campaign.media.length > 0 && (
                                          <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                            {campaign.media.map((media) => {
                                              const replaceId = `${uploadId}-${media.id}`;
                                              const mediaBusy =
                                                campaignMediaBusy;
                                              return (
                                                <div
                                                  className="flex min-w-0 items-center gap-3 rounded-xl border border-[#E5E7EB] bg-[#FFFFFF] p-2"
                                                  key={media.id}
                                                >
                                                  {media.mimeType.startsWith(
                                                    "image/",
                                                  ) ? (
                                                    // eslint-disable-next-line @next/next/no-img-element
                                                    <img
                                                      alt={`${media.fileName} preview`}
                                                      className="h-12 w-12 shrink-0 rounded-lg object-cover"
                                                      src={media.dataUrl}
                                                    />
                                                  ) : (
                                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#FAF9F7]">
                                                      <ImageIcon className="h-5 w-5 text-[#5E6E70]" />
                                                    </div>
                                                  )}
                                                  <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm font-medium text-[#151f21]">
                                                      {media.fileName}
                                                    </p>
                                                    <p className="mt-0.5 text-xs text-[#5E6E70]">
                                                      {formatFileSize(
                                                        media.sizeBytes,
                                                      )}
                                                    </p>
                                                  </div>
                                                  <input
                                                    accept={
                                                      CAMPAIGN_MEDIA_ACCEPT
                                                    }
                                                    className="peer sr-only"
                                                    disabled={mediaBusy}
                                                    id={replaceId}
                                                    onChange={(event) =>
                                                      handleMediaInputChange(
                                                        campaign,
                                                        event,
                                                        media.id,
                                                      )
                                                    }
                                                    type="file"
                                                  />
                                                  <label
                                                    aria-label={`Replace ${media.fileName}`}
                                                    className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#5E6E70] transition-colors hover:bg-[#FAF9F7] peer-focus-visible:ring-2 peer-focus-visible:ring-[#4A9A95] ${
                                                      mediaBusy
                                                        ? "cursor-not-allowed opacity-50"
                                                        : "cursor-pointer"
                                                    }`}
                                                    htmlFor={replaceId}
                                                    title={`Replace ${media.fileName}`}
                                                  >
                                                    <Upload className="h-4 w-4" />
                                                  </label>
                                                  <button
                                                    aria-label={`Delete ${media.fileName}`}
                                                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-[#5E6E70] transition-colors hover:bg-[#FAF9F7] hover:text-[#9a5524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4A9A95] disabled:cursor-not-allowed disabled:opacity-50"
                                                    disabled={mediaBusy}
                                                    onClick={() =>
                                                      void deleteCampaignMedia(
                                                        campaign,
                                                        media,
                                                      )
                                                    }
                                                    type="button"
                                                  >
                                                    <Trash2 className="h-4 w-4" />
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}

                                        {campaignMediaBusy && (
                                          <p
                                            aria-live="polite"
                                            className="mt-3 flex items-center gap-2 text-xs text-[#5E6E70]"
                                          >
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            Updating campaign media…
                                          </p>
                                        )}
                                      </div>
                                    </>
                                  )}
                              </section>
                            </div>
                          )}
                        </article>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div className="px-4 py-12 text-center sm:px-5">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-[rgba(96,180,175,0.14)] bg-[rgba(96,180,175,0.08)]">
                    {sourceCampaigns.length === 0 && !sourceFilterKey ? (
                      <Megaphone className="h-5 w-5 text-[#4A9A95]" />
                    ) : (
                      <Filter className="h-5 w-5 text-[#4A9A95]" />
                    )}
                  </div>
                  <h3 className="mt-4 font-semibold text-[#151f21]">
                    {sourceFilterKey && sourceCampaigns.length === 0
                      ? `No ${sourceFilterLabel} campaigns found`
                      : sourceCampaigns.length === 0
                        ? "No campaigns yet"
                        : "No campaigns match these filters"}
                  </h3>
                  <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-[#5E6E70]">
                    {sourceFilterKey && sourceCampaigns.length === 0
                      ? "Sync the integration again or clear the source filter to view every campaign."
                      : sourceCampaigns.length === 0
                        ? canWriteCampaigns
                          ? "Create a campaign plan or connect an ad platform to begin tracking performance."
                          : "Campaigns will appear here when an internal campaign or provider connection is available."
                        : "Adjust the search or filters to return to the full campaign workspace."}
                  </p>
                  <div className="mt-5 flex flex-wrap justify-center gap-2">
                    {sourceCampaigns.length === 0 && canWriteCampaigns && (
                      <Link
                        className="btn-primary !bg-[#9A5524] text-sm hover:!bg-[#151F21]"
                        href="/app/marketing/campaigns/new"
                      >
                        <Plus className="h-4 w-4" />
                        New campaign
                      </Link>
                    )}
                    {(hasActiveFilters || sourceFilterKey) && (
                      <button
                        className="btn-secondary min-h-11 text-sm"
                        onClick={clearAllFilters}
                        type="button"
                      >
                        Clear filters
                      </button>
                    )}
                    {sourceCampaigns.length === 0 && (
                      <Link
                        className="btn-secondary min-h-11 text-sm"
                        href="/app/integrations"
                      >
                        <RefreshCw className="h-4 w-4" />
                        Integrations
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </section>
          </Card>
        </>
      )}
    </div>
  );
}
