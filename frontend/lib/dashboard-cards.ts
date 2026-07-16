export type DashboardKpiKey =
  | "newProspects"
  | "won"
  | "lost"
  | "openClients"
  | "activeProjects"
  | "overdueTasks";

export type DashboardMetricCounts = Record<DashboardKpiKey, number>;

export type DashboardKpiCard = {
  key: DashboardKpiKey;
  href: string;
  ariaLabel: string;
};

export const DASHBOARD_KPI_CARD_ORDER: DashboardKpiKey[] = [
  "newProspects",
  "won",
  "lost",
  "openClients",
  "activeProjects",
  "overdueTasks",
];

function startOfDayTimestamp(value: string | number | Date) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function isDashboardNewProspect({
  status,
  stageKind,
  stageName,
  createdAt,
  now = new Date(),
}: {
  status: string;
  stageKind: string | null | undefined;
  stageName: string | null | undefined;
  createdAt: string | number | Date;
  now?: Date;
}) {
  const stage = String(stageName || "").toLowerCase();
  const createdDay = startOfDayTimestamp(createdAt);
  const today = startOfDayTimestamp(now);
  const daysAgo = createdDay === null || today === null
    ? null
    : Math.floor((today - createdDay) / 86400000);

  return (
    stageKind === "open" &&
    status === "open" &&
    (stage.includes("new") || stage.includes("enquiry") || (daysAgo !== null && daysAgo >= 0 && daysAgo <= 7))
  );
}

export function isDashboardActiveProjectStatus(status: string) {
  return status === "active" || status === "onboarding";
}

export function getDashboardKpiCards(counts: DashboardMetricCounts): DashboardKpiCard[] {
  return [
    {
      key: "newProspects",
      href: "/app/leads?view=new&from=dashboard",
      ariaLabel: `Open ${counts.newProspects} new prospects in the prospect list`,
    },
    {
      key: "won",
      href: "/app/crm/pipeline?status=won&from=dashboard",
      ariaLabel: `Open ${counts.won} won opportunities in the sales pipeline`,
    },
    {
      key: "lost",
      href: "/app/crm/pipeline?status=lost&from=dashboard",
      ariaLabel: `Open ${counts.lost} lost opportunities in the sales pipeline`,
    },
    {
      key: "openClients",
      href: "/app/ops/client-accounts?contractStatus=open&from=dashboard",
      ariaLabel: `Open ${counts.openClients} open client accounts`,
    },
    {
      key: "activeProjects",
      href: "/app/ops/services?view=active-project&from=dashboard",
      ariaLabel: `Open ${counts.activeProjects} active delivery projects`,
    },
    {
      key: "overdueTasks",
      href: "/app/crm/tasks?due=overdue&from=dashboard",
      ariaLabel: `Open ${counts.overdueTasks} overdue internal tasks`,
    },
  ];
}

export function getDashboardKeyboardTargetIndex({
  currentIndex,
  key,
  totalItems,
  columnCount,
}: {
  currentIndex: number;
  key: string;
  totalItems: number;
  columnCount: number;
}) {
  if (totalItems <= 0) return 0;

  const normalize = (index: number) => (index + totalItems) % totalItems;

  if (key === "ArrowRight") return normalize(currentIndex + 1);
  if (key === "ArrowLeft") return normalize(currentIndex - 1);
  if (key === "ArrowDown") return normalize(currentIndex + columnCount);
  if (key === "ArrowUp") return normalize(currentIndex - columnCount);
  if (key === "Home") return 0;
  if (key === "End") return totalItems - 1;

  return currentIndex;
}
