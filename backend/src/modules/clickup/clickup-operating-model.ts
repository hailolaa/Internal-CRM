export type ClickUpTaskSystem = "mission_control" | "clickup" | "client_workspace" | "reviewer";

export interface ClickUpTaskFieldSourceRule {
  field: string;
  sourceOfTruth: ClickUpTaskSystem;
  syncedTo: ClickUpTaskSystem[];
  editableIn: ClickUpTaskSystem[];
  conflictResolution: string;
  silentOverwriteAllowed: false;
}

export interface ClickUpTaskDuplicateRule {
  identity: string;
  preventionRule: string;
  recoveryRule: string;
}

export const CLICKUP_TASK_OPERATING_MODEL_VERSION = "cg-024-2026-09-01";

export const CLICKUP_TASK_FIELD_SOURCE_RULES: ClickUpTaskFieldSourceRule[] = [
  {
    field: "missionControlTaskId",
    sourceOfTruth: "mission_control",
    syncedTo: ["clickup"],
    editableIn: ["mission_control"],
    conflictResolution: "Mission Control task ID is immutable. Provider references are mapped, not rewritten.",
    silentOverwriteAllowed: false,
  },
  {
    field: "clickupTaskId",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup"],
    conflictResolution: "A ClickUp task ID can be linked once per Mission Control task and then only reviewed or archived.",
    silentOverwriteAllowed: false,
  },
  {
    field: "clientAccountProfileId",
    sourceOfTruth: "mission_control",
    syncedTo: ["clickup"],
    editableIn: ["mission_control"],
    conflictResolution: "Client ownership follows Mission Control profile ID. Cross-client ClickUp reuse is rejected.",
    silentOverwriteAllowed: false,
  },
  {
    field: "deliveryWorkspaceList",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup", "mission_control"],
    conflictResolution: "Approved ClickUp workspace/list mappings are saved per client. Reuse or moved tasks are held for review.",
    silentOverwriteAllowed: false,
  },
  {
    field: "title",
    sourceOfTruth: "mission_control",
    syncedTo: ["clickup"],
    editableIn: ["mission_control"],
    conflictResolution: "Mission Control title changes may sync out. Inbound provider title changes are evidence only unless manually reviewed.",
    silentOverwriteAllowed: false,
  },
  {
    field: "description",
    sourceOfTruth: "mission_control",
    syncedTo: ["clickup"],
    editableIn: ["mission_control"],
    conflictResolution: "Mission Control description changes may sync out. Provider description changes must not silently replace internal context.",
    silentOverwriteAllowed: false,
  },
  {
    field: "status",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup", "mission_control"],
    conflictResolution: "Latest signed provider lifecycle status applies when mapped. Stale events are ignored and conflicts go to reconciliation.",
    silentOverwriteAllowed: false,
  },
  {
    field: "priority",
    sourceOfTruth: "mission_control",
    syncedTo: ["clickup"],
    editableIn: ["mission_control"],
    conflictResolution: "Mission Control priority maps through the approved priority table. Unmapped provider values are held for review.",
    silentOverwriteAllowed: false,
  },
  {
    field: "dueDate",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup", "mission_control"],
    conflictResolution: "Mapped due-date lifecycle updates apply by provider timestamp. Stale or unmapped updates are quarantined.",
    silentOverwriteAllowed: false,
  },
  {
    field: "assignee",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup", "mission_control"],
    conflictResolution: "ClickUp assignee IDs are retained. Unmapped Mission Control names mark the task needs_review instead of syncing.",
    silentOverwriteAllowed: false,
  },
  {
    field: "workstreamCategory",
    sourceOfTruth: "mission_control",
    syncedTo: ["clickup"],
    editableIn: ["mission_control"],
    conflictResolution: "Category must use the approved per-client category mapping before task creation.",
    silentOverwriteAllowed: false,
  },
  {
    field: "dependenciesAndBlockers",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup"],
    conflictResolution: "Mission Control displays delivery exceptions and does not create duplicate client delivery execution tasks.",
    silentOverwriteAllowed: false,
  },
  {
    field: "evidenceAndAttachments",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup", "client_workspace"],
    conflictResolution: "Mission Control may send initial attachments but provider evidence remains reviewable and is not silently overwritten.",
    silentOverwriteAllowed: false,
  },
  {
    field: "reviewerAcceptance",
    sourceOfTruth: "reviewer",
    syncedTo: ["mission_control", "clickup"],
    editableIn: ["reviewer"],
    conflictResolution: "Reviewer acceptance is separate from engineering status. Status alone is not acceptance evidence.",
    silentOverwriteAllowed: false,
  },
  {
    field: "commentsAndActivity",
    sourceOfTruth: "clickup",
    syncedTo: ["mission_control"],
    editableIn: ["clickup"],
    conflictResolution: "Comments remain provider activity history. Mission Control may surface summaries without impersonating the actor.",
    silentOverwriteAllowed: false,
  },
];

export const CLICKUP_TASK_DUPLICATE_RULES: ClickUpTaskDuplicateRule[] = [
  {
    identity: "internalTaskId",
    preventionRule: "One active or needs_review ClickUp task mapping may exist for a Mission Control internal task.",
    recoveryRule: "Retries must reuse or recover the stored mapping before another provider create call is allowed.",
  },
  {
    identity: "clickupTaskId",
    preventionRule: "One active ClickUp task ID may map to one client account in a Mission Control workspace.",
    recoveryRule: "Cross-client reuse is rejected and moved/provider-created tasks are marked needs_review.",
  },
  {
    identity: "providerEventKey",
    preventionRule: "One signed ClickUp webhook history item is stored by provider event key.",
    recoveryRule: "Duplicate webhooks return the existing event receipt and do not apply another lifecycle update.",
  },
  {
    identity: "clientAccountProfileId + workspace/list/rootTask",
    preventionRule: "One active delivery structure may be assigned to one client account in the workspace.",
    recoveryRule: "Reused folders/lists/root tasks are rejected before they can overwrite another client mapping.",
  },
];

export function clickUpTaskOperatingModel() {
  return {
    version: CLICKUP_TASK_OPERATING_MODEL_VERSION,
    sourceRules: CLICKUP_TASK_FIELD_SOURCE_RULES,
    duplicateRules: CLICKUP_TASK_DUPLICATE_RULES,
  };
}
