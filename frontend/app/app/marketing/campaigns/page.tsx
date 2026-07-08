"use client";

import {
  Plus,
  TrendingUp,
  PoundSterling,
  Users,
  Target,
  Eye,
  Pause,
  Play,
  AlertTriangle,
  CheckCircle,
  Image as ImageIcon,
  FileText,
  Trash2,
  Upload,
} from "lucide-react";
import { type ChangeEvent, Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertBanner,
  PageHeader,
  StatCard,
  SearchInput,
  DataTable,
  TableRow,
  TableCell,
  StatusBadge,
  MoreButton,
  StatCardSkeleton,
  TableRowSkeleton,
} from "@/components/ui";
import { api } from "@/lib/api-client";
import type {
  CampaignMediaRecord,
  CampaignMetricRecord,
  CampaignRecord,
} from "@/lib/api-types";
import { useAuth } from "@/lib/auth-context";
import {
  CAMPAIGN_MEDIA_ACCEPT,
  CAMPAIGN_MEDIA_MAX_ITEMS,
  readCampaignMediaDataUrl,
  validateCampaignMediaFile,
} from "@/lib/campaign-media";

type CampaignRow = {
  id: string;
  name: string;
  channel: string;
  budgetValue: number;
  spentValue: number;
  leads: number;
  bookings: number;
  cplValue: number;
  roasValue: number;
  status: string;
  attribution: string | null;
  media: CampaignMediaRecord[];
};

const statusIcons: Record<string, typeof Play> = {
  active: Pause,
  paused: Play,
  draft: Play,
  scheduled: Play,
  completed: Eye,
  archived: Eye,
};

const statusActionLabels: Record<string, string> = {
  active: "Pause",
  paused: "Start",
  draft: "Start",
  scheduled: "Start",
  completed: "View",
  archived: "View",
};

function formatCurrency(value: number) {
  return `£${Math.round(value || 0).toLocaleString()}`;
}

function formatMetricCurrency(value: number) {
  return value > 0 ? `£${Math.round(value).toLocaleString()}` : "—";
}

function formatRoas(value: number) {
  return value > 0 ? `${Number(value).toFixed(2)}x` : "—";
}

function formatFileSize(value: number) {
  return `${Math.max(1, Math.round(value / 1024)).toLocaleString()} KB`;
}

function normaliseKey(value: string | null | undefined) {
  return (value || "").trim().toLowerCase();
}

function getMetricForCampaign(
  campaign: CampaignRecord,
  metrics: CampaignMetricRecord[],
) {
  const campaignName = normaliseKey(campaign.name);
  const campaignChannel = normaliseKey(campaign.channel || campaign.type);

  return metrics.find((metric) => {
    const metricCampaign = normaliseKey(metric.campaign);
    const metricChannel = normaliseKey(metric.channel || metric.source);
    return (
      (metricCampaign && metricCampaign === campaignName) ||
      (metricCampaign && campaignName.includes(metricCampaign)) ||
      (campaignChannel && metricChannel && campaignChannel === metricChannel)
    );
  });
}

function toCampaignRow(
  campaign: CampaignRecord,
  metrics: CampaignMetricRecord[],
): CampaignRow {
  const metric = getMetricForCampaign(campaign, metrics);

  return {
    id: campaign.id,
    name: campaign.name,
    channel: campaign.channel || campaign.type || "Marketing",
    budgetValue: campaign.budget || 0,
    spentValue: metric?.spend || 0,
    leads: metric?.leads || 0,
    bookings: metric?.bookedConsults || 0,
    cplValue: metric?.costPerLead || 0,
    roasValue: metric?.roas || 0,
    status: campaign.status || "draft",
    attribution: metric?.attribution || null,
    media: campaign.media || [],
  };
}

