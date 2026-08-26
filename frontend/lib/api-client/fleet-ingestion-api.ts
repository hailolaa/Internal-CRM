import type { FleetQueuedEvent, FleetSyncAdministrationResponse, FleetSyncException } from "@/lib/api-types";
import type { ApiRequest } from "./core";

export function createFleetIngestionApi(apiRequest: ApiRequest) {
  return {
    fleetIngestion: {
      async getSyncHealth(token: string) {
        const response = await apiRequest<FleetSyncAdministrationResponse>("/api/fleet-ingestion/sync-health", { token });
        return response.data!;
      },
      async replayDeadLetterEvent(token: string, eventId: string) {
        const response = await apiRequest<FleetQueuedEvent>(`/api/fleet-ingestion/sync-health/dead-letter/${encodeURIComponent(eventId)}/replay`, {
          method: "POST",
          token,
          body: JSON.stringify({ reason: "Replayed from sync health administration." }),
        });
        return response.data!;
      },
      async administerException(token: string, type: FleetSyncException["type"], exceptionId: string, action: "acknowledge" | "resolve" | "dismiss", reason: string) {
        const response = await apiRequest<{ id: string; type: string; status: "acknowledged" | "resolved" | "dismissed" }>(
          `/api/fleet-ingestion/sync-health/exceptions/${encodeURIComponent(type)}/${encodeURIComponent(exceptionId)}/${action}`,
          {
            method: "POST",
            token,
            body: JSON.stringify({ reason }),
          },
        );
        return response.data!;
      },
      async resolveException(token: string, type: FleetSyncException["type"], exceptionId: string) {
        const response = await apiRequest<{ id: string; type: string; status: "acknowledged" | "resolved" | "dismissed" }>(
          `/api/fleet-ingestion/sync-health/exceptions/${encodeURIComponent(type)}/${encodeURIComponent(exceptionId)}/resolve`,
          {
            method: "POST",
            token,
            body: JSON.stringify({ reason: "Resolved from sync health administration." }),
          },
        );
        return response.data!;
      },
    },
  };
}
