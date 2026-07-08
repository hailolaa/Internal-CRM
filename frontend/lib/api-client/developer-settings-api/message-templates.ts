import type {
  MessageTemplateRecord,
  MessageTemplateTestSendPayload,
  MessageTemplateTestSendResult,
} from "@/lib/api-types";
import type { ApiRequest } from "../core";

type MessageTemplatePayload = {
  name: string;
  channel?: "email" | "sms" | "whatsapp";
  subject?: string;
  body: string;
  status?: "draft" | "active" | "archived";
};

type MessageTemplateUpdatePayload = Partial<{
  name: string;
  channel: "email" | "sms" | "whatsapp";
  subject: string;
  body: string;
  status: "draft" | "active" | "archived";
}>;

export function createMessageTemplatesApi(apiRequest: ApiRequest) {
  return {
    async list(token: string) {
      const response = await apiRequest<MessageTemplateRecord[]>(
        "/api/message-templates",
        { token },
      );
      return response.data!;
    },
    async create(token: string, payload: MessageTemplatePayload) {
      const response = await apiRequest<{ id: string }>(
        "/api/message-templates",
        {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        },
      );
      return response.data!;
    },
    async update(
      token: string,
      templateId: string,
      payload: MessageTemplateUpdatePayload,
    ) {
      return apiRequest<never>(`/api/message-templates/${templateId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
    },
    async remove(token: string, templateId: string) {
      return apiRequest<never>(`/api/message-templates/${templateId}`, {
        method: "DELETE",
        token,
      });
    },
    async testSend(
      token: string,
      templateId: string,
      payload: MessageTemplateTestSendPayload,
    ) {
      const response = await apiRequest<MessageTemplateTestSendResult>(
        `/api/message-templates/${templateId}/test-send`,
        {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        },
      );
      return response.data!;
    },
  };
}
