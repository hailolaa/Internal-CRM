export const auditWorkflowStatuses = [
  "audit_requested",
  "audit_assigned",
  "audit_started",
  "audit_completed",
  "growth_score_created",
  "dashboard_access_given",
  "audit_sent",
  "follow_up_due",
] as const;

export type AuditWorkflowStatus = typeof auditWorkflowStatuses[number];

export const auditWorkflowInProgressStatuses: AuditWorkflowStatus[] = [
  "audit_requested",
  "audit_assigned",
  "audit_started",
  "growth_score_created",
  "dashboard_access_given",
  "follow_up_due",
];

export const auditWorkflowCompletedStatuses: AuditWorkflowStatus[] = [
  "audit_completed",
  "audit_sent",
];

export const auditWorkflowStatusLabels: Record<AuditWorkflowStatus, string> = {
  audit_requested: "Audit requested",
  audit_assigned: "Audit assigned",
  audit_started: "Audit started",
  audit_completed: "Audit completed",
  growth_score_created: "Growth Score created",
  dashboard_access_given: "Dashboard access given",
  audit_sent: "Audit sent",
  follow_up_due: "Follow-up due",
};

export function isAuditWorkflowStatus(value: unknown): value is AuditWorkflowStatus {
  return typeof value === "string" && auditWorkflowStatuses.includes(value as AuditWorkflowStatus);
}
