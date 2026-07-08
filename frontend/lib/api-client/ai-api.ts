import type {
  AiCampaignAnalystGenerateResult,
  AiCompetitorInsightsGenerateResult,
  AiGrowthBriefGenerateResult,
  AiLtvOptimiserGenerateResult,
  AiProjectRecord,
  AiRunRecord,
  AiSalesAssistantGenerateResult,
  AiShowRateGenerateResult,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createAiApi(apiRequest: ApiRequest) {
  return {
    ai: {
      async listProjects(token: string) {
        const response = await apiRequest<AiProjectRecord[]>(
          "/api/ai/projects",
          { token },
        );
        return response.data!;
      },
      async createProject(
        token: string,
        payload: {
          title: string;
          type: string;
          status?: "active" | "draft" | "completed" | "archived";
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/ai/projects", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async updateProject(
        token: string,
        projectId: string,
        payload: Partial<{
          title: string;
          type: string;
          status: "active" | "draft" | "completed" | "archived";
        }>,
      ) {
        return apiRequest<never>(`/api/ai/projects/${projectId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async listRuns(token: string, filters: { agentKey?: string } = {}) {
        const params = new URLSearchParams();
        if (filters.agentKey) params.set("agentKey", filters.agentKey);

        const query = params.toString();
        const response = await apiRequest<AiRunRecord[]>(
          `/api/ai/runs${query ? `?${query}` : ""}`,
          {
            token,
          },
        );
        return response.data!;
      },
      async generateGrowthBrief(
        token: string,
        payload: { startDate?: string; endDate?: string } = {},
      ) {
        const response = await apiRequest<AiGrowthBriefGenerateResult>(
          "/api/ai/growth-brief/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async generateShowRatePredictions(
        token: string,
        payload: { startDate?: string; endDate?: string } = {},
      ) {
        const response = await apiRequest<AiShowRateGenerateResult>(
          "/api/ai/show-rate/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async generateSalesAssistant(
        token: string,
        payload: {
          contactId?: string;
          leadName?: string;
          treatment?: string;
          context?: string;
        },
      ) {
        const response = await apiRequest<AiSalesAssistantGenerateResult>(
          "/api/ai/sales-assistant/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async generateCampaignAnalyst(
        token: string,
        payload: {
          googleSpend?: number;
          metaSpend?: number;
          leads?: number;
          bookings?: number;
          revenue?: number;
        },
      ) {
        const response = await apiRequest<AiCampaignAnalystGenerateResult>(
          "/api/ai/campaign-analyst/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async generateLtvOptimiser(
        token: string,
        payload: { startDate?: string; endDate?: string } = {},
      ) {
        const response = await apiRequest<AiLtvOptimiserGenerateResult>(
          "/api/ai/ltv-optimiser/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async generateCompetitorInsights(
        token: string,
        payload: { competitorIds?: string[]; notes?: string } = {},
      ) {
        const response = await apiRequest<AiCompetitorInsightsGenerateResult>(
          "/api/ai/competitor-insights/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async createRun(
        token: string,
        payload: {
          projectId?: string;
          agentName: string;
          agentKey: string;
          task: string;
          input?: string;
          output?: unknown;
          status?: "success" | "error" | "running";
          tokens?: number;
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/ai/runs", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
    },
  };
}
