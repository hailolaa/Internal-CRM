import { describe, expect, it } from "vitest";
import {
  clickUpEventStatusMeta,
  clickUpSyncStatusMeta,
  summarizeClickUpReconciliation,
} from "./clickup-reconciliation";
import type { ClickUpReconciliationResponse } from "./api-types";

const baseResponse: ClickUpReconciliationResponse = {
  syncHealth: [],
  failedTaskMappings: [],
  deadLetterEvents: [],
};

describe("clickUp reconciliation helpers", () => {
  it("exposes clear sync status labels for the reconciliation UI", () => {
    expect(clickUpSyncStatusMeta("healthy")).toMatchObject({
      label: "Healthy",
      tone: "success",
    });
    expect(clickUpSyncStatusMeta("dead_letter")).toMatchObject({
      label: "Dead letter",
      tone: "danger",
    });
    expect(clickUpSyncStatusMeta("disconnected").label).toBe("Reconnect required");
  });

  it("exposes safe event status labels without raw provider payloads", () => {
    expect(clickUpEventStatusMeta("quarantined")).toMatchObject({
      label: "Quarantined",
      tone: "warning",
    });
    expect(clickUpEventStatusMeta("stale").description).toContain("older event");
  });

  it("summarizes healthy sync state", () => {
    expect(
      summarizeClickUpReconciliation({
        ...baseResponse,
        syncHealth: [
          {
            id: "health-1",
            clientAccountProfileId: "client-1",
            clientClinicId: "clinic-1",
            clientName: "Client One",
            workspaceId: "workspace-1",
            clickupListId: "list-1",
            syncStatus: "healthy",
            lastEventAt: null,
            lastProcessedEventAt: null,
            lastReconciledAt: null,
            lastError: null,
            retryingCount: 0,
            deadLetterCount: 0,
            updatedAt: "2026-08-20T10:00:00.000Z",
          },
        ],
      }).overallStatus,
    ).toBe("healthy");
  });

  it("summarizes retry, review and dead-letter attention", () => {
    const summary = summarizeClickUpReconciliation({
      ...baseResponse,
      syncHealth: [
        {
          id: "health-1",
          clientAccountProfileId: "client-1",
          clientClinicId: "clinic-1",
          clientName: "Client One",
          workspaceId: "workspace-1",
          clickupListId: "list-1",
          syncStatus: "retrying",
          lastEventAt: "2026-08-20T10:00:00.000Z",
          lastProcessedEventAt: null,
          lastReconciledAt: null,
          lastError: "Provider retry scheduled.",
          retryingCount: 1,
          deadLetterCount: 0,
          updatedAt: "2026-08-20T10:02:00.000Z",
        },
        {
          id: "health-2",
          clientAccountProfileId: "client-2",
          clientClinicId: "clinic-2",
          clientName: "Client Two",
          workspaceId: "workspace-1",
          clickupListId: "list-2",
          syncStatus: "dead_letter",
          lastEventAt: null,
          lastProcessedEventAt: null,
          lastReconciledAt: null,
          lastError: "Retries exhausted.",
          retryingCount: 0,
          deadLetterCount: 2,
          updatedAt: "2026-08-20T10:03:00.000Z",
        },
      ],
      failedTaskMappings: [
        {
          id: "mapping-1",
          internalTaskId: "task-1",
          internalTaskTitle: "Review task",
          clientAccountProfileId: "client-2",
          clientClinicId: "clinic-2",
          clientName: "Client Two",
          clickupListId: "list-2",
          updatedAt: "2026-08-20T10:04:00.000Z",
        },
      ],
      deadLetterEvents: [
        {
          id: "event-1",
          providerEventKey: "redacted-provider-event-key",
          providerEventType: "taskUpdated",
          clickupTaskId: null,
          clientAccountProfileId: "client-2",
          clientName: "Client Two",
          processingStatus: "dead_letter",
          retryCount: 5,
          nextRetryAt: null,
          errorClass: "provider_retry_exhausted",
          errorMessage: "Retries exhausted.",
          receivedAt: "2026-08-20T10:05:00.000Z",
          processedAt: null,
        },
      ],
    });

    expect(summary).toMatchObject({
      overallStatus: "needs_attention",
      retrying: 1,
      reviewNeeded: 1,
      deadLetter: 3,
    });
  });
});