export default function CampaignsPage() {
  const router = useRouter();
  const { session } = useAuth();
  const token = session?.token;
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [openActionsCampaignId, setOpenActionsCampaignId] = useState<
    string | null
  >(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [updatingCampaignId, setUpdatingCampaignId] = useState<string | null>(
    null,
  );
  const [mediaMutationId, setMediaMutationId] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;

    let isMounted = true;
    Promise.all([api.campaigns.list(token), api.reports.campaignMetrics(token)])
      .then(([records, metrics]) => {
        if (!isMounted) return;
        const rows = records.map((campaign) => toCampaignRow(campaign, metrics));
        setLoadError("");
        setCampaigns(rows);
      })
      .catch((err) => {
        if (!isMounted) return;
        setLoadError(
          err instanceof Error
            ? err.message
            : "Unable to load campaigns from the backend.",
        );
        setCampaigns([]);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  const filteredCampaigns = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return campaigns;
    return campaigns.filter(
      (campaign) =>
        campaign.name.toLowerCase().includes(query) ||
        campaign.channel.toLowerCase().includes(query) ||
        campaign.status.toLowerCase().includes(query),
    );
  }, [campaigns, searchQuery]);

  const totalSpend = campaigns.reduce((acc, c) => acc + c.spentValue, 0);
  const totalLeads = campaigns.reduce((acc, c) => acc + c.leads, 0);
  const totalBookings = campaigns.reduce((acc, c) => acc + c.bookings, 0);
  const averageCpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;

  const updateCampaignStatus = async (
    campaign: CampaignRow,
    status: string,
  ) => {
    if (!token) return;

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
      setActionMessage(`${campaign.name} marked as ${status}.`);
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
    if (!token) return;

    const validationError = validateCampaignMediaFile(file);
    if (validationError) {
      setActionError(`${file.name}: ${validationError}`);
      return;
    }

    if (!mediaId && campaign.media.length >= CAMPAIGN_MEDIA_MAX_ITEMS) {
      setActionError(`Campaigns can have up to ${CAMPAIGN_MEDIA_MAX_ITEMS} media assets.`);
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
        fileName: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
        dataUrl,
      };
      const media = mediaId
        ? await api.campaigns.replaceMedia(token, campaign.id, mediaId, payload)
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
        error instanceof Error ? error.message : "Unable to upload campaign media.",
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
    if (!token) return;

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
                media: item.media.filter((existing) => existing.id !== media.id),
              }
            : item,
        ),
      );
      setActionMessage(`${media.fileName} removed from ${campaign.name}.`);
    } catch (error) {
      setActionError(
        error instanceof Error ? error.message : "Unable to delete campaign media.",
      );
    } finally {
      setMediaMutationId(null);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Campaigns"
        subtitle="Track your marketing campaigns and ROI."
        right={
          <button
            onClick={() => router.push("/app/marketing/campaigns/new")}
            className="btn-primary w-fit"
          >
            <Plus className="w-4 h-4" /> New Campaign
          </button>
        }
      />

      {loadError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Backend campaigns could not be loaded"
          description={loadError}
          variant="warning"
        />
      )}

      {actionMessage && (
        <AlertBanner
          icon={CheckCircle}
          title={actionMessage}
          variant="success"
        />
      )}

      {actionError && (
        <AlertBanner
          icon={AlertTriangle}
          title="Campaign action failed"
          description={actionError}
          variant="error"
        />
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          Array.from({ length: 4 }, (_, index) => <StatCardSkeleton key={index} />)
        ) : (
          <>
            <StatCard
              label="Total Spend"
              value={formatCurrency(totalSpend)}
              icon={PoundSterling}
              color="blue"
            />
            <StatCard
              label="Total Leads"
              value={totalLeads.toString()}
              icon={Users}
              color="green"
            />
            <StatCard
              label="Bookings"
              value={totalBookings.toString()}
              icon={Target}
              color="indigo"
            />
            <StatCard
              label="Avg CPL"
              value={totalLeads > 0 ? `£${averageCpl}` : "—"}
              icon={TrendingUp}
              color="indigo"
            />
          </>
        )}
      </div>

      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        placeholder="Search campaigns..."
        className="max-w-md"
      />

      <DataTable
        headers={[
          { label: "Campaign" },
          { label: "Channel", className: "hidden md:table-cell" },
          { label: "Budget", className: "hidden lg:table-cell" },
          { label: "Spent" },
          { label: "Leads", className: "hidden md:table-cell" },
          { label: "Bookings", className: "hidden lg:table-cell" },
          { label: "CPL" },
          { label: "ROAS", className: "hidden md:table-cell" },
          { label: "Status" },
          { label: "" },
        ]}
      >
        {isLoading &&
          Array.from({ length: 6 }, (_, index) => (
            <TableRowSkeleton key={index} columns={10} />
          ))}
        {!isLoading && filteredCampaigns.map((campaign) => {
          const StatusIcon = statusIcons[campaign.status] || Eye;
          const actionLabel = statusActionLabels[campaign.status] || "View";
          const nextQuickStatus =
            campaign.status === "active" ? "paused" : "active";
          return (
            <Fragment key={campaign.id}>
              <TableRow>
                <TableCell>
                  <span className="font-medium text-[#111111]">
                    {campaign.name}
                  </span>
                  <span className="text-xs text-[#6B7280] md:hidden block">
                    {campaign.channel}
                  </span>
                  {campaign.attribution && (
                    <span className="mt-1 block text-[11px] text-[#6B7280]">
                      {campaign.attribution}
                    </span>
                  )}
                  {campaign.media.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {campaign.media.slice(0, 3).map((media) =>
                        media.mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={media.id}
                            src={media.dataUrl}
                            alt=""
                            className="h-8 w-8 rounded-lg border border-[rgba(0,0,0,0.06)] object-cover"
                          />
                        ) : (
                          <span
                            key={media.id}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5]"
                          >
                            <FileText className="h-4 w-4 text-[#6B7280]" />
                          </span>
                        ),
                      )}
                      {campaign.media.length > 3 && (
                        <span className="inline-flex h-8 items-center rounded-lg border border-[rgba(0,0,0,0.06)] bg-[#FAF8F5] px-2 text-xs text-[#6B7280]">
                          +{campaign.media.length - 3}
                        </span>
                      )}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-[#6B7280] hidden md:table-cell">
                  {campaign.channel}
                </TableCell>
                <TableCell className="text-[#6B7280] hidden lg:table-cell">
                  {formatCurrency(campaign.budgetValue)}
                </TableCell>
                <TableCell className="text-[#6B7280]">
                  {formatCurrency(campaign.spentValue)}
                </TableCell>
                <TableCell className="text-[#6B7280] hidden md:table-cell">
                  {campaign.leads}
                </TableCell>
                <TableCell className="text-[#6B7280] hidden lg:table-cell">
                  {campaign.bookings}
                </TableCell>
                <TableCell className="text-[#6E6AE8] font-medium">
                  {formatMetricCurrency(campaign.cplValue)}
                </TableCell>
                <TableCell className="text-green-600 font-medium hidden md:table-cell">
                  {formatRoas(campaign.roasValue)}
                </TableCell>
                <TableCell>
                  <StatusBadge status={campaign.status} />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        campaign.status === "completed" ||
                        campaign.status === "archived"
                          ? setOpenActionsCampaignId((current) =>
                              current === campaign.id ? null : campaign.id,
                            )
                          : void updateCampaignStatus(
                              campaign,
                              nextQuickStatus,
                            )
                      }
                      disabled={updatingCampaignId === campaign.id}
                      aria-label={`${actionLabel} ${campaign.name}`}
                      className="p-1.5 rounded-lg hover:bg-[rgba(0,0,0,0.04)] disabled:opacity-50"
                    >
                      <StatusIcon className="w-4 h-4 text-[#6B7280]" />
                    </button>
                    <MoreButton
                      label={`More options for ${campaign.name}`}
                      onClick={() =>
                        setOpenActionsCampaignId((current) =>
                          current === campaign.id ? null : campaign.id,
                        )
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
              {openActionsCampaignId === campaign.id && (
                <TableRow>
                  <td colSpan={10} className="px-6 py-4">
                    <div className="space-y-4 rounded-2xl border border-[rgba(21,31,33,0.06)] bg-[#FAF8F5] p-3">
                      <div className="flex flex-wrap gap-2">
                        {["draft", "active", "paused", "completed", "archived"].map(
                          (status) => (
                            <button
                              key={status}
                              onClick={() =>
                                void updateCampaignStatus(campaign, status)
                              }
                              disabled={
                                updatingCampaignId === campaign.id ||
                                campaign.status === status
                              }
                              className="rounded-xl bg-white px-3 py-2 text-sm font-medium capitalize text-[#5e8a8d] hover:bg-[#eaedeb] disabled:opacity-50"
                            >
                              {status}
                            </button>
                          ),
                        )}
                      </div>
                      <div className="space-y-3 border-t border-[rgba(21,31,33,0.06)] pt-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-medium text-[#111111]">
                              Campaign media
                            </p>
                            <p className="text-xs text-[#6B7280]">
                              {campaign.media.length
                                ? `${campaign.media.length} asset${campaign.media.length === 1 ? "" : "s"} uploaded`
                                : "No media uploaded yet"}
                            </p>
                          </div>
                          <input
                            id={`campaign-media-${campaign.id}`}
                            type="file"
                            accept={CAMPAIGN_MEDIA_ACCEPT}
                            className="hidden"
                            onChange={(event) => handleMediaInputChange(campaign, event)}
                          />
                          <label
                            htmlFor={`campaign-media-${campaign.id}`}
                            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm font-medium text-[#5e8a8d] hover:bg-[#eaedeb]"
                          >
                            <Upload className="h-4 w-4" />
                            Upload
                          </label>
                        </div>
                        {campaign.media.length > 0 && (
                          <div className="grid gap-2 md:grid-cols-2">
                            {campaign.media.map((media) => {
                              const replaceId = `campaign-media-${campaign.id}-${media.id}`;
                              const deleteMutation = `${campaign.id}:${media.id}:delete`;
                              const replaceMutation = `${campaign.id}:${media.id}:replace`;
                              return (
                                <div
                                  key={media.id}
                                  className="flex items-center gap-3 rounded-xl bg-white p-2"
                                >
                                  {media.mimeType.startsWith("image/") ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                      src={media.dataUrl}
                                      alt=""
                                      className="h-12 w-12 rounded-lg object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-[#FAF8F5]">
                                      <ImageIcon className="h-5 w-5 text-[#6B7280]" />
                                    </div>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-medium text-[#111111]">
                                      {media.fileName}
                                    </p>
                                    <p className="text-xs text-[#6B7280]">
                                      {formatFileSize(media.sizeBytes)}
                                    </p>
                                  </div>
                                  <input
                                    id={replaceId}
                                    type="file"
                                    accept={CAMPAIGN_MEDIA_ACCEPT}
                                    className="hidden"
                                    onChange={(event) =>
                                      handleMediaInputChange(campaign, event, media.id)
                                    }
                                  />
                                  <label
                                    htmlFor={replaceId}
                                    className="cursor-pointer rounded-lg p-2 text-[#6B7280] hover:bg-[#FAF8F5]"
                                    aria-label={`Replace ${media.fileName}`}
                                  >
                                    <Upload className="h-4 w-4" />
                                  </label>
                                  <button
                                    type="button"
                                    onClick={() => void deleteCampaignMedia(campaign, media)}
                                    disabled={
                                      mediaMutationId === deleteMutation ||
                                      mediaMutationId === replaceMutation
                                    }
                                    className="rounded-lg p-2 text-[#6B7280] hover:bg-[#FAF8F5] disabled:opacity-50"
                                    aria-label={`Delete ${media.fileName}`}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {mediaMutationId?.startsWith(`${campaign.id}:`) && (
                          <p className="text-xs text-[#6B7280]">
                            Updating campaign media...
                          </p>
                        )}
                      </div>
                    </div>
                  </td>
                </TableRow>
              )}
            </Fragment>
          );
        })}
        {!isLoading && filteredCampaigns.length === 0 && (
          <TableRow>
            <td className="px-6 py-8 text-sm text-[#6B7280]" colSpan={10}>
              No campaigns loaded yet.
            </td>
          </TableRow>
        )}
      </DataTable>
    </div>
  );
}
