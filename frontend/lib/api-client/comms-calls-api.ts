import type {
  CallListParams,
  CallAiBreakdownRecord,
  CallCreatePayload,
  CallLogRecord,
  CallSummaryRecord,
  CallUpdatePayload,
  InboxConversationRecord,
  InboxThreadMessageRecord,
  InboxThreadRecord,
  WhatsAppAiReplyRecord,
  WhatsAppAiSettingsRecord,
  WhatsAppConversationRecord,
  WhatsAppInboundPayload,
  WhatsAppInboundResult,
  WhatsAppMessageRecord,
  StaffCallMetricRecord,
  RecordingDeletionRequestRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildCallsQuery(params: CallListParams = {}) {
  const searchParams = new URLSearchParams();

  if (params.missedOnly !== undefined) {
    searchParams.set("missed", String(params.missedOnly));
  }
  if (params.startDate) {
    searchParams.set("startDate", params.startDate);
  }
  if (params.endDate) {
    searchParams.set("endDate", params.endDate);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function createCommsCallsApi(apiRequest: ApiRequest) {
  return {
    comms: {
      async inbox(token: string) {
        const response = await apiRequest<InboxConversationRecord[]>(
          "/api/comms/inbox",
          { token },
        );
        return response.data!;
      },
      async archivedInbox(token: string) {
        const response = await apiRequest<InboxConversationRecord[]>(
          "/api/comms/inbox?archived=only",
          { token },
        );
        return response.data!;
      },
      async getConversation(token: string, contactId: string) {
        const response = await apiRequest<InboxThreadRecord>(
          `/api/comms/inbox/${contactId}`,
          { token },
        );
        return response.data!;
      },
      async sendMessage(
        token: string,
        contactId: string,
        payload: {
          channel?: "email" | "sms";
          body: string;
          subject?: string | null;
        },
      ) {
        const response = await apiRequest<InboxThreadMessageRecord>(
          `/api/comms/inbox/${contactId}/messages`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async markAllRead(token: string) {
        const response = await apiRequest<{ unread: boolean }>(
          "/api/comms/inbox/read-all",
          {
            method: "PATCH",
            token,
          },
        );
        return response.data!;
      },
      async updateReadState(
        token: string,
        contactId: string,
        payload: { unread: boolean },
      ) {
        const response = await apiRequest<InboxConversationRecord>(
          `/api/comms/inbox/${contactId}/read`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateStarState(
        token: string,
        contactId: string,
        payload: { starred: boolean },
      ) {
        const response = await apiRequest<InboxConversationRecord>(
          `/api/comms/inbox/${contactId}/star`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateArchiveState(
        token: string,
        contactId: string,
        payload: { archived: boolean },
      ) {
        const response = await apiRequest<InboxConversationRecord>(
          `/api/comms/inbox/${contactId}/archive`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async getWhatsAppAiSettings(token: string) {
        const response = await apiRequest<WhatsAppAiSettingsRecord>(
          "/api/comms/whatsapp-ai/settings",
          { token },
        );
        return response.data!;
      },
      async updateWhatsAppAiSettings(
        token: string,
        payload: Partial<WhatsAppAiSettingsRecord>,
      ) {
        const response = await apiRequest<WhatsAppAiSettingsRecord>(
          "/api/comms/whatsapp-ai/settings",
          {
            method: "PUT",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async ingestWhatsAppInbound(token: string, payload: WhatsAppInboundPayload) {
        const response = await apiRequest<WhatsAppInboundResult>(
          "/api/comms/whatsapp/inbound",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async getWhatsAppConversation(token: string, contactId: string) {
        const response = await apiRequest<WhatsAppConversationRecord>(
          `/api/comms/whatsapp/conversations/${contactId}`,
          { token },
        );
        return response.data!;
      },
      async sendWhatsAppMessage(
        token: string,
        contactId: string,
        payload: { body: string; idempotencyKey?: string | null },
      ) {
        const response = await apiRequest<WhatsAppMessageRecord>(
          `/api/comms/whatsapp/conversations/${contactId}/messages`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async draftWhatsAppReply(token: string, inboundMessageId: string) {
        const response = await apiRequest<WhatsAppAiReplyRecord>(
          "/api/comms/whatsapp/ai-replies/draft",
          {
            method: "POST",
            token,
            body: JSON.stringify({ inboundMessageId }),
          },
        );
        return response.data!;
      },
      async approveWhatsAppReply(
        token: string,
        replyId: string,
        payload: { body?: string | null; sendNow?: boolean } = {},
      ) {
        const response = await apiRequest<WhatsAppAiReplyRecord>(
          `/api/comms/whatsapp/ai-replies/${replyId}/approve`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async retryWhatsAppReply(
        token: string,
        replyId: string,
        payload: { body?: string | null; confirmProviderDidNotSend?: boolean } = {},
      ) {
        const response = await apiRequest<WhatsAppAiReplyRecord>(
          `/api/comms/whatsapp/ai-replies/${replyId}/retry`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
    },
    calls: {
      async list(token: string, params?: CallListParams) {
        const response = await apiRequest<CallLogRecord[]>(
          `/api/calls${buildCallsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async get(token: string, callId: string) {
        const response = await apiRequest<CallLogRecord>(
          `/api/calls/${callId}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: CallCreatePayload) {
        const response = await apiRequest<CallLogRecord>("/api/calls", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, callId: string, payload: CallUpdatePayload) {
        const response = await apiRequest<CallLogRecord>(`/api/calls/${callId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async generateIntelligence(token: string, callId: string) {
        const response = await apiRequest<CallLogRecord>(
          `/api/calls/${callId}/generate-intelligence`,
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async transcribe(
        token: string,
        callId: string,
        payload: { generateIntelligence?: boolean } = {},
      ) {
        const response = await apiRequest<CallLogRecord>(
          `/api/calls/${callId}/transcribe`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async followUp(
        token: string,
        callId: string,
        payload: { templateId?: string; sendNow?: boolean } = {},
      ) {
        const response = await apiRequest<{ id?: string; smsId?: string }>(
          `/api/calls/${callId}/follow-up`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async createRecordingDeletionRequest(
        token: string,
        callId: string,
        payload: { reason?: string | null } = {},
      ) {
        const response = await apiRequest<RecordingDeletionRequestRecord>(
          `/api/calls/${callId}/recording-deletion-requests`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateRecordingDeletionRequest(
        token: string,
        requestId: string,
        payload: {
          status: RecordingDeletionRequestRecord["status"];
          reason?: string | null;
        },
      ) {
        const response = await apiRequest<RecordingDeletionRequestRecord>(
          `/api/calls/recording-deletion-requests/${requestId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async summary(token: string, params?: CallListParams) {
        const response = await apiRequest<CallSummaryRecord>(
          `/api/calls/summary${buildCallsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async staffMetrics(token: string, params?: CallListParams) {
        const response = await apiRequest<StaffCallMetricRecord[]>(
          `/api/metrics/calls/staff${buildCallsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async aiBreakdowns(token: string, params?: CallListParams) {
        const response = await apiRequest<CallAiBreakdownRecord[]>(
          `/api/calls/analytics/breakdowns${buildCallsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
    },
  };
}
