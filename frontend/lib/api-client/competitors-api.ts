import type { CompetitorRecord } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createCompetitorsApi(apiRequest: ApiRequest) {
  return {
    competitors: {
      async list(token: string) {
        const response = await apiRequest<CompetitorRecord[]>(
          "/api/competitors",
          { token },
        );
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          name: string;
          url: string;
          keyTreatments?: string[];
          pricePosition?: "Budget" | "Mid-range" | "Premium";
          offer?: string;
          messagingAngle?: string;
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/competitors", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async remove(token: string, competitorId: string) {
        return apiRequest<never>(`/api/competitors/${competitorId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
