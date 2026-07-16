import type { GrowthPackagePayload, GrowthPackageRecord } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createPackagesApi(apiRequest: ApiRequest) {
  return {
    packages: {
      async list(token: string, params: { includeInactive?: boolean } = {}) {
        const searchParams = new URLSearchParams();
        if (params.includeInactive) searchParams.set("includeInactive", "true");
        const query = searchParams.toString();
        const response = await apiRequest<GrowthPackageRecord[]>(
          `/api/packages${query ? `?${query}` : ""}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: GrowthPackagePayload) {
        const response = await apiRequest<GrowthPackageRecord>("/api/packages", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, packageId: string, payload: GrowthPackagePayload) {
        const response = await apiRequest<GrowthPackageRecord>(`/api/packages/${packageId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async remove(token: string, packageId: string) {
        return apiRequest<never>(`/api/packages/${packageId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
