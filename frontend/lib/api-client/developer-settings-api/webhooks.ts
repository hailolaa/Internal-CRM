import type { WebhookEndpoint } from "@/lib/api-types";
import type { ApiRequest } from "../core";

type WebhookEndpointPayload = {
  url: string;
  description?: string;
  events: string[];
  secret?: string;
  isActive?: boolean;
};

type WebhookEndpointUpdatePayload = Partial<{
  url: string;
  description: string;
  events: string[];
  secret: string;
  isActive: boolean;
}>;

export function createWebhooksApi(apiRequest: ApiRequest) {
  return {
    async listEndpoints(token: string) {
      const response = await apiRequest<WebhookEndpoint[]>(
        "/api/webhooks/endpoints",
        { token },
      );
      return response.data!;
    },
    async createEndpoint(token: string, payload: WebhookEndpointPayload) {
      const response = await apiRequest<{ id: string }>(
        "/api/webhooks/endpoints",
        {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        },
      );
      return response.data!;
    },
    async updateEndpoint(
      token: string,
      endpointId: string,
      payload: WebhookEndpointUpdatePayload,
    ) {
      return apiRequest<never>(`/api/webhooks/endpoints/${endpointId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
    },
    async removeEndpoint(token: string, endpointId: string) {
      return apiRequest<never>(`/api/webhooks/endpoints/${endpointId}`, {
        method: "DELETE",
        token,
      });
    },
  };
}
