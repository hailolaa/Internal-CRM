export const defaultPipelineName = "Clinic Grower Sales Pipeline";

export const defaultPipelineStages = [
  { name: "New Lead", color: "bg-blue-500", kind: "open", position: 1 },
  { name: "Contact Needed", color: "bg-sky-500", kind: "open", position: 2 },
  { name: "Contact Attempted", color: "bg-cyan-500", kind: "open", position: 3 },
  { name: "Spoken To", color: "bg-indigo-500", kind: "open", position: 4 },
  { name: "Free Audit Needed", color: "bg-violet-500", kind: "open", position: 5 },
  { name: "Free Audit In Progress", color: "bg-purple-500", kind: "open", position: 6 },
  { name: "Audit Complete", color: "bg-fuchsia-500", kind: "open", position: 7 },
  { name: "Dashboard Access Given", color: "bg-pink-500", kind: "open", position: 8 },
  { name: "Proposal Needed", color: "bg-amber-500", kind: "open", position: 9 },
  { name: "Proposal Sent", color: "bg-orange-500", kind: "open", position: 10 },
  { name: "Follow-up Needed", color: "bg-yellow-500", kind: "open", position: 11 },
  { name: "Negotiation", color: "bg-lime-500", kind: "open", position: 12 },
  { name: "Won", color: "bg-emerald-500", kind: "won", position: 13 },
  { name: "Lost", color: "bg-red-500", kind: "lost", position: 14 },
  { name: "Nurture", color: "bg-teal-500", kind: "open", position: 15 },
  { name: "Future Opportunity", color: "bg-slate-500", kind: "open", position: 16 },
] as const;

export const legacyPipelineStageAliases: Record<string, readonly string[]> = {
  "New Lead": ["New", "New Enquiry"],
  "Contact Attempted": ["Contacted"],
  "Spoken To": ["Qualified"],
  "Free Audit Needed": ["Discovery Booked", "Discovery Call Booked", "Consult Booked"],
  "Audit Complete": ["Consult Attended"],
  "Follow-up Needed": ["Follow-Up Needed"],
  Won: ["Sold"],
};

export const pipelineStageKinds = ["open", "won", "lost"] as const;

export const pipelineDealStatuses = ["open", "won", "lost"] as const;
