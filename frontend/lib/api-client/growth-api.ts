import type { ApiRequest } from "./core";
import { createCommsCallsApi } from "./comms-calls-api";
import { createCompetitorsApi } from "./competitors-api";
import { createInsightsApi } from "./insights-api";
import { createMarketingApi } from "./marketing-api";
import { createMonthlyActionPlansApi } from "./monthly-action-plans-api";
import { createReportsOpsApi } from "./reports-ops-api";
import { createRevenueApi } from "./revenue-api";

export function createGrowthApi(apiRequest: ApiRequest) {
  return {
    ...createMarketingApi(apiRequest),
    ...createInsightsApi(apiRequest),
    ...createMonthlyActionPlansApi(apiRequest),
    ...createCommsCallsApi(apiRequest),
    ...createRevenueApi(apiRequest),
    ...createCompetitorsApi(apiRequest),
    ...createReportsOpsApi(apiRequest),
  };
}
