import type {
  ClientAccountListParams,
  ClientAccountCreatePayload,
  ClientAccountDriveFolderPayload,
  ClientAccountFromContactPayload,
  ClientAccountProfilePayload,
  ClientAccountProfileRecord,
  ClientAccountServiceListParams,
  ClientAccountServicePayload,
  ClientAccountServiceRecord,
  ClientAccountServiceUpdatePayload,
  ClientAccountSummaryRecord,
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
