export const CLIENT_ACCOUNT_DRILLDOWN_VIEWS = [
  "onboarding",
  "missing-access",
  "missing-files",
] as const;

export type ClientAccountDrilldownView =
  (typeof CLIENT_ACCOUNT_DRILLDOWN_VIEWS)[number];

type ClientAccountDrilldownRecord = {
  contractStatus: string;
  onboardingStatus: string;
  missingAccessCount?: number | null;
  missingDocumentCount?: number | null;
};

type DueTaskRecord = {
  status: string;
  dueDate?: string | null;
  isOverdue?: boolean;
};

function startOfDayTimestamp(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function getClientAccountDrilldownView(
  value: string | null,
): ClientAccountDrilldownView | null {
  return CLIENT_ACCOUNT_DRILLDOWN_VIEWS.includes(
    value as ClientAccountDrilldownView,
  )
    ? (value as ClientAccountDrilldownView)
    : null;
}

export function getClientAccountDrilldownHref(
  view: ClientAccountDrilldownView,
) {
  return `/app/ops/client-accounts?view=${view}&from=dashboard`;
}

export function isOpenClientAccount(account: ClientAccountDrilldownRecord) {
  return ["active", "trial", "pending"].includes(account.contractStatus);
}

export function matchesClientAccountDrilldown(
  account: ClientAccountDrilldownRecord,
  view: ClientAccountDrilldownView | null,
) {
  if (!view) return true;
  if (!isOpenClientAccount(account)) return false;

  if (view === "onboarding") {
    return account.onboardingStatus !== "completed";
  }
  if (view === "missing-access") {
    return Number(account.missingAccessCount || 0) > 0;
  }
  return Number(account.missingDocumentCount || 0) > 0;
}

export function isTaskDueByToday(
  task: DueTaskRecord,
  now = new Date(),
) {
  if (task.status === "completed") return false;
  if (task.isOverdue) return true;
  if (!task.dueDate) return false;

  const dueDay = startOfDayTimestamp(task.dueDate);
  const today = startOfDayTimestamp(now);
  return dueDay !== null && today !== null && dueDay <= today;
}

export const DASHBOARD_DUE_TASKS_HREF =
  "/app/crm/tasks?due=due&from=dashboard";
