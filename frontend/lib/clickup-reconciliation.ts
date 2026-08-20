import type {
  ClickUpReconciliationResponse,
  ClickUpSyncHealthStatus,
  ClickUpWebhookProcessingStatus,
} from "@/lib/api-types";

export type ClickUpStatusTone = "success" | "warning" | "danger" | "neutral";

export interface ClickUpStatusMeta {
  label: string;
  tone: ClickUpStatusTone;
  description: string;
}

const syncStatusMeta: Record<ClickUpSyncHealthStatus, ClickUpStatusMeta> = {
  healthy: {
    label: "Healthy",
    tone: "success",
    description: "Events and reconciliation are processing normally.",
  },
  delayed: {
    label: "Delayed",
    tone: "warning",
    description: "Recent sync activity is behind and should be checked.",
  },
  retrying: {
    label: "Retrying",
    tone: "warning",
    description: "Provider or network failures are being retried safely.",
  },
  dead_letter: {
    label: "Dead letter",
    tone: "danger",
    description: "One or more events need controlled replay or review.",
  },
  disconnected: {
    label: "Reconnect required",
    tone: "danger",
    description: "The ClickUp connection is unavailable for this mapping.",
  },
  reconciliation_needed: {
    label: "Review needed",
    tone: "warning",
    description: "A provider state changed and needs human confirmation.",
  },
};

const eventStatusMeta: Record<ClickUpWebhookProcessingStatus, ClickUpStatusMeta> = {
  queued: {
    label: "Queued",
    tone: "neutral",
    description: "The event is waiting for processing.",
  },
  processing: {
    label: "Processing",
    tone: "neutral",
    description: "The event is currently being processed.",
  },
  processed: {
    label: "Processed",
    tone: "success",
    description: "The event was applied successfully.",
  },
  duplicate: {
    label: "Duplicate",
    tone: "neutral",
    description: "A repeated provider event was ignored safely.",
  },
  stale: {
    label: "Stale",
    tone: "neutral",
    description: "An older event was kept from overwriting newer state.",
  },
  quarantined: {
    label: "Quarantined",
    tone: "warning",
    description: "The event could not be mapped safely.",
  },
  retrying: {
    label: "Retrying",
    tone: "warning",
    description: "The event is scheduled for another safe attempt.",
  },
  dead_letter: {
    label: "Dead letter",
    tone: "danger",
    description: "Retries are exhausted and manual replay is required.",
  },
  failed: {
    label: "Failed",
    tone: "danger",
    description: "The event failed and needs review.",
  },
  ignored: {
    label: "Ignored",
    tone: "neutral",
    description: "The event type is outside the approved sync lifecycle.",
  },
};

export function clickUpSyncStatusMeta(status: ClickUpSyncHealthStatus): ClickUpStatusMeta {
  return syncStatusMeta[status];
}

export function clickUpEventStatusMeta(status: ClickUpWebhookProcessingStatus): ClickUpStatusMeta {
  return eventStatusMeta[status];
}

export function summarizeClickUpReconciliation(data: ClickUpReconciliationResponse) {
  const counts = {
    clients: data.syncHealth.length,
    healthy: 0,
    retrying: 0,
    disconnected: 0,
    reviewNeeded: data.failedTaskMappings.length,
    deadLetter: data.deadLetterEvents.length,
  };

  for (const row of data.syncHealth) {
    if (row.syncStatus === "healthy") counts.healthy += 1;
    if (row.syncStatus === "retrying" || row.retryingCount > 0) counts.retrying += 1;
    if (row.syncStatus === "disconnected") counts.disconnected += 1;
    if (row.syncStatus === "dead_letter") counts.deadLetter += row.deadLetterCount;
    if (row.syncStatus === "reconciliation_needed") counts.reviewNeeded += 1;
  }

  const hasAttention =
    counts.retrying > 0 ||
    counts.disconnected > 0 ||
    counts.reviewNeeded > 0 ||
    counts.deadLetter > 0 ||
    data.syncHealth.some((row) => row.syncStatus === "delayed");

  return {
    ...counts,
    overallStatus: hasAttention ? "needs_attention" : "healthy",
  } as const;
}
