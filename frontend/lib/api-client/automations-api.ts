import type { AutomationRecord } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createAutomationsApi(apiRequest: ApiRequest) {
  return {
    automations: {
      async list(token: string) {
        const response = await apiRequest<AutomationRecord[]>(
          "/api/automations",
          { token },
        );
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          name: string;
          description?: string;
          triggerType?: string;
          actions?: unknown[];
          isEnabled?: boolean;
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/automations", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        automationId: string,
        payload: Partial<{
          isEnabled: boolean;
          name: string;
          description: string;
          triggerType: string;
          actions: unknown[];
        }>,
      ) {
        return apiRequest<never>(`/api/automations/${automationId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, automationId: string) {
        return apiRequest<never>(`/api/automations/${automationId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
