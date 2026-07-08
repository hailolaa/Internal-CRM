import type { ApiRequest } from "./core";
import { createAiApi } from "./ai-api";
import { createAutomationsApi } from "./automations-api";
import { createFormsApi } from "./forms-api";
import { createOpsLogsApi } from "./ops-logs-api";
import { createSequencesApi } from "./sequences-api";

export function createWorkflowsApi(apiRequest: ApiRequest) {
  return {
    ...createAutomationsApi(apiRequest),
    ...createOpsLogsApi(apiRequest),
    ...createFormsApi(apiRequest),
    ...createSequencesApi(apiRequest),
    ...createAiApi(apiRequest),
  };
}
