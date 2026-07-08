import type { ApiRequest } from "./core";
import { createAppointmentsApi } from "./appointments-api";
import { createConsultsApi } from "./consults-api";
import { createContactsApi } from "./contacts-api";
import { createGrowthApi } from "./growth-api";
import { createInternalOpsApi } from "./internal-ops-api";
import { createPipelineApi } from "./pipeline-api";
import { createSlaApi } from "./sla-api";
import { createWorkflowsApi } from "./workflows-api";

export function createOperationsApi(apiRequest: ApiRequest) {
  return {
    ...createAppointmentsApi(apiRequest),
    ...createConsultsApi(apiRequest),
    ...createContactsApi(apiRequest),
    ...createInternalOpsApi(apiRequest),
    ...createPipelineApi(apiRequest),
    ...createSlaApi(apiRequest),
    ...createWorkflowsApi(apiRequest),
    ...createGrowthApi(apiRequest),
  };
}
