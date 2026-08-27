import {
  runDailySlaReport,
  runClickUpLifecycleSync,
  runClickUpDeliveryProvisions,
  runObservabilityFailureProbe,
  runRecurringTasksGeneration,
  runQuickBooksCommercialDrafts,
  runSequenceExecution,
  runSlaBreachCheck,
} from "./background-jobs.tasks.js";
import { config } from "../../config/index.js";
import type { BackgroundJobDefinition } from "./background-jobs.types.js";

const minuteMs = 60 * 1000;

function nextIntervalRun(intervalMs: number) {
  return (from: Date) => new Date(from.getTime() + intervalMs);
}

function nextDailyRun(hour: number, minute: number) {
  return (from: Date) => {
    const nextRun = new Date(from);
    nextRun.setHours(hour, minute, 0, 0);

    if (nextRun <= from) {
      nextRun.setDate(nextRun.getDate() + 1);
    }

    return nextRun;
  };
}

export const backgroundJobDefinitions: BackgroundJobDefinition[] = [
  {
    id: "sla-breach-check",
    name: "SLA Breach Check",
    description: "Checks new leads that have not received a first response inside the SLA target.",
    schedule: "Every 5 minutes",
    category: "SLA",
    getNextRunAt: nextIntervalRun(5 * minuteMs),
    handler: runSlaBreachCheck,
  },
  {
    id: "daily-sla-report",
    name: "Daily SLA And Revenue Rollup",
    description: "Prepares daily SLA, no-show, consult, and revenue counters for reporting jobs.",
    schedule: "Daily 07:00",
    category: "Reports",
    getNextRunAt: nextDailyRun(7, 0),
    handler: runDailySlaReport,
  },
  {
    id: "recurring-tasks-generation",
    name: "Recurring Tasks Generation",
    description: "Generates the next occurrence of monthly and weekly recurring internal tasks.",
    schedule: "Daily 01:00",
    category: "Tasks",
    getNextRunAt: nextDailyRun(1, 0),
    handler: runRecurringTasksGeneration,
  },
  {
    id: "sequence-execution",
    name: "Sequence Execution",
    description: "Runs due email and SMS steps for active communication sequence enrollments.",
    schedule: "Every 5 minutes",
    category: "Communications",
    getNextRunAt: nextIntervalRun(5 * minuteMs),
    handler: runSequenceExecution,
  },
  {
    id: "quickbooks-commercial-drafts",
    name: "QuickBooks Commercial Drafts",
    description: "Creates idempotent QuickBooks customers and draft invoices from accepted proposals with bounded retries.",
    schedule: "Every 5 minutes",
    category: "Integrations",
    getNextRunAt: nextIntervalRun(5 * minuteMs),
    handler: runQuickBooksCommercialDrafts,
  },
  {
    id: "clickup-delivery-provisions",
    name: "ClickUp Delivery Provisions",
    description: "Creates checkpointed ClickUp folders, lists, and linked delivery tasks from accepted proposals.",
    schedule: "Every 5 minutes",
    category: "Integrations",
    getNextRunAt: nextIntervalRun(5 * minuteMs),
    handler: runClickUpDeliveryProvisions,
  },
  {
    id: "clickup-lifecycle-sync",
    name: "ClickUp Lifecycle Sync",
    description: "Processes ClickUp task lifecycle webhooks and reconciles known mapped tasks without whole-workspace polling.",
    schedule: "Every 5 minutes",
    category: "Integrations",
    getNextRunAt: nextIntervalRun(5 * minuteMs),
    handler: runClickUpLifecycleSync,
  },
];

if (config.observability.testEnabled) {
  backgroundJobDefinitions.push({
    id: "observability-failure-probe",
    name: "Observability Failure Probe",
    description: "Test-only job that proves failed background jobs create alerts with trace context.",
    schedule: "Manual only",
    category: "Observability",
    getNextRunAt: nextDailyRun(23, 59),
    handler: runObservabilityFailureProbe,
  });
}

export function findBackgroundJobDefinition(jobKey: string) {
  return backgroundJobDefinitions.find((job) => job.id === jobKey) || null;
}
