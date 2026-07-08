import type {
  GenerateMonthlyActionPlanResponse,
  MonthlyActionPlanItemStatus,
  MonthlyActionPlanRecord,
  MonthlyActionPlanStatus,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildMonthlyPlanQuery(month: string) {
  const params = new URLSearchParams({ month });
  return `?${params.toString()}`;
}

export function createMonthlyActionPlansApi(apiRequest: ApiRequest) {
  return {
    monthlyActionPlans: {
      async get(token: string, month: string) {
        const response = await apiRequest<MonthlyActionPlanRecord | null>(
          `/api/monthly-action-plans${buildMonthlyPlanQuery(month)}`,
          { token },
        );
        return response.data ?? null;
      },
      async generate(token: string, month: string) {
        const response = await apiRequest<GenerateMonthlyActionPlanResponse>(
          "/api/monthly-action-plans/generate",
          {
            method: "POST",
            token,
            body: JSON.stringify({ month }),
          },
        );
        return response.data!;
      },
      async updateStatus(
        token: string,
        planId: string,
        status: MonthlyActionPlanStatus,
      ) {
        return apiRequest<never>(`/api/monthly-action-plans/${planId}/status`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ status }),
        });
      },
      async updateItemStatus(
        token: string,
        planId: string,
        itemId: string,
        status: MonthlyActionPlanItemStatus,
      ) {
        return apiRequest<never>(
          `/api/monthly-action-plans/${planId}/items/${itemId}/status`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify({ status }),
          },
        );
      },
    },
  };
}
