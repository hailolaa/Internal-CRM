import type {
  ContactCreatePayload,
  ContactDuplicateCandidate,
  ContactImportBatch,
  ContactImportResult,
  ContactImportRow,
  ContactLinkedActivity,
  ContactListParams,
  ContactListResult,
  ContactMarkContactedResult,
  ContactMutationResult,
  ContactRecord,
  ContactTimelineActivity,
  ContactUpdatePayload,
  TaskRecord,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

function buildContactsQuery(params: ContactListParams = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "" || value === "all") {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function createContactsApi(apiRequest: ApiRequest) {
  return {
    contacts: {
      async list(token: string, params?: ContactListParams) {
        const response = await apiRequest<ContactListResult>(
          `/api/contacts${buildContactsQuery(params)}`,
          { token },
        );
        return response.data!;
      },
      async create(token: string, payload: ContactCreatePayload) {
        const response = await apiRequest<ContactMutationResult>(
          "/api/contacts",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async get(token: string, contactId: string) {
        const response = await apiRequest<ContactRecord>(
          `/api/contacts/${contactId}`,
          { token },
        );
        return response.data!;
      },
      async getTimeline(token: string, contactId: string) {
        const response = await apiRequest<ContactTimelineActivity[]>(
          `/api/contacts/${contactId}/timeline`,
          { token },
        );
        return response.data!;
      },
      async getActivity(token: string, contactId: string) {
        const response = await apiRequest<ContactLinkedActivity>(
          `/api/contacts/${contactId}/activity`,
          { token },
        );
        return response.data!;
      },
      async update(
        token: string,
        contactId: string,
        payload: ContactUpdatePayload,
      ) {
        const response = await apiRequest<ContactRecord>(
          `/api/contacts/${contactId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async remove(token: string, contactId: string) {
        return apiRequest<never>(`/api/contacts/${contactId}`, {
          method: "DELETE",
          token,
        });
      },
      async importContacts(
        token: string,
        payload: {
          filename?: string;
          mode?: "create_only" | "upsert";
          rows?: ContactImportRow[];
          sourceUrl?: string;
        },
      ) {
        const response = await apiRequest<ContactImportResult>(
          "/api/contacts/import",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async previewImportSource(token: string, sourceUrl: string) {
        const response = await apiRequest<{
          filename: string;
          rows: ContactImportRow[];
        }>("/api/contacts/import/preview", {
          method: "POST",
          token,
          body: JSON.stringify({ sourceUrl }),
        });
        return response.data!;
      },
      async getImportBatches(token: string) {
        const response = await apiRequest<ContactImportBatch[]>(
          "/api/contacts/imports",
          { token },
        );
        return response.data!;
      },
      async getDuplicateCandidates(token: string) {
        const response = await apiRequest<ContactDuplicateCandidate[]>(
          "/api/contacts/duplicates",
          { token },
        );
        return response.data!;
      },
      async resolveDuplicate(
        token: string,
        candidateId: string,
        status: "confirmed_duplicate" | "not_duplicate" | "merged" | "ignored",
      ) {
        return apiRequest<never>(`/api/contacts/duplicates/${candidateId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify({ status }),
        });
      },
      async markContacted(token: string, contactId: string) {
        const response = await apiRequest<ContactMarkContactedResult>(
          `/api/contacts/${contactId}/mark-contacted`,
          {
            method: "PATCH",
            token,
          },
        );
        return response.data!;
      },
    },
    tasks: {
      async list(token: string) {
        const response = await apiRequest<TaskRecord[]>("/api/tasks", {
          token,
        });
        return response.data!;
      },
      async create(token: string, payload: Partial<TaskRecord> & { title: string }) {
        const response = await apiRequest<{ id: string }>("/api/tasks", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(token: string, taskId: string, payload: Partial<TaskRecord>) {
        return apiRequest<never>(`/api/tasks/${taskId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, taskId: string) {
        return apiRequest<never>(`/api/tasks/${taskId}`, {
          method: "DELETE",
          token,
        });
      },
    },
  };
}
