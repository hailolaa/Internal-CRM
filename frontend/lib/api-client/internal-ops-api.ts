import type {
  ClientAccountListParams,
  ClientAccountCreatePayload,
  ClientAccountDriveFolderPayload,
  ClientAccountContactAccountLinkRecord,
  ClientAccountFromContactPayload,
  ClientAccountLinkedRecords,
  ClientAccountProfilePayload,
  ClientAccountProfileRecord,
  ClientAccountServiceListParams,
  ClientAccountServicePayload,
  ClientAccountServiceRecord,
  ClientAccountServiceUpdatePayload,
  ClientAccountSummaryRecord,
  GoogleDriveConnectionRecord,
  GoogleDriveFolderBrowserRecord,
  GoogleDriveFolderCreatePayload,
  GoogleDriveFileRecord,
  GoogleDriveFolderRecord,
  GoogleDriveOAuthStartRecord,
  InternalTaskListParams,
  InternalTaskPayload,
  InternalTaskQaPayload,
  InternalTaskRecord,
  InternalTaskUpdatePayload,
  StrategyLogListParams,
  StrategyLogPayload,
  StrategyLogRecord,
  StrategyLogUpdatePayload,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";
import { publicEnv } from "@/lib/env";

function buildQuery(params: object = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      value === "all"
    ) {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function createInternalOpsApi(apiRequest: ApiRequest) {
  return {
    clientAccounts: {
      async getDriveOAuthStatus(token: string) {
        const response = await apiRequest<GoogleDriveConnectionRecord>(
          "/api/client-accounts/drive/oauth/status",
          { token },
        );
        return response.data!;
      },
      async startDriveOAuth(token: string) {
        const response = await apiRequest<GoogleDriveOAuthStartRecord>(
          "/api/client-accounts/drive/oauth/start",
          { method: "POST", token },
        );
        return response.data!;
      },
      async list(token: string, params?: ClientAccountListParams) {
        const response = await apiRequest<ClientAccountSummaryRecord[]>(
          `/api/client-accounts${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: ClientAccountCreatePayload) {
        const response = await apiRequest<ClientAccountSummaryRecord>(
          "/api/client-accounts",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async createFromContact(token: string, payload: ClientAccountFromContactPayload) {
        const response = await apiRequest<ClientAccountSummaryRecord>(
          "/api/client-accounts/from-contact",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async getProfile(token: string) {
        const response = await apiRequest<ClientAccountProfileRecord>(
          "/api/client-accounts/profile",
          { token },
        );
        return response.data!;
      },
      async updateProfile(token: string, payload: ClientAccountProfilePayload) {
        const response = await apiRequest<ClientAccountProfileRecord>(
          "/api/client-accounts/profile",
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateDriveFolder(
        token: string,
        clinicId: string,
        payload: ClientAccountDriveFolderPayload,
      ) {
        const response = await apiRequest<ClientAccountProfileRecord>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/drive-folder`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async listDriveFolders(token: string, clinicId: string, parentId = "root") {
        const response = await apiRequest<GoogleDriveFolderBrowserRecord>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/drive/folders?${new URLSearchParams({ parentId }).toString()}`,
          { token },
        );
        return response.data!;
      },
      async createDriveFolder(
        token: string,
        clinicId: string,
        payload: GoogleDriveFolderCreatePayload,
      ) {
        const response = await apiRequest<GoogleDriveFolderRecord>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/drive/folders`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async uploadDriveFile(token: string, clinicId: string, parentId: string, file: File) {
        const body = new FormData();
        body.set("parentId", parentId);
        body.set("file", file);
        const response = await apiRequest<GoogleDriveFileRecord>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/drive/files`,
          { method: "POST", token, body },
        );
        return response.data!;
      },
      async renameDriveFile(token: string, clinicId: string, fileId: string, name: string) {
        const response = await apiRequest<GoogleDriveFileRecord>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/drive/files/${encodeURIComponent(fileId)}`,
          { method: "PATCH", token, body: JSON.stringify({ name }) },
        );
        return response.data!;
      },
      async deleteDriveFile(token: string, clinicId: string, fileId: string) {
        await apiRequest<never>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/drive/files/${encodeURIComponent(fileId)}`,
          { method: "DELETE", token },
        );
      },
      async downloadDriveFile(token: string, clinicId: string, fileId: string) {
        const response = await fetch(
          `${publicEnv.apiBaseUrl}/client-accounts/${encodeURIComponent(clinicId)}/drive/files/${encodeURIComponent(fileId)}/download`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error(payload?.message || "The Google Drive file could not be downloaded.");
        }
        const disposition = response.headers.get("content-disposition") || "";
        const encodedName = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        const fileName = encodedName
          ? decodeURIComponent(encodedName)
          : disposition.match(/filename="([^"]+)"/)?.[1] || "download";
        return { blob: await response.blob(), fileName };
      },
      async getLinkedRecords(token: string, clinicId: string) {
        const response = await apiRequest<ClientAccountLinkedRecords>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/linked-records`,
          { token },
        );
        return response.data!;
      },
      async linkContact(token: string, clinicId: string, contactId: string) {
        const response = await apiRequest<ClientAccountLinkedRecords>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/contacts/${encodeURIComponent(contactId)}/link`,
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async unlinkContact(token: string, clinicId: string, contactId: string) {
        const response = await apiRequest<ClientAccountLinkedRecords>(
          `/api/client-accounts/${encodeURIComponent(clinicId)}/contacts/${encodeURIComponent(contactId)}/unlink`,
          {
            method: "POST",
            token,
          },
        );
        return response.data!;
      },
      async listContactLinks(token: string, contactId: string) {
        const response = await apiRequest<ClientAccountContactAccountLinkRecord[]>(
          `/api/client-accounts/contacts/${encodeURIComponent(contactId)}/links`,
          { token },
        );
        return response.data!;
      },
      async listServices(token: string, params?: ClientAccountServiceListParams) {
        const response = await apiRequest<ClientAccountServiceRecord[]>(
          `/api/client-accounts/services${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async createService(token: string, payload: ClientAccountServicePayload) {
        const response = await apiRequest<ClientAccountServiceRecord>(
          "/api/client-accounts/services",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateService(
        token: string,
        serviceId: string,
        payload: ClientAccountServiceUpdatePayload,
      ) {
        const response = await apiRequest<ClientAccountServiceRecord>(
          `/api/client-accounts/services/${serviceId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async archiveService(token: string, serviceId: string) {
        return apiRequest<never>(
          `/api/client-accounts/services/${serviceId}/archive`,
          {
            method: "POST",
            token,
          },
        );
      },
    },
    internalTasks: {
      async list(token: string, params?: InternalTaskListParams) {
        const response = await apiRequest<InternalTaskRecord[]>(
          `/api/tasks/internal${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: InternalTaskPayload) {
        const response = await apiRequest<{ id: string }>("/api/tasks/internal", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        taskId: string,
        payload: InternalTaskUpdatePayload,
      ) {
        return apiRequest<never>(`/api/tasks/internal/${taskId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async updateQa(token: string, taskId: string, payload: InternalTaskQaPayload) {
        return apiRequest<never>(`/api/tasks/internal/${taskId}/qa`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async archive(token: string, taskId: string) {
        return apiRequest<never>(`/api/tasks/internal/${taskId}/archive`, {
          method: "POST",
          token,
        });
      },
    },
    strategyLogs: {
      async list(token: string, params?: StrategyLogListParams) {
        const response = await apiRequest<StrategyLogRecord[]>(
          `/api/strategy-logs${buildQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: StrategyLogPayload) {
        const response = await apiRequest<{ id: string }>("/api/strategy-logs", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        logId: string,
        payload: StrategyLogUpdatePayload,
      ) {
        return apiRequest<never>(`/api/strategy-logs/${logId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async archive(token: string, logId: string) {
        return apiRequest<never>(`/api/strategy-logs/${logId}/archive`, {
          method: "POST",
          token,
        });
      },
    },
  };
}
