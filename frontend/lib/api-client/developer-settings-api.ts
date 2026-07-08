import type { ApiRequest } from "./core";
import { createMessageTemplatesApi } from "./developer-settings-api/message-templates";
import { createRolesApi } from "./developer-settings-api/roles";
import { createWebhooksApi } from "./developer-settings-api/webhooks";

export function createDeveloperSettingsApi(apiRequest: ApiRequest) {
  return {
    roles: createRolesApi(apiRequest),
    webhooks: createWebhooksApi(apiRequest),
    messageTemplates: createMessageTemplatesApi(apiRequest),
  };
}
