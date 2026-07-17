import type {
  PipelineDealListResult,
  PipelineDealMovePayload,
  PipelineDealPayload,
  PipelineDealRecord,
  PipelineDealUpdatePayload,
  PipelineStagePayload,
  PipelineStageRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createPipelineApi(apiRequest: ApiRequest) {
  return {
    pipelineStages: {
      async list(token: string) {
        const response = await apiRequest<PipelineStageRecord[]>(
          "/api/pipeline/stages",
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: PipelineStagePayload) {
        const response = await apiRequest<PipelineStageRecord>(
          "/api/pipeline/stages",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async update(
        token: string,
        stageId: string,
        payload: Partial<PipelineStagePayload>,
      ) {
        const response = await apiRequest<PipelineStageRecord>(
          `/api/pipeline/stages/${stageId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async remove(token: string, stageId: string) {
        return apiRequest<never>(`/api/pipeline/stages/${stageId}`, {
          method: "DELETE",
          token,
        });
      },
    },
    pipelineDeals: {
      async list(token: string) {
        const response = await apiRequest<PipelineDealListResult>(
          "/api/pipeline/deals",
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: PipelineDealPayload) {
        const response = await apiRequest<PipelineDealRecord>(
          "/api/pipeline/deals",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async update(
        token: string,
        dealId: string,
        payload: PipelineDealUpdatePayload,
      ) {
        const response = await apiRequest<PipelineDealRecord>(
          `/api/pipeline/deals/${dealId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async move(
        token: string,
        dealId: string,
        payload: PipelineDealMovePayload,
      ) {
        const response = await apiRequest<PipelineDealRecord>(
          `/api/pipeline/deals/${dealId}/move`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async remove(token: string, dealId: string) {
        return apiRequest<never>(`/api/pipeline/deals/${dealId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
