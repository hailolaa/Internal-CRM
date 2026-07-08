export const phase1TimelineActions = {
  leadCreated: "lead_created",
  leadStageChanged: "lead_stage_changed",
  leadContacted: "lead_contacted",
  noteAdded: "note_added",
  pipelineDealCreated: "pipeline_deal_created",
} as const;

export type Phase1TimelineAction =
  typeof phase1TimelineActions[keyof typeof phase1TimelineActions];
