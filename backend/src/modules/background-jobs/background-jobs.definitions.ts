import {
  runDailySlaReport,
  runRecurringTasksGeneration,
  runSequenceExecution,
  runSlaBreachCheck,
} from "./background-jobs.tasks.js";
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
];

export function findBackgroundJobDefinition(jobKey: string) {
  return backgroundJobDefinitions.find((job) => job.id === jobKey) || null;
}
