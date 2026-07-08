import type {
  CreateInsightTaskResponse,
  GenerateInsightsResponse,
  AssignInsightPayload,
  InsightListParams,
  InsightRecord,
  InsightStatus,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function toInsightsQuery(params?: InsightListParams) {
  const search = new URLSearchParams();
  if (params?.status) search.set("status", params.status);
  if (params?.severity) search.set("severity", params.severity);
  if (params?.type) search.set("type", params.type);
  const query = search.toString();
  return query ? `?${query}` : "";
}

export function createInsightsApi(apiRequest: ApiRequest) {
  return {
    insights: {
      async list(token: string, params?: InsightListParams) {
        const response = await apiRequest<InsightRecord[]>(
          `/api/insights${toInsightsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async generate(token: string) {
        const response = await apiRequest<GenerateInsightsResponse>(
          "/api/insights/generate",
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async updateStatus(
        token: string,
        insightId: string,
        status: InsightStatus,
      ) {
        return apiRequest<never>(`/api/insights/${insightId}/status`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ status }),
        });
      },
      async assign(
        token: string,
        insightId: string,
        payload: AssignInsightPayload,
      ) {
        return apiRequest<never>(`/api/insights/${insightId}/assign`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async createTask(token: string, insightId: string) {
        const response = await apiRequest<CreateInsightTaskResponse>(
          `/api/insights/${insightId}/task`,
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
    },
  };
}
