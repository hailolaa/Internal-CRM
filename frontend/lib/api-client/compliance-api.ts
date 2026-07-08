import type {
  ComplianceDocumentFileRecord,
  ComplianceDocumentRecord,
  ComplianceSettingsRecord,
  DataAccessRequestRecord,
  DataAccessRequestStatus,
  DataAccessRequestType,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createComplianceApi(apiRequest: ApiRequest) {
  return {
    compliance: {
      async listDocuments(token: string) {
        const response = await apiRequest<ComplianceDocumentRecord[]>(
          "/api/compliance/documents",
          { token },
        );
        return response.data!;
      },
      async createDocument(
        token: string,
        payload: {
          title: string;
          status?: ComplianceDocumentRecord["status"];
          category?: ComplianceDocumentRecord["category"];
          dueDate?: string | null;
        },
      ) {
        const response = await apiRequest<{ id: string }>(
          "/api/compliance/documents",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateDocument(
        token: string,
        documentId: string,
        payload: Partial<ComplianceDocumentRecord>,
      ) {
        return apiRequest<never>(`/api/compliance/documents/${documentId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async removeDocument(token: string, documentId: string) {
        return apiRequest<never>(`/api/compliance/documents/${documentId}`, {
          method: "DELETE",
          token,
        });
      },
      async uploadDocumentFile(
        token: string,
        documentId: string,
        payload: {
          fileName: string;
          mimeType: string;
          sizeBytes: number;
          dataUrl: string;
        },
      ) {
        const response = await apiRequest<ComplianceDocumentFileRecord>(
          `/api/compliance/documents/${documentId}/file`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async getDocumentFile(token: string, documentId: string) {
        const response = await apiRequest<ComplianceDocumentFileRecord>(
          `/api/compliance/documents/${documentId}/file`,
          { token },
        );
        return response.data!;
      },
      async deleteDocumentFile(token: string, documentId: string) {
        return apiRequest<never>(`/api/compliance/documents/${documentId}/file`, {
          method: "DELETE",
          token,
        });
      },
      async getSettings(token: string) {
        const response = await apiRequest<ComplianceSettingsRecord>(
          "/api/compliance/settings",
          { token },
        );
        return response.data!;
      },
      async updateSettings(
        token: string,
        payload: Partial<ComplianceSettingsRecord>,
      ) {
        const response = await apiRequest<ComplianceSettingsRecord>(
          "/api/compliance/settings",
          {
            method: "PUT",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async listDataAccessRequests(token: string) {
        const response = await apiRequest<DataAccessRequestRecord[]>(
          "/api/compliance/data-access-requests",
          { token },
        );
        return response.data!;
      },
      async createDataAccessRequest(
        token: string,
        payload: {
          requesterName: string;
          requesterEmail?: string | null;
          requesterPhone?: string | null;
          requestType: DataAccessRequestType;
          dueDate?: string | null;
          notes?: string | null;
        },
      ) {
        const response = await apiRequest<DataAccessRequestRecord>(
          "/api/compliance/data-access-requests",
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async updateDataAccessRequest(
        token: string,
        requestId: string,
        payload: {
          status?: DataAccessRequestStatus;
          dueDate?: string | null;
          notes?: string | null;
        },
      ) {
        const response = await apiRequest<DataAccessRequestRecord>(
          `/api/compliance/data-access-requests/${requestId}`,
          {
            method: "PATCH",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async archiveDataAccessRequest(token: string, requestId: string) {
        return apiRequest<never>(
          `/api/compliance/data-access-requests/${requestId}`,
          {
            method: "DELETE",
            token,
          },
        );
      },
    },
  };
}
