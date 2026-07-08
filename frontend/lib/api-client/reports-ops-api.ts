import type {
  BackgroundJobsResponse,
  BenchmarkSummaryRecord,
  CampaignMetricRecord,
  DashboardFunnelRecord,
  DashboardRecord,
  DashboardSummaryRecord,
  ReportRecord,
  ReportShareRecord,
  ReportWorkflowUpdatePayload,
  RevenueByChannelRecord,
  RevenueLeakDetailsRecord,
  RevenueLeaksRecord,
  RevenueByTreatmentRecord,
  RoasMetricsRecord,
  SopListParams,
  SopRecord,
  TopOpportunitiesRecord,
} from "@/lib/api-types";
import { publicEnv } from "@/lib/env";
import { ApiClientError, type ApiRequest } from "./core";

export type DashboardQueryParams = {
  startDate?: string;
  endDate?: string;
};

export type ReportExportType =
  | "revenue"
  | "attribution"
  | "pipeline"
  | "operational"
  | "no-shows";

export type ReportCsvExportResult = {
  content: string;
  empty: boolean;
  filename: string;
  rowCount: number;
  type: ReportExportType;
};

function buildQuery(params: object = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "all"
    ) {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

function reportExportUrl(type: ReportExportType, params?: DashboardQueryParams) {
  const query = buildQuery({ ...params, format: "csv" });
  const path = `reports/exports/${type}${query}`;
  return `${publicEnv.apiBaseUrl}/${path}`;
}

function filenameFromContentDisposition(value: string | null) {
  if (!value) return null;

  const encoded = value.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  if (encoded) return decodeURIComponent(encoded.replace(/"/g, ""));

  return value.match(/filename="?([^";]+)"?/i)?.[1] || null;
}

function countCsvDataRows(content: string) {
  const rows = content.trim().split(/\r?\n/);
  return Math.max(rows.length - 1, 0);
}

export function createReportsOpsApi(apiRequest: ApiRequest) {
  return {
    reports: {
      async list(token: string) {
        const response = await apiRequest<ReportRecord[]>("/api/reports", {
          token,
        });
        return response.data!;
      },
      async get(token: string, reportId: string) {
        const response = await apiRequest<ReportRecord>(
          `/api/reports/${reportId}`,
          { token },
        );
        return response.data!;
      },
      async generateMonthly(token: string, month?: string) {
        const response = await apiRequest<ReportRecord>("/api/reports/monthly", {
          method: "POST",
          token,
          body: JSON.stringify({ month }),
        });
        return response.data!;
      },
      async share(token: string, reportId: string) {
        const response = await apiRequest<ReportShareRecord>(
          `/api/reports/${reportId}/share`,
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async updateWorkflow(
        token: string,
        reportId: string,
        payload: ReportWorkflowUpdatePayload,
      ) {
        const response = await apiRequest<ReportRecord>(
          `/api/reports/${reportId}/workflow`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async getShared(shareToken: string) {
        const response = await apiRequest<ReportRecord>(
          `/api/reports/shared/${shareToken}`,
        );
        return response.data!;
      },
      async exportCsv(
        token: string,
        type: ReportExportType,
        params?: DashboardQueryParams,
      ): Promise<ReportCsvExportResult> {
        const response = await fetch(reportExportUrl(type, params), {
          cache: "no-store",
          headers: {
            Accept: "text/csv",
            Authorization: `Bearer ${token}`,
          },
        });
        const content = await response.text();

        if (!response.ok) {
          let message = `CSV export failed with ${response.status}`;
          try {
            const payload = JSON.parse(content) as { message?: string };
            message = payload.message || message;
          } catch {
            if (content) message = content;
          }

          throw new ApiClientError(message, response.status);
        }

        const rowCount =
          Number(response.headers.get("X-Report-Export-Row-Count") || 0) ||
          countCsvDataRows(content);
        const filename =
          filenameFromContentDisposition(
            response.headers.get("Content-Disposition"),
          ) || `phase1-${type}-report.csv`;

        return {
          content,
          empty: content.includes("empty_state"),
          filename,
          rowCount,
          type,
        };
      },
      async dashboards(token: string) {
        const response = await apiRequest<DashboardRecord[]>(
          "/api/reports/dashboards",
          { token },
        );
        return response.data!;
      },
      async dashboardSummary(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<DashboardSummaryRecord>(
          `/api/reports/dashboard/summary${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async dashboardFunnel(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<DashboardFunnelRecord>(
          `/api/reports/dashboard/funnel${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async revenueByChannel(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<RevenueByChannelRecord>(
          `/api/reports/dashboard/revenue-by-channel${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async revenueByTreatment(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<RevenueByTreatmentRecord>(
          `/api/reports/dashboard/revenue-by-treatment${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async revenueLeaks(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<RevenueLeaksRecord>(
          `/api/reports/dashboard/revenue-leaks${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async revenueLeakDetails(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<RevenueLeakDetailsRecord>(
          `/api/reports/dashboard/revenue-leak-details${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async topOpportunities(token: string, params?: DashboardQueryParams) {
        const response = await apiRequest<TopOpportunitiesRecord>(
          `/api/reports/dashboard/top-opportunities${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async roasMetrics(token: string) {
        const response = await apiRequest<RoasMetricsRecord>("/api/metrics/roas", {
          token,
        });
        return response.data!;
      },
      async benchmarkSummary(token: string) {
        const response = await apiRequest<BenchmarkSummaryRecord>(
          "/api/benchmarks/summary",
          { token },
        );
        return response.data!;
      },
      async campaignMetrics(token: string) {
        const response = await apiRequest<CampaignMetricRecord[]>(
          "/api/metrics/campaigns",
          { token },
        );
        return response.data!;
      },
    },
    backgroundJobs: {
      async list(token: string) {
        const response = await apiRequest<BackgroundJobsResponse>(
          "/api/background-jobs",
          { token },
        );
        return response.data!;
      },
      async updateStatus(
        token: string,
        jobId: string,
        status: "active" | "paused",
      ) {
        const response = await apiRequest<BackgroundJobsResponse>(
          `/api/background-jobs/${jobId}/status`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          },
        );
        return response.data!;
      },
    },
    sops: {
      async list(token: string, params?: SopListParams) {
        const response = await apiRequest<SopRecord[]>(
          `/api/sops${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          title: string;
          category?: string;
          content?: string;
          owner?: string;
          status?: "draft" | "published" | "archived";
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/sops", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, sopId: string, payload: Partial<SopRecord>) {
        return apiRequest<never>(`/api/sops/${sopId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, sopId: string) {
        return apiRequest<never>(`/api/sops/${sopId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
