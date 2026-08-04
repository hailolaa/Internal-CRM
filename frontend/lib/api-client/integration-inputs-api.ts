import type {
  PlatformMetricListParams,
  PlatformMetricRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function toPlatformMetricsQuery(params?: PlatformMetricListParams) {
  const search = new URLSearchParams();

  if (params?.aggregate) search.set("aggregate", params.aggregate);
  if (params?.platform) search.set("platform", params.platform);
  if (params?.metricName) search.set("metricName", params.metricName);
  if (params?.campaign) search.set("campaign", params.campaign);
  if (params?.from) search.set("from", params.from);
  if (params?.to) search.set("to", params.to);

  const query = search.toString();
  return query ? `?${query}` : "";
}

export function createIntegrationInputsApi(apiRequest: ApiRequest) {
  return {
    integrationInputs: {
      async listPlatformMetrics(
        token: string,
        params?: PlatformMetricListParams,
      ) {
        const response = await apiRequest<PlatformMetricRecord[]>(
          `/api/integration-inputs/manual-metrics${toPlatformMetricsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
    },
  };
}
