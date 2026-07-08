import type { SequenceEnrollmentRecord, SequenceRecord } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createSequencesApi(apiRequest: ApiRequest) {
  return {
    sequences: {
      async list(token: string) {
        const response = await apiRequest<SequenceRecord[]>("/api/sequences", {
          token,
        });
        return response.data!;
      },
      async create(
        token: string,
        payload: {
          name: string;
          triggerLabel: string;
          steps?: unknown[];
          status?: "active" | "paused" | "draft" | "archived";
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/sequences", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        sequenceId: string,
        payload: Partial<{
          name: string;
          triggerLabel: string;
          steps: unknown[];
          status: "active" | "paused" | "draft" | "archived";
          enrolledCount: number;
          completedCount: number;
        }>,
      ) {
        return apiRequest<never>(`/api/sequences/${sequenceId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async listEnrollments(token: string, sequenceId: string) {
        const response = await apiRequest<SequenceEnrollmentRecord[]>(
          `/api/sequences/${sequenceId}/enrollments`,
          { token },
        );
        return response.data!;
      },
      async enroll(token: string, sequenceId: string, contactId: string) {
        const response = await apiRequest<SequenceEnrollmentRecord>(
          `/api/sequences/${sequenceId}/enrollments`,
          {
            method: "POST",
            token,
            body: JSON.stringify({ contactId }),
          },
        );
        return response.data!;
      },
      async unenroll(token: string, sequenceId: string, enrollmentId: string) {
        const response = await apiRequest<SequenceEnrollmentRecord>(
          `/api/sequences/${sequenceId}/enrollments/${enrollmentId}`,
          {
            method: "DELETE",
            token,
          },
        );
        return response.data!;
      },
      async runDue(token: string) {
        const response = await apiRequest<{
          processed: number;
          sent: number;
          skipped: number;
          failed: number;
        }>("/api/sequences/run-due", {
          method: "POST",
          token,
        });
        return response.data!;
      },
      async remove(token: string, sequenceId: string) {
        return apiRequest<never>(`/api/sequences/${sequenceId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
