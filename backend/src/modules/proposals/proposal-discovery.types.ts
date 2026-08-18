import type { ProposalDataState, ProposalResponse } from "./proposals.types.js";

export const proposalDiscoveryStatuses = [
  "in_progress",
  "paused",
  "completed",
  "draft_created",
  "archived",
] as const;

export type ProposalDiscoveryStatus = typeof proposalDiscoveryStatuses[number];

export type ProposalDiscoveryFieldKey =
  | "peopleDecisionMaker"
  | "peopleRole"
  | "contactDetails"
  | "clinicType"
  | "locations"
  | "teamOwnership"
  | "whyNowOwnerWording"
  | "commercialObjective"
  | "urgency"
  | "desiredStart"
  | "decisionProcess"
  | "priorityServices"
  | "capacity"
  | "targetLocations"
  | "firstJourney"
  | "currentDemand"
  | "enquiryHandling"
  | "responseTime"
  | "booking"
  | "attendance"
  | "acceptanceEnrolment"
  | "followUp"
  | "recordedValue"
  | "channels"
  | "currentMediaSpend"
  | "agencies"
  | "approximateVolumes"
  | "knownCplCpa"
  | "trustedData"
  | "website"
  | "callTracking"
  | "forms"
  | "whatsapp"
  | "crmPmsDiary"
  | "analytics"
  | "adAccounts"
  | "gbp"
  | "permissions"
  | "dataLimitations"
  | "economicUnit"
  | "price"
  | "confirmedContribution"
  | "monthlyCapacity"
  | "paybackExpectation"
  | "confirmationSourceDate"
  | "workingConstraint"
  | "recommendedPackageId"
  | "scopeBoundary"
  | "selectedMedia"
  | "setup"
  | "term"
  | "proposedStart"
  | "stillToConfirm"
  | "proofMode"
  | "claimCaveats"
  | "authorisedApprover"
  | "clinicalBoundary"
  | "excludedWork"
  | "callOutcome"
  | "objectionsQuestions"
  | "nextAction"
  | "nextActionOwner"
  | "nextActionDueDate";

export interface ProposalDiscoveryAnswer {
  value: string | null;
  state: ProposalDataState;
  sourceLabel: string | null;
  sourceAt: string | null;
  evidenceReference?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  approvalStatus?: "not_required" | "pending" | "approved" | "rejected" | null;
  customerWording: string | null;
  notes?: string | null;
}

export type ProposalDiscoveryAnswers = Partial<Record<ProposalDiscoveryFieldKey | string, ProposalDiscoveryAnswer>>;

export interface ProposalDiscoveryGuideField {
  key: ProposalDiscoveryFieldKey;
  label: string;
  prompt: string;
  requiredForIssue?: boolean;
}

export interface ProposalDiscoveryGuideSection {
  key: string;
  title: string;
  purpose: string;
  fields: ProposalDiscoveryGuideField[];
}

export interface ProposalDiscoverySectorBehaviour {
  clinicType: string;
  firstJourneyEmphasis: string;
  economicUnit: string;
}

export interface ProposalDiscoveryIssue {
  fieldKey: string;
  label: string;
  message: string;
  severity: "required" | "warning";
}

export interface ProposalDiscoveryConflict {
  code: string;
  message: string;
  severity: "blocking" | "warning";
}

export interface ProposalDiscoverySessionResponse {
  id: string;
  contactId: string | null;
  dealId: string | null;
  clientAccountProfileId: string | null;
  proposalId: string | null;
  status: ProposalDiscoveryStatus;
  clinicType: string | null;
  recommendedPackageId: string | null;
  activeConstraintId: string | null;
  selectedMediaSpendCents: number | null;
  prefillSnapshot: Record<string, unknown> | null;
  answers: ProposalDiscoveryAnswers;
  freeNotes: string | null;
  missingFields: ProposalDiscoveryIssue[];
  topMissingFields: ProposalDiscoveryIssue[];
  conflicts: ProposalDiscoveryConflict[];
  callOutcome: string | null;
  nextAction: string | null;
  nextActionOwnerId: string | null;
  nextActionDueAt: string | null;
  startedAt: string;
  lastAutosavedAt: string | null;
  completedAt: string | null;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  guide: ProposalDiscoveryGuideSection[];
  sectorBehaviour: ProposalDiscoverySectorBehaviour[];
}

export interface ProposalDiscoveryStartDTO {
  contactId?: string | null;
  dealId?: string | null;
  clientAccountProfileId?: string | null;
  proposalId?: string | null;
}

export interface ProposalDiscoveryUpdateDTO {
  status?: ProposalDiscoveryStatus;
  clinicType?: string | null;
  recommendedPackageId?: string | null;
  activeConstraintId?: string | null;
  selectedMediaSpendCents?: number | null;
  answers?: ProposalDiscoveryAnswers;
  freeNotes?: string | null;
  callOutcome?: string | null;
  nextAction?: string | null;
  nextActionOwnerId?: string | null;
  nextActionDueAt?: string | Date | null;
}

export interface ProposalDiscoveryDraftResponse {
  session: ProposalDiscoverySessionResponse;
  proposal: ProposalResponse;
}
