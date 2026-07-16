import type {
  GrowthScoreSnapshotList,
  GrowthScoreSnapshotPayload,
  GrowthScoreSnapshotRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createGrowthScoresApi(apiRequest: ApiRequest) {
  return {
    growthScores: {
      async listSnapshots(
        token: string,
        params: { contactId?: string; clientAccountProfileId?: string; auditId?: string; limit?: number },
      ) {
        const searchParams = new URLSearchParams();
        if (params.contactId) searchParams.set("contactId", params.contactId);
        if (params.clientAccountProfileId) searchParams.set("clientAccountProfileId", params.clientAccountProfileId);
        if (params.auditId) searchParams.set("auditId", params.auditId);
        if (params.limit) searchParams.set("limit", String(params.limit));
        const response = await apiRequest<GrowthScoreSnapshotList>(
          `/api/growth-scores/snapshots?${searchParams.toString()}`,
          { token },
        );
        return response.data!;
      },
      async createSnapshot(token: string, payload: GrowthScoreSnapshotPayload) {
        const response = await apiRequest<GrowthScoreSnapshotRecord>("/api/growth-scores/snapshots", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
    },
  };
}
