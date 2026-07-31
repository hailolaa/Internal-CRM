import type {
  ProposalListParams,
  ProposalPayload,
  ProposalPublicPreviewRecord,
  ProposalRecord,
  ProposalSendPayload,
  ProposalShareRecord,
  ProposalSignatureRequestRecord,
  ProposalSourceDataParams,
  ProposalSourceDataRecord,
  ProposalStatusUpdatePayload,
  ProposalTemplateRecord,
} from "@/lib/api-types";
import { downloadCsv, type ApiRequest } from "./core";

function toQuery(params: object = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });
  return searchParams.toString();
}

export function createProposalsApi(apiRequest: ApiRequest) {
  return {
    proposals: {
      async list(token: string, params: ProposalListParams = {}) {
        const query = toQuery(params);
        const response = await apiRequest<ProposalRecord[]>(
          `/api/proposals${query ? `?${query}` : ""}`,
          { token },
        );
        return response.data!;
      },
      async exportCsv(token: string, params: ProposalListParams = {}) {
        const query = toQuery(params);
        return downloadCsv(
          `/api/proposals/export/csv${query ? `?${query}` : ""}`,
          token,
          "proposals-export.csv",
        );
      },
      async get(token: string, proposalId: string) {
        const response = await apiRequest<ProposalRecord>(`/api/proposals/${proposalId}`, { token });
        return response.data!;
      },
      async getShared(publicToken: string) {
        const response = await apiRequest<ProposalPublicPreviewRecord>(
          `/api/proposals/shared/${encodeURIComponent(publicToken)}`,
        );
        return response.data!;
      },
      async sourceData(token: string, params: ProposalSourceDataParams) {
        const query = toQuery(params);
        const response = await apiRequest<ProposalSourceDataRecord>(
          `/api/proposals/source-data${query ? `?${query}` : ""}`,
          { token },
        );
        return response.data!;
      },
      async templates(token: string, params: { includeInactive?: boolean } = {}) {
        const query = toQuery(params);
        const response = await apiRequest<ProposalTemplateRecord[]>(
          `/api/proposals/templates${query ? `?${query}` : ""}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: ProposalPayload) {
        const response = await apiRequest<ProposalRecord>("/api/proposals", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, proposalId: string, payload: ProposalPayload) {
        const response = await apiRequest<ProposalRecord>(`/api/proposals/${proposalId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async share(token: string, proposalId: string) {
        const response = await apiRequest<ProposalShareRecord>(`/api/proposals/${proposalId}/share`, {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async send(token: string, proposalId: string, payload: ProposalSendPayload) {
        const response = await apiRequest<ProposalRecord>(`/api/proposals/${proposalId}/send`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async updateStatus(token: string, proposalId: string, payload: ProposalStatusUpdatePayload) {
        const response = await apiRequest<ProposalRecord>(`/api/proposals/${proposalId}/status`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async listSignatureRequests(token: string, proposalId: string) {
        const response = await apiRequest<ProposalSignatureRequestRecord[]>(
          `/api/proposals/${proposalId}/signature-requests`,
          { token },
        );
        return response.data!;
      },
      async createSignatureRequest(
        token: string,
        proposalId: string,
        payload: { signerName?: string | null; signerEmail?: string | null; idempotencyKey?: string | null },
      ) {
        const response = await apiRequest<ProposalSignatureRequestRecord>(
          `/api/proposals/${proposalId}/signature-requests`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async remove(token: string, proposalId: string) {
        return apiRequest<never>(`/api/proposals/${proposalId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
