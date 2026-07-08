import type {
  CampaignMediaRecord,
  CampaignRecord,
  OfferRecord,
  ReputationSummaryRecord,
  ReviewReplyHandoffRecord,
  ReviewRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createMarketingApi(apiRequest: ApiRequest) {
  return {
    reviews: {
      async list(token: string) {
        const response = await apiRequest<ReviewRecord[]>("/api/reviews", {
          token,
        });
        return response.data!;
      },
      async updateStatus(token: string, reviewId: string, status: string) {
        return apiRequest<never>(`/api/reviews/${reviewId}/status`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ status }),
        });
      },
      async replyHandoff(token: string, reviewId: string) {
        const response = await apiRequest<ReviewReplyHandoffRecord>(
          `/api/reviews/${reviewId}/reply-handoff`,
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async summary(token: string) {
        const response = await apiRequest<ReputationSummaryRecord>(
          "/api/reviews/summary",
          { token },
        );
        return response.data!;
      },
      async updateSettings(token: string, payload: Partial<ReputationSummaryRecord>) {
        const response = await apiRequest<ReputationSummaryRecord>(
          "/api/reviews/settings",
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async createRequest(token: string, payload: {
        contactId?: string | null;
        recipientName?: string | null;
        recipientPhone?: string | null;
        recipientEmail?: string | null;
        message?: string | null;
      }) {
        const response = await apiRequest<{ id: string }>("/api/reviews/requests", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async markRequestSent(token: string, requestId: string) {
        return apiRequest<never>(`/api/reviews/requests/${requestId}/sent`, {
          method: "POST",
          token,
        });
      },
      async updateChecklist(token: string, itemKey: string, completed: boolean) {
        const response = await apiRequest<ReputationSummaryRecord>(
          `/api/reviews/gbp-checklist/${itemKey}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify({ completed }),
          },
        );
        return response.data!;
      },
      async suggestReply(token: string, payload: { rating?: number; comment?: string }) {
        const response = await apiRequest<{ suggestion: string; advisory: boolean; label: string }>(
          "/api/reviews/reply-suggestion",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
    },
    campaigns: {
      async list(token: string) {
        const response = await apiRequest<CampaignRecord[]>("/api/campaigns", {
          token,
        });
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          name: string;
          description?: string | null;
          type?: string | null;
          status?: string | null;
          startDate?: string | null;
          endDate?: string | null;
          budget?: number | null;
          channel?: string | null;
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/campaigns", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async updateStatus(token: string, campaignId: string, status: string) {
        return apiRequest<never>(`/api/campaigns/${campaignId}/status`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ status }),
        });
      },
      async listMedia(token: string, campaignId: string) {
        const response = await apiRequest<CampaignMediaRecord[]>(
          `/api/campaigns/${campaignId}/media`,
          { token },
        );
        return response.data!;
      },
      async uploadMedia(
        token: string,
        campaignId: string,
        payload: {
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          dataUrl: string;
        },
      ) {
        const response = await apiRequest<CampaignMediaRecord>(
          `/api/campaigns/${campaignId}/media`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async replaceMedia(
        token: string,
        campaignId: string,
        mediaId: string,
        payload: {
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          dataUrl: string;
        },
      ) {
        const response = await apiRequest<CampaignMediaRecord>(
          `/api/campaigns/${campaignId}/media/${mediaId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async deleteMedia(token: string, campaignId: string, mediaId: string) {
        return apiRequest<never>(`/api/campaigns/${campaignId}/media/${mediaId}`, {
          method: "DELETE",
          token,
        });
      },
    },
    offers: {
      async list(token: string) {
        const response = await apiRequest<OfferRecord[]>("/api/offers", {
          token,
        });
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          name: string;
          discount: string;
          treatment: string;
          validUntil: string;
          redemptions?: number;
          status?: "active" | "scheduled" | "expired";
          description?: string;
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/offers", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, offerId: string, payload: Partial<OfferRecord>) {
        return apiRequest<never>(`/api/offers/${offerId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, offerId: string) {
        return apiRequest<never>(`/api/offers/${offerId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
