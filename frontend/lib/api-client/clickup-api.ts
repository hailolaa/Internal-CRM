import type {
  ClickUpCategoryMappingRecord,
  ClickUpFolderRecord,
  ClickUpConnectionRecord,
  ClickUpIntegrationStatus,
  ClickUpListRecord,
  ClickUpMemberRecord,
  ClickUpOAuthStartRecord,
  ClickUpOperationsDashboardRecord,
  ClickUpPriorityMappingRecord,
  ClickUpSpaceRecord,
  ClickUpTaskCreatePayload,
  ClickUpTaskMappingRecord,
  ClickUpWorkspaceRecord,
  FailedTaskMapping,
  CreateClickUpTaskResult,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createClickUpApi(apiRequest: ApiRequest) {
  return {
    clickup: {
      async getStatus(token: string) {
        const response = await apiRequest<ClickUpIntegrationStatus>("/api/clickup/status", { token });
        return response.data!;
      },
      async startOAuth(token: string) {
        const response = await apiRequest<ClickUpOAuthStartRecord>("/api/clickup/oauth/start", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async connectConfiguredApiToken(token: string) {
        const response = await apiRequest<ClickUpConnectionRecord>("/api/clickup/api-token/connect", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async revoke(token: string) {
        const response = await apiRequest<ClickUpConnectionRecord>("/api/clickup/revoke", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async listWorkspaces(token: string) {
        const response = await apiRequest<ClickUpWorkspaceRecord[]>("/api/clickup/remote/workspaces", { token });
        return response.data!;
      },
      async listSpaces(token: string, workspaceId?: string | null) {
        const response = await apiRequest<ClickUpSpaceRecord[]>(`/api/clickup/remote/spaces${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`, { token });
        return response.data!;
      },
      async listFolders(token: string, params: { workspaceId?: string | null; spaceId: string }) {
        const query = new URLSearchParams();
        if (params.workspaceId) query.set("workspaceId", params.workspaceId);
        query.set("spaceId", params.spaceId);
        const response = await apiRequest<ClickUpFolderRecord[]>(`/api/clickup/remote/folders?${query.toString()}`, { token });
        return response.data!;
      },
      async listLists(token: string, params: { workspaceId?: string | null; spaceId?: string | null; folderId?: string | null }) {
        const query = new URLSearchParams();
        if (params.workspaceId) query.set("workspaceId", params.workspaceId);
        if (params.spaceId) query.set("spaceId", params.spaceId);
        if (params.folderId) query.set("folderId", params.folderId);
        const response = await apiRequest<ClickUpListRecord[]>(`/api/clickup/remote/lists?${query.toString()}`, { token });
        return response.data!;
      },
      async listMembers(token: string, workspaceId?: string | null) {
        const response = await apiRequest<ClickUpMemberRecord[]>(`/api/clickup/remote/members${workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : ""}`, { token });
        return response.data!;
      },
      async getOperationsDashboard(token: string) {
        const response = await apiRequest<ClickUpOperationsDashboardRecord>("/api/clickup/operations-dashboard", { token });
        return response.data!;
      },
      async listCategoryMappings(token: string, clientAccountProfileId: string) {
        const response = await apiRequest<ClickUpCategoryMappingRecord[]>(`/api/clickup/category-mappings/${encodeURIComponent(clientAccountProfileId)}`, { token });
        return response.data!;
      },
      async saveCategoryMapping(token: string, clientAccountProfileId: string, payload: Partial<ClickUpCategoryMappingRecord>) {
        const response = await apiRequest<ClickUpCategoryMappingRecord>(`/api/clickup/category-mappings/${encodeURIComponent(clientAccountProfileId)}`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async listPriorityMappings(token: string) {
        const response = await apiRequest<ClickUpPriorityMappingRecord[]>("/api/clickup/priority-mappings", { token });
        return response.data!;
      },
      async listTaskMappings(token: string, clientAccountProfileId: string) {
        const response = await apiRequest<ClickUpTaskMappingRecord[]>(`/api/clickup/task-mappings?clientAccountProfileId=${encodeURIComponent(clientAccountProfileId)}`, { token });
        return response.data!;
      },
      async savePriorityMapping(token: string, payload: { missionControlPriority: "low" | "medium" | "high" | "urgent"; clickupPriority: 1 | 2 | 3 | 4 }) {
        const response = await apiRequest<ClickUpPriorityMappingRecord>("/api/clickup/priority-mappings", {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async createTask(token: string, payload: ClickUpTaskCreatePayload, attachments?: File[]) {
        if (attachments?.length) {
          const body = new FormData();
          body.set("payload", JSON.stringify(payload));
          attachments.slice(0, 5).forEach((file) => body.append("attachments", file));
          const response = await apiRequest<CreateClickUpTaskResult>("/api/clickup/tasks/create", {
            method: "POST",
            token,
            body,
          });
          return response.data!;
        }
        const response = await apiRequest<CreateClickUpTaskResult>("/api/clickup/tasks/create", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async listFailedTaskMappings(token: string) {
        const response = await apiRequest<FailedTaskMapping[]>("/api/clickup/reconciliation/failed-tasks", { token });
        return response.data!;
      },
      async replayFailedTaskMapping(token: string, mappingId: string) {
        const response = await apiRequest<{ mapping: ClickUpTaskMappingRecord; message: string }>(`/api/clickup/reconciliation/failed-tasks/${encodeURIComponent(mappingId)}/replay`, {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async dismissFailedTaskMapping(token: string, mappingId: string) {
        const response = await apiRequest<{ success: boolean }>(`/api/clickup/reconciliation/failed-tasks/${encodeURIComponent(mappingId)}/dismiss`, {
          method: "POST",
          token,
        });
        return response.data!;
      },
    },
  };
}
