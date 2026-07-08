import type {
  ResponseTimeMetricsRecord,
  SlaBreachRecord,
  SlaLeadRecord,
  SlaSummaryRecord,
  StaffResponseMetricRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createSlaApi(apiRequest: ApiRequest) {
  return {
    sla: {
      async getSummary(token: string) {
        const response = await apiRequest<SlaSummaryRecord>("/api/sla/summary", {
          token,
        });
        return response.data!;
      },
      async listLeads(token: string) {
        const response = await apiRequest<SlaLeadRecord[]>("/api/sla/leads", {
          token,
        });
        return response.data!;
      },
      async listBreaches(token: string) {
        const response = await apiRequest<SlaBreachRecord[]>(
          "/api/sla/breaches",
          { token },
        );
        return response.data!;
      },
      async getResponseTimeMetrics(token: string) {
        const response = await apiRequest<ResponseTimeMetricsRecord>(
          "/api/metrics/response-time",
          { token },
        );
        return response.data!;
      },
      async getStaffResponseMetrics(token: string) {
        const response = await apiRequest<StaffResponseMetricRecord[]>(
          "/api/metrics/staff-response",
          { token },
        );
        return response.data!;
      },
    },
  };
}
