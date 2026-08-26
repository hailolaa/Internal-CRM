import { describe, expect, it } from "vitest";
import type { FleetSyncAdministrationResponse } from "@/lib/api-types";
import {
  fleetExceptionTone,
  fleetSyncSlaStatusMeta,
  fleetSyncStatusMeta,
  summarizeFleetSyncAdministration,
} from "./fleet-sync-health";

function response(overrides: Partial<FleetSyncAdministrationResponse> = {}): FleetSyncAdministrationResponse {
  return {
    generatedAt: "2026-08-24T00:00:00.000Z",
    scope: "all_clients",
    health: [
      {
        clinicId: "clinic-1",
        clinicName: "Clinic One",
        tenantId: "tenant-1",
        tenantKey: "clinic-one",
        tenantName: "Clinic One",
        tenantDataState: "live",
        tenantStatus: "active",
        tenantOnboardingStatus: "active",
        sourceId: "source-1",
        sourceSystem: "clinic_os",
        sourceKey: "lead_feed",
        sourceLabel: "Lead feed",
        sourceDataState: "provider_dependent",
        sourceStatus: "active",
        endpointKind: "webhook",
        syncStatus: "retrying",
        checkpoint: null,
        lastIngestedAt: null,
        lastEventAt: null,
        lastProcessedEventAt: null,
        latestSuccessfulSyncAt: null,
        latestFailedSyncAt: "2026-08-24T00:00:00.000Z",
        lastError: "Provider timeout",
        retryingCount: 1,
        deadLetterCount: 0,
        openFreshnessAlerts: 0,
        openReconciliationIssues: 1,
        slaStatus: "at_risk",
        slaTargetMinutes: 60,
        observedLagMinutes: null,
      },
    ],
    exceptions: [
      {
        id: "exception-1",
        clinicId: "clinic-1",
        clinicName: "Clinic One",
        sourceId: "source-1",
        sourceSystem: "clinic_os",
        sourceKey: "lead_feed",
        sourceLabel: "Lead feed",
        dataState: "provider_dependent",
        type: "reconciliation",
        severity: "warning",
        status: "open",
        title: "Reconciliation",
        detail: "lead-001",
        detectedAt: "2026-08-24T00:00:00.000Z",
        action: "resolve",
        availableActions: ["acknowledge", "resolve", "dismiss"],
        correlationId: "lead-001",
      },
    ],
    summary: {
      clients: 1,
      sources: 1,
      healthy: 0,
      atRisk: 1,
      breached: 0,
      exceptions: 1,
    },
    ...overrides,
  };
}

describe("fleet sync health helpers", () => {
  it("summarizes attention state and data-state counts", () => {
    const summary = summarizeFleetSyncAdministration(response());

    expect(summary.overallStatus).toBe("needs_attention");
    expect(summary.stateCounts["provider-dependent"]).toBe(1);
    expect(summary.atRisk).toBe(1);
  });

  it("returns human-safe status and SLA metadata", () => {
    expect(fleetSyncStatusMeta("dead_letter")).toMatchObject({
      label: "Dead letter",
      tone: "danger",
    });
    expect(fleetSyncSlaStatusMeta("breached")).toMatchObject({
      label: "SLA breached",
      tone: "danger",
    });
    expect(fleetSyncStatusMeta("unknown")).toMatchObject({
      label: "No data yet",
      tone: "warning",
    });
    expect(fleetSyncStatusMeta("blocked")).toMatchObject({
      label: "Blocked",
      tone: "danger",
    });
  });

  it("maps exception severities to visible tones", () => {
    expect(fleetExceptionTone("critical")).toBe("danger");
    expect(fleetExceptionTone("warning")).toBe("warning");
    expect(fleetExceptionTone("info")).toBe("neutral");
  });
});
