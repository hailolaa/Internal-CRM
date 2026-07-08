import type {
  ConnectorSetupPayload,
  ConnectorAccountChoiceRecord,
  ConnectorDefinitionRecord,
  ConnectorOAuthStartRecord,
  ConnectorStatusRecord,
  ConnectorSyncPayload,
  CreateLocationPayload,
  Integration,
  Location,
  MarketingConnectorType,
  UpdateLocationPayload,
} from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createLocationsIntegrationsApi(apiRequest: ApiRequest) {
  return {
    locations: {
      async list(token: string) {
        const response = await apiRequest<Location[]>("/api/locations", {
          token,
        });
        return response.data!;
      },
      async create(token: string, payload: CreateLocationPayload) {
        const response = await apiRequest<{ id: string }>("/api/locations", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        locationId: string,
        payload: UpdateLocationPayload,
      ) {
        return apiRequest<never>(`/api/locations/${locationId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
      async remove(token: string, locationId: string) {
        return apiRequest<never>(`/api/locations/${locationId}`, {
          method: "DELETE",
          token,
        });
      },
    },
    integrations: {
      async list(token: string) {
        const response = await apiRequest<Integration[]>("/api/integrations", {
          token,
        });
        return response.data!;
      },
      async listConnectorStatuses(token: string) {
        const response = await apiRequest<ConnectorStatusRecord[]>(
          "/api/integrations/connectors/status",
          { token },
        );
        return response.data!;
      },
      async listConnectorDefinitions(token: string) {
        const response = await apiRequest<ConnectorDefinitionRecord[]>(
          "/api/integrations/connectors/definitions",
          { token },
        );
        return response.data!;
      },
      async startConnectorOAuth(
        token: string,
        type: MarketingConnectorType,
        payload: { config?: Record<string, unknown> },
      ) {
        const response = await apiRequest<ConnectorOAuthStartRecord>(
          `/api/integrations/connectors/${type}/oauth/start`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async listConnectorAccounts(token: string, type: MarketingConnectorType) {
        const response = await apiRequest<ConnectorAccountChoiceRecord[]>(
          `/api/integrations/connectors/${type}/accounts`,
          { token },
        );
        return response.data!;
      },
      async selectConnectorAccount(
        token: string,
        type: MarketingConnectorType,
        payload: { selectionId: string },
      ) {
        const response = await apiRequest<ConnectorStatusRecord>(
          `/api/integrations/connectors/${type}/accounts/select`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async completeConnectorOAuth(
        token: string,
        type: MarketingConnectorType,
        payload: { code: string; state: string },
      ) {
        const response = await apiRequest<ConnectorStatusRecord>(
          `/api/integrations/connectors/${type}/oauth/callback`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async setupConnector(
        token: string,
        type: MarketingConnectorType,
        payload: ConnectorSetupPayload,
      ) {
        const response = await apiRequest<ConnectorStatusRecord>(
          `/api/integrations/connectors/${type}/setup`,
          {
            method: "POST",
            token,
            body: JSON.stringify(payload),
          },
        );
        return response.data!;
      },
      async syncConnector(
        token: string,
        type: MarketingConnectorType,
        payload: ConnectorSyncPayload,
      ) {
        const response = await apiRequest<{
          integrationId: string;
          importedRows: number;
          spendRowsCreated: number;
          status: ConnectorStatusRecord;
        }>(`/api/integrations/connectors/${type}/sync`, {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async connect(
        token: string,
        payload: {
          name: string;
          type: string;
          config?: Record<string, unknown>;
        },
      ) {
        const response = await apiRequest<{ id: string }>("/api/integrations", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
        return response.data!;
      },
      async update(
        token: string,
        integrationId: string,
        payload: { isActive?: boolean; config?: Record<string, unknown> },
      ) {
        return apiRequest<never>(`/api/integrations/${integrationId}`, {
          method: "PATCH",
          token,
          body: JSON.stringify(payload),
        });
      },
    },
  };
}
