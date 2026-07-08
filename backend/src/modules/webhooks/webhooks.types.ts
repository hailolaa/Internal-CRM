export interface WebhookEndpointResponse {
  id: string;
  url: string;
  description: string | null;
  events: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateWebhookEndpointDTO {
  url: string;
  description?: string;
  events: string[];
  secret?: string;
  isActive?: boolean;
}

export type UpdateWebhookEndpointDTO = Partial<CreateWebhookEndpointDTO>;
