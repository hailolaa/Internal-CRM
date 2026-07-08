import type {
  FormDefinitionRecord,
  FormSubmissionRecord,
} from "@/lib/api-types";
import { publicEnv } from "@/lib/env";
import type { ApiRequest } from "./core";

export function createFormsApi(apiRequest: ApiRequest) {
  return {
    forms: {
      async getPublic(formId: string) {
        const response = await fetch(`${publicEnv.apiBaseUrl}/public/forms/${formId}`, {
          cache: "no-store",
          headers: {
            Accept: "application/json",
          },
        });
        const text = await response.text();
        const parsed = text
          ? (JSON.parse(text) as {
              data?: FormDefinitionRecord;
              message?: string;
            })
          : {};

        if (!response.ok) {
          throw new Error(
            parsed.message || `Public form load failed with ${response.status}`,
          );
        }

        return parsed.data!;
      },
      async list(token: string) {
        const response = await apiRequest<FormDefinitionRecord[]>("/api/forms", {
          token,
        });
        return response.data!;
      },
      async listSubmissions(token: string) {
        const response = await apiRequest<FormSubmissionRecord[]>(
          "/api/forms/submissions",
          { token },
        );
        return response.data!;
      },
      async addSubmissionToPipeline(
        token: string,
        submissionId: string,
        payload: Partial<{
          stageId: string | null;
          title: string | null;
          valueCents: number | null;
          source: string | null;
          treatment: string | null;
          probability: number | null;
          expectedCloseDate: string | null;
        }> = {},
      ) {
        const response = await apiRequest<{
          submissionId: string;
          contactId: string;
          pipelineDealId: string;
        }>(`/api/forms/submissions/${submissionId}/pipeline`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async archiveSubmission(token: string, submissionId: string) {
        return apiRequest<never>(`/api/forms/submissions/${submissionId}`, {
          method: "DELETE",
          token,
        });
      },
      async create(
        token: string,
        payload: {
          name: string;
          type?: string;
          status?: "active" | "draft" | "archived";
          fields?: unknown[];
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/forms", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        formId: string,
        payload: Partial<{
          name: string;
          type: string;
          status: "active" | "draft" | "archived";
          fields: unknown[];
        }>,
      ) {
        return apiRequest<never>(`/api/forms/${formId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, formId: string) {
        return apiRequest<never>(`/api/forms/${formId}`, {
          method: "DELETE",
          token,
        });
      },
      async submitPublic(
        formId: string,
        payload: Record<string, unknown>,
        apiKey?: string,
      ) {
        const response = await fetch(
          `${publicEnv.apiBaseUrl}/public/forms/${formId}/submit`,
          {
            method: "POST",
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              ...(apiKey ? { "x-api-key": apiKey } : {}),
            },
            body: JSON.stringify(payload),
          },
        );
        const text = await response.text();
        const parsed = text
          ? (JSON.parse(text) as {
              data?: { id: string; contactId: string };
              message?: string;
            })
          : {};

        if (!response.ok) {
          throw new Error(parsed.message || `Public form submit failed with ${response.status}`);
        }

        return parsed.data!;
      },
    },
  };
}
