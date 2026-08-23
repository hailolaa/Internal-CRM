import type {
  FleetCheckpointStatus,
  FleetSyncAdministrationResponse,
  FleetSyncExceptionSeverity,
  FleetSyncSlaStatus,
} from "@/lib/api-types";

export type FleetSyncTone = "success" | "warning" | "danger" | "neutral";

export interface FleetSyncMeta {
  label: string;
  tone: FleetSyncTone;
  description: string;
}

const syncStatusMeta: Record<FleetCheckpointStatus, FleetSyncMeta> = {
  healthy: {
    label: "Healthy",
    tone: "success",
    description: "Events are processing normally.",
  },
  delayed: {
    label: "Delayed",
    tone: "warning",
    description: "Freshness is behind the expected SLA.",
  },
  retrying: {
    label: "Retrying",
    tone: "warning",
    description: "Events are queued for another safe attempt.",
  },
  dead_letter: {
    label: "Dead letter",
    tone: "danger",
    description: "A failed event needs controlled replay.",
  },
  paused: {
    label: "Paused",
    tone: "neutral",
    description: "This source is not actively syncing.",
  },
  reconciliation_needed: {
    label: "Review needed",
    tone: "warning",
    description: "A reconciliation issue needs administrator review.",
  },
};

const slaStatusMeta: Record<FleetSyncSlaStatus, FleetSyncMeta> = {
  met: {
    label: "SLA met",
    tone: "success",
    description: "Latest source activity is within target.",
  },
  at_risk: {
    label: "At risk",
    tone: "warning",
    description: "Retries or reconciliation work may affect the SLA.",
  },
  breached: {
    label: "SLA breached",
    tone: "danger",
    description: "Freshness or dead-letter failures need action.",
  },
  not_applicable: {
    label: "Not applicable",
    tone: "neutral",
    description: "SLA is not active for this source state.",
  },
};

export function fleetSyncStatusMeta(status: FleetCheckpointStatus): FleetSyncMeta {
  return syncStatusMeta[status];
}

export function fleetSyncSlaStatusMeta(status: FleetSyncSlaStatus): FleetSyncMeta {
  return slaStatusMeta[status];
}

export function fleetExceptionTone(severity: FleetSyncExceptionSeverity): FleetSyncTone {
  if (severity === "critical") return "danger";
  if (severity === "warning") return "warning";
  return "neutral";
}

export function summarizeFleetSyncAdministration(data: FleetSyncAdministrationResponse) {
  const hasAttention = data.summary.atRisk > 0 || data.summary.breached > 0 || data.summary.exceptions > 0;
  const stateCounts = data.health.reduce<Record<string, number>>((acc, row) => {
    const key = row.sourceDataState.replace(/_/g, "-");
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  return {
    ...data.summary,
    stateCounts,
    overallStatus: hasAttention ? "needs_attention" : "healthy",
  } as const;
}
