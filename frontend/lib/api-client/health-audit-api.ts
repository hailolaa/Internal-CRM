import type { AuditLogList, HealthStatus } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createHealthAuditApi(apiRequest: ApiRequest) {
  return {
    health: {
      async live() {
        const response = await apiRequest<HealthStatus>("/api/health/live");
        return response.data!;
      },
      async ready() {
        const response = await apiRequest<HealthStatus>("/api/health/ready");
        return response.data!;
      },
    },
    auditLog: {
      async list(
        token: string,
        params: { page?: number; pageSize?: number; search?: string } = {},
      ) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined && value !== "") query.set(key, String(value));
        });
        const response = await apiRequest<AuditLogList>(
          `/api/audit-log${query.size ? `?${query.toString()}` : ""}`,
          { token },
        );
        return response.data!;
      },
    },
  };
}
