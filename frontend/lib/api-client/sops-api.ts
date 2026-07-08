import type { SopListParams, SopRecord } from "@/lib/api-types";
import type { ApiRequest } from "./core";

type SopPayload = {
  title: string;
  category?: string;
  content?: string | null;
  owner?: string | null;
  status?: "draft" | "published" | "archived";
};

export function createSopsApi(apiRequest: ApiRequest) {
  return {
    sops: {
      async list(token: string, params: SopListParams = {}) {
        const query = new URLSearchParams();
        Object.entries(params).forEach(([key, value]) => {
          if (value) query.set(key, value);
        });
        const suffix = query.toString() ? `?${query.toString()}` : "";
        const response = await apiRequest<SopRecord[]>(`/api/sops${suffix}`, {
          token,
        });
        return response.data!;
      },
      async create(token: string, payload: SopPayload) {
        const response = await apiRequest<{ id: string }>("/api/sops", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, sopId: string, payload: Partial<SopPayload>) {
        return apiRequest<never>(`/api/sops/${sopId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, sopId: string) {
        return apiRequest<never>(`/api/sops/${sopId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
