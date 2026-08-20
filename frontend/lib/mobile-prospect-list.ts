import type { SortDirection } from "@/hooks/use-table";

export const MOBILE_PROSPECT_INFORMATION_ORDER = [
  "prospect_identity",
  "stage_status",
  "priority",
  "next_action_follow_up",
  "treatment_context",
  "owner_source_value",
  "sla_audit_context",
] as const;

export type MobileProspectSortValue =
  | "sortDate:desc"
  | "priorityScore:desc"
  | "followUpSort:asc"
  | "slaSort:asc"
  | "auditDueSort:asc"
  | "revenue:desc";

export type MobileProspectSortOption = {
  value: MobileProspectSortValue;
  label: string;
  key: string;
  direction: Exclude<SortDirection, null>;
};

export const MOBILE_PROSPECT_SORT_OPTIONS: MobileProspectSortOption[] = [
  {
    value: "sortDate:desc",
    label: "Newest first",
    key: "sortDate",
    direction: "desc",
  },
  {
    value: "priorityScore:desc",
    label: "Priority first",
    key: "priorityScore",
    direction: "desc",
  },
  {
    value: "followUpSort:asc",
    label: "Follow-up soonest",
    key: "followUpSort",
    direction: "asc",
  },
  {
    value: "slaSort:asc",
    label: "SLA attention",
    key: "slaSort",
    direction: "asc",
  },
  {
    value: "auditDueSort:asc",
    label: "Audit due soonest",
    key: "auditDueSort",
    direction: "asc",
  },
  {
    value: "revenue:desc",
    label: "Highest value",
    key: "revenue",
    direction: "desc",
  },
];

export function getMobileProspectSortValue(
  sortKey: string,
  sortDirection: SortDirection,
): MobileProspectSortValue {
  const match = MOBILE_PROSPECT_SORT_OPTIONS.find(
    (option) => option.key === sortKey && option.direction === sortDirection,
  );

  return match?.value || "sortDate:desc";
}
