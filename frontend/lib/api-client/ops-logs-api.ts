import type { ManualConsultRecord, ManualSpendRecord } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createOpsLogsApi(apiRequest: ApiRequest) {
  return {
    opsLogs: {
      async listSpend(token: string) {
        const response = await apiRequest<ManualSpendRecord[]>(
          "/api/ops-logs/spend",
          { token },
        );
        return response.data!;
      },
      async createSpend(
        token: string,
        payload: {
          source: string;
          channel?: string;
          campaign: string;
          amount: number;
          period: string;
          startDate?: string;
          endDate?: string;
          attributionLabel?: string;
          notes?: string;
        },
      ) {
        const response = await apiRequest<{ id: string }>(
          "/api/ops-logs/spend",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateSpend(
        token: string,
        entryId: string,
        payload: Partial<{
          source: string;
          channel: string;
          campaign: string;
          amount: number;
          period: string;
          startDate: string;
          endDate: string;
          attributionLabel: string;
          notes: string;
        }>,
      ) {
        const response = await apiRequest<ManualSpendRecord[]>(
          `/api/ad-spend/${entryId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async removeSpend(token: string, entryId: string) {
        return apiRequest<never>(`/api/ops-logs/spend/${entryId}`, {
          method: "DELETE",
          token,
        });
      },
      async listConsults(token: string) {
        const response = await apiRequest<ManualConsultRecord[]>(
          "/api/ops-logs/consults",
          { token },
        );
        return response.data!;
      },
      async createConsult(
        token: string,
        payload: {
          patientName: string;
          treatment: string;
          practitioner: string;
          outcome: string;
          revenue?: number;
          date?: string;
          notes?: string;
        },
      ) {
        const response = await apiRequest<{ id: string }>(
          "/api/ops-logs/consults",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async removeConsult(token: string, entryId: string) {
        return apiRequest<never>(`/api/ops-logs/consults/${entryId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
