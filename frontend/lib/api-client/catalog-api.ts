import type {
  ApiKeyRecord,
  TreatmentCatalogItem,
  TreatmentCatalogPayload,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createCatalogApi(apiRequest: ApiRequest) {
  return {
    apiKeys: {
      async list(token: string) {
        const response = await apiRequest<ApiKeyRecord[]>(
          "/api/settings/api-keys",
          { token },
        );
        return response.data!;
      },
      async create(token: string, name: string) {
        const response = await apiRequest<ApiKeyRecord>(
          "/api/settings/api-keys",
          {
            method: "POST",
            token,
            body: JSON.stringify({ name }),
          },
        );
        return response.data!;
      },
      async revoke(token: string, apiKeyId: string) {
        return apiRequest<never>(`/api/settings/api-keys/${apiKeyId}`, {
          method: "DELETE",
          token,
        });
      },
    },
    treatments: {
      async list(token: string) {
        const response = await apiRequest<TreatmentCatalogItem[]>(
          "/api/treatments",
          { token },
        );
        return response.data!;
      },
      async create(
        token: string,
        payload: TreatmentCatalogPayload,
      ) {
        const response = await apiRequest<{ id: string }>("/api/treatments", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        treatmentId: string,
        payload: Partial<TreatmentCatalogPayload>,
      ) {
        return apiRequest<never>(`/api/treatments/${treatmentId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, treatmentId: string) {
        return apiRequest<never>(`/api/treatments/${treatmentId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
