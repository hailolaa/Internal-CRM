import type {
  QuickBooksClientCustomerMappingPayload,
  QuickBooksClientCustomerMappingRecord,
  QuickBooksConnectionStatus,
  QuickBooksCustomerRecord,
  QuickBooksOAuthStartRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildQuery(params: object = {}) {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    searchParams.set(key, String(value));
  });
  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function createQuickBooksApi(apiRequest: ApiRequest) {
  return {
    quickbooks: {
      async getStatus(token: string) {
        const response = await apiRequest<QuickBooksConnectionStatus>("/api/quickbooks/status", { token });
        return response.data!;
      },
      async startOAuth(token: string) {
        const response = await apiRequest<QuickBooksOAuthStartRecord>("/api/quickbooks/oauth/start", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async revoke(token: string) {
        const response = await apiRequest<QuickBooksConnectionStatus>("/api/quickbooks/revoke", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async listCustomers(token: string, search?: string) {
        const response = await apiRequest<QuickBooksCustomerRecord[]>(
          `/api/quickbooks/customers${buildQuery({ search })}`,
          { token },
        );
        return response.data!;
      },
      async getClientMapping(token: string, clientAccountProfileId: string) {
        const response = await apiRequest<QuickBooksClientCustomerMappingRecord | null>(
          `/api/quickbooks/client-mappings/${encodeURIComponent(clientAccountProfileId)}`,
          { token },
        );
        return response.data ?? null;
      },
      async saveClientMapping(
        token: string,
        clientAccountProfileId: string,
        payload: QuickBooksClientCustomerMappingPayload,
      ) {
        const response = await apiRequest<QuickBooksClientCustomerMappingRecord>(
          `/api/quickbooks/client-mappings/${encodeURIComponent(clientAccountProfileId)}`,
          {
            method: "PUT",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async deleteClientMapping(token: string, clientAccountProfileId: string) {
        return apiRequest<null>(
          `/api/quickbooks/client-mappings/${encodeURIComponent(clientAccountProfileId)}`,
          {
            method: "DELETE",
            token,
          },
        );
      },
    },
  };
}
