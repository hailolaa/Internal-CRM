export const defaultPipelineName = "Clinic Grower Sales Pipeline";

export const defaultPipelineStages = [
  { name: "New Enquiry", color: "bg-blue-500", kind: "open", position: 1 },
  { name: "Contacted", color: "bg-cyan-500", kind: "open", position: 2 },
  { name: "Qualified", color: "bg-violet-500", kind: "open", position: 3 },
  { name: "Discovery Call Booked", color: "bg-amber-500", kind: "open", position: 4 },
  { name: "Proposal Sent", color: "bg-orange-500", kind: "open", position: 5 },
  { name: "Follow-Up Needed", color: "bg-purple-500", kind: "open", position: 6 },
  { name: "Won", color: "bg-emerald-500", kind: "won", position: 7 },
  { name: "Lost", color: "bg-red-500", kind: "lost", position: 8 },
] as const;

export const pipelineStageKinds = ["open", "won", "lost"] as const;

export const pipelineDealStatuses = ["open", "won", "lost"] as const;
