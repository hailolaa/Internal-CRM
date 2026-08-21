import type {
  ProposalListParams,
  ProposalDiscoveryDraftResult,
  ProposalDiscoverySessionRecord,
  ProposalDiscoveryStartPayload,
  ProposalDiscoveryUpdatePayload,
  ProposalPayload,
  ProposalClientReadinessRecord,
  ProposalProofAssetPayload,
  ProposalProofAssetRecord,
  ProposalPublicAcceptancePayload,
  ProposalPublicEventPayload,
  ProposalPublicPreviewRecord,
  ProposalRecord,
  ProposalRenderRecord,
  ProposalSendPayload,
  ProposalShareRecord,
  ProposalSignatureRequestRecord,
  ProposalSourceDataParams,
  ProposalSourceDataRecord,
  ProposalStatusUpdatePayload,
  ProposalTemplatePayload,
  ProposalTemplateRecord,
  ProposalTemplateVersionCompareRecord,
  ProposalTemplateVersionPayload,
  ProposalTemplateVersionRecord,
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
      async acceptShared(publicToken: string, payload: ProposalPublicAcceptancePayload) {
        const response = await apiRequest<ProposalPublicPreviewRecord>(
          `/api/proposals/shared/${encodeURIComponent(publicToken)}/accept`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async trackShared(publicToken: string, payload: ProposalPublicEventPayload) {
        await apiRequest<{ recorded: boolean }>(
          `/api/proposals/shared/${encodeURIComponent(publicToken)}/events`,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
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
      async createTemplate(token: string, payload: ProposalTemplatePayload) {
        const response = await apiRequest<ProposalTemplateRecord>("/api/proposals/templates", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async templateVersions(token: string, templateId: string) {
        const response = await apiRequest<ProposalTemplateVersionRecord[]>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions`,
          { token },
        );
        return response.data!;
      },
      async createTemplateVersion(token: string, templateId: string, payload: ProposalTemplateVersionPayload = {}) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateTemplateVersion(token: string, templateId: string, versionId: string, payload: ProposalTemplateVersionPayload) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async submitTemplateVersion(token: string, templateId: string, versionId: string) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/submit`,
          { method: "POST", token },
        );
        return response.data!;
      },
      async approveTemplateVersion(token: string, templateId: string, versionId: string) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/approve`,
          { method: "POST", token },
        );
        return response.data!;
      },
      async rejectTemplateVersion(token: string, templateId: string, versionId: string, reason: string) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/reject`,
          {
            method: "POST",
            token,
            body: JSON.stringify({ reason }),
          },
        );
        return response.data!;
      },
      async publishTemplateVersion(token: string, templateId: string, versionId: string) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions/${encodeURIComponent(versionId)}/publish`,
          { method: "POST", token },
        );
        return response.data!;
      },
      async rollbackTemplate(token: string, templateId: string, sourceVersionId: string, reason?: string | null) {
        const response = await apiRequest<ProposalTemplateVersionRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/rollback`,
          {
            method: "POST",
            token,
            body: JSON.stringify({ sourceVersionId, reason }),
          },
        );
        return response.data!;
      },
      async compareTemplateVersions(token: string, templateId: string, fromVersionId: string, toVersionId: string) {
        const query = toQuery({ fromVersionId, toVersionId });
        const response = await apiRequest<ProposalTemplateVersionCompareRecord>(
          `/api/proposals/templates/${encodeURIComponent(templateId)}/versions/compare?${query}`,
          { token },
        );
        return response.data!;
      },
      async proofAssets(token: string, params: { includeInactive?: boolean } = {}) {
        const query = toQuery(params);
        const response = await apiRequest<ProposalProofAssetRecord[]>(
          `/api/proposals/proof-assets${query ? `?${query}` : ""}`,
          { token },
        );
        return response.data!;
      },
      async createProofAsset(token: string, payload: ProposalProofAssetPayload) {
        const response = await apiRequest<ProposalProofAssetRecord>("/api/proposals/proof-assets", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async startDiscoverySession(token: string, payload: ProposalDiscoveryStartPayload) {
        const response = await apiRequest<ProposalDiscoverySessionRecord>("/api/proposals/discovery-sessions/start", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async getDiscoverySession(token: string, sessionId: string) {
        const response = await apiRequest<ProposalDiscoverySessionRecord>(
          `/api/proposals/discovery-sessions/${encodeURIComponent(sessionId)}`,
          { token },
        );
        return response.data!;
      },
      async updateDiscoverySession(token: string, sessionId: string, payload: ProposalDiscoveryUpdatePayload) {
        const response = await apiRequest<ProposalDiscoverySessionRecord>(
          `/api/proposals/discovery-sessions/${encodeURIComponent(sessionId)}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async generateDiscoveryDraft(token: string, sessionId: string) {
        const response = await apiRequest<ProposalDiscoveryDraftResult>(
          `/api/proposals/discovery-sessions/${encodeURIComponent(sessionId)}/generate-draft`,
          {
            method: "POST",
            token,
          },
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
      async validate(token: string, proposalId: string) {
        const response = await apiRequest<ProposalClientReadinessRecord>(`/api/proposals/${proposalId}/validate`, {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async approve(token: string, proposalId: string) {
        const response = await apiRequest<ProposalRecord>(`/api/proposals/${proposalId}/approve`, {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async versionLock(token: string, proposalId: string, payload: ProposalSendPayload) {
        const response = await apiRequest<ProposalRecord>(`/api/proposals/${proposalId}/version-lock`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async render(token: string, proposalId: string) {
        const response = await apiRequest<ProposalRenderRecord>(`/api/proposals/${proposalId}/render`, { token });
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
