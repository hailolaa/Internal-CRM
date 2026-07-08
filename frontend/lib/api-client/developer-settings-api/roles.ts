import type { PermissionRecord, RoleRecord } from "@/lib/api-types";
import type { ApiRequest } from "../core";

export function createRolesApi(apiRequest: ApiRequest) {
  return {
    async list(token: string) {
      const response = await apiRequest<RoleRecord[]>("/api/roles", {
        token,
      });
      return response.data!;
    },
    async permissions(token: string) {
      const response = await apiRequest<PermissionRecord[]>(
        "/api/roles/permissions",
        { token },
      );
      return response.data!;
    },
    async create(
      token: string,
      payload: {
        name?: string | null;
        displayName: string;
        description?: string | null;
        permissions: string[];
      },
    ) {
      const response = await apiRequest<RoleRecord>("/api/roles", {
        method: "POST",
        token,
        body: JSON.stringify(payload),
      });
      return response.data!;
    },
    async update(
      token: string,
      roleId: string,
      payload: {
        displayName?: string;
        description?: string | null;
        permissions?: string[];
      },
    ) {
      const response = await apiRequest<RoleRecord>(`/api/roles/${roleId}`, {
        method: "PATCH",
        token,
        body: JSON.stringify(payload),
      });
      return response.data!;
    },
    async archive(token: string, roleId: string) {
      return apiRequest<never>(`/api/roles/${roleId}`, {
        method: "DELETE",
        token,
      });
    },
  };
}
