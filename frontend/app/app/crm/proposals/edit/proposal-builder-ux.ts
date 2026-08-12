export type ProposalBuilderStepId =
  | "client"
  | "discovery"
  | "diagnosis"
  | "economics"
  | "proof"
  | "scope"
  | "investment"
  | "review"
  | "send";

export type ProposalBuilderStepStatus = "complete" | "needs_attention" | "locked";

export interface ProposalBuilderStepDefinition {
  id: ProposalBuilderStepId;
  number: string;
  label: string;
  title: string;
  description: string;
}

export interface ProposalBuilderProgressInput {
  clientLinked: boolean;
  clinicName: string;
  contactName: string;
  proposalReference: string;
  clinicType: string;
  location: string;
  selectedPackageId: string;
  personalIntroduction: string;
  discoverySource: string;
  evidenceConfidenceState: string;
  primaryGoal: string;
  whyActNow: string;
  priorityServices: string;
  targetArea: string;
  currentPosition: string;
  currentMarketing: string;
  capacity: string;
  limitations: string;
  customerWording: string;
  diagnosis: string;
  workingConstraint: string;
  activeConstraintConfidenceState: string;
  diagnosedLeaks: string;
  biggestRisk: string;
  recommendedDirection: string;
  currentEnquiries: string;
  bookedPatients: string;
  currentBookingRate: string;
  attendanceRate: string;
  consultationToTreatmentConversionRate: string;
  treatmentValue: string;
  marketingSpend: string;
  economicUnit: string;
  confirmedContribution: string;
  contributionEvidenceSourceDate: string;
  contributionConfirmationState: string;
  selectedMediaSpend: string;
  commercialCapacity: string;
  commercialEvidenceState: string;
  currentAcquisitionCost: string;
  commercialDataSource: string;
  liveDataStatus: string;
  knownDataLimitations: string;
  sectorImageProvenance: string;
  sectorImageApprovalStatus: string;
  adSpendRule: string;
  proofAssetCount: number;
  scopeItemCount: number;
  scopeHasClientDescriptions: boolean;
  monthlyFee: string;
  setupFee: string;
  vatStatus: string;
  minimumTerm: string;
  noticePeriod: string;
  startDate: string;
  expiryDate: string;
  previewReady: boolean;
  previewMissingItems?: string[];
  clientUseMissingItems?: string[];
  savedProposalId: string;
}

export interface ProposalBuilderStepProgress extends ProposalBuilderStepDefinition {
  status: ProposalBuilderStepStatus;
  missing: string[];
}

export const proposalBuilderSteps: ProposalBuilderStepDefinition[] = [
  {
    id: "client",
    number: "01",
    label: "Client",
    title: "Client and package",
    description: "Confirm who this proposal is for and which offer should drive the V5 proposal.",
  },
  {
    id: "discovery",
    number: "02",
    label: "Discovery",
    title: "Discovery context",
    description: "Capture the current situation, goal, marketing context, capacity and known limits.",
  },
  {
    id: "diagnosis",
    number: "03",
    label: "Diagnosis",
    title: "Diagnosis and recommendation",
    description: "Turn the discovery into clear client-facing reasoning before economics or price.",
  },
  {
    id: "economics",
    number: "04",
    label: "Economics",
    title: "Commercial opportunity",
    description: "Record the few numbers needed to explain leakage, capacity and break-even clearly.",
  },
  {
    id: "proof",
    number: "05",
    label: "Proof",
    title: "Proof and evidence",
    description: "Select relevant proof blocks instead of exposing proof asset administration.",
  },
  {
    id: "scope",
    number: "06",
    label: "Scope",
    title: "Scope from package",
    description: "Review the package-driven scope and only add custom items where approved.",
  },
  {
    id: "investment",
    number: "07",
    label: "Investment",
    title: "Investment and terms",
    description: "Confirm the commercial terms the client will see and the dates needed before sending.",
  },
  {
    id: "review",
    number: "08",
    label: "Review",
    title: "Readiness and preview",
    description: "Check what is complete, fix what is missing, and preview the actual V5 proposal.",
  },
  {
    id: "send",
    number: "09",
    label: "Send",
    title: "Send and freeze",
    description: "Send only when the version is ready because sending freezes the proposal version.",
  },
];

function hasValue(value: string) {
  return Boolean(value.trim());
}

function required(missing: string[], value: string | boolean, label: string) {
  if (typeof value === "boolean") {
    if (!value) missing.push(label);
    return;
  }
  if (!hasValue(value)) missing.push(label);
}

function uniqueListItemCount(value: string) {
  return new Set(
    value
      .split(/\r?\n|;/)
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean),
  ).size;
}

function hasNumber(value: string) {
  return /\d/.test(value);
}

function requiredNumber(missing: string[], value: string, label: string) {
  required(missing, value, label);
  if (hasValue(value) && !hasNumber(value)) missing.push(`${label} number`);
}

export function getProposalBuilderStepProgress(input: ProposalBuilderProgressInput): ProposalBuilderStepProgress[] {
  const missingByStep: Record<ProposalBuilderStepId, string[]> = {
    client: [],
    discovery: [],
    diagnosis: [],
    economics: [],
    proof: [],
    scope: [],
    investment: [],
    review: [],
    send: [],
  };

  required(missingByStep.client, input.clientLinked, "Linked CRM record");
  required(missingByStep.client, input.clinicName, "Clinic");
  required(missingByStep.client, input.contactName, "Contact");
  required(missingByStep.client, input.proposalReference, "Proposal reference");
  required(missingByStep.client, input.clinicType, "Clinic type");
  required(missingByStep.client, input.location, "Location");
  required(missingByStep.client, input.selectedPackageId, "Package");
  required(missingByStep.client, input.sectorImageProvenance, "Sector image provenance");
  if (input.sectorImageApprovalStatus !== "approved") missingByStep.client.push("Approved sector images");

  required(missingByStep.discovery, input.discoverySource, "Discovery source");
  if (!["known", "working_diagnosis", "provisional"].includes(input.evidenceConfidenceState)) {
    missingByStep.discovery.push("Evidence confidence set to Known, Working diagnosis or Provisional");
  }
  required(missingByStep.discovery, input.primaryGoal, "Goal");
  required(missingByStep.discovery, input.whyActNow, "Why act now");
  required(missingByStep.discovery, input.targetArea, "Target area");
  if (uniqueListItemCount(input.priorityServices) < 3) {
    missingByStep.discovery.push("At least three different priority services");
  }
  required(missingByStep.discovery, input.currentPosition, "Current situation");
  required(missingByStep.discovery, input.currentMarketing, "Current marketing");
  required(missingByStep.discovery, input.capacity, "Capacity");
  required(missingByStep.discovery, input.limitations, "Known limitations");

  required(missingByStep.diagnosis, input.customerWording, "What we heard");
  required(missingByStep.diagnosis, input.personalIntroduction, "Personal note");
  required(missingByStep.diagnosis, input.diagnosis, "Diagnosis");
  required(missingByStep.diagnosis, input.workingConstraint, "Working constraint");
  if (!["known", "working_diagnosis", "provisional"].includes(input.activeConstraintConfidenceState)) {
    missingByStep.diagnosis.push("Active-constraint confidence set to Known, Working diagnosis or Provisional");
  }
  if (uniqueListItemCount(input.diagnosedLeaks) < 3) {
    missingByStep.diagnosis.push("At least three different diagnosed leaks");
  }
  required(missingByStep.diagnosis, input.biggestRisk, "Main leakage/risk");
  required(missingByStep.diagnosis, input.recommendedDirection, "Recommended direction");

  requiredNumber(missingByStep.economics, input.currentEnquiries, "Current enquiries");
  requiredNumber(missingByStep.economics, input.bookedPatients, "Booked patients");
  requiredNumber(missingByStep.economics, input.currentBookingRate, "Booking rate");
  requiredNumber(missingByStep.economics, input.attendanceRate, "Attendance rate");
  requiredNumber(missingByStep.economics, input.consultationToTreatmentConversionRate, "Consult-to-treatment rate");
  requiredNumber(missingByStep.economics, input.treatmentValue, "Treatment value");
  requiredNumber(missingByStep.economics, input.marketingSpend, "Marketing spend");
  required(missingByStep.economics, input.economicUnit, "Economic unit");
  requiredNumber(missingByStep.economics, input.confirmedContribution, "Confirmed contribution");
  required(missingByStep.economics, input.contributionEvidenceSourceDate, "Contribution evidence source/date");
  if (input.contributionConfirmationState !== "known") {
    missingByStep.economics.push("Contribution confirmation set to Known");
  }
  requiredNumber(missingByStep.economics, input.selectedMediaSpend, "Media spend");
  requiredNumber(missingByStep.economics, input.commercialCapacity, "Commercial capacity");
  requiredNumber(missingByStep.economics, input.currentAcquisitionCost, "Current acquisition cost");
  required(missingByStep.economics, input.commercialDataSource, "Commercial data source");
  if (input.commercialEvidenceState !== "known") missingByStep.economics.push("Commercial evidence set to Known");
  if (input.liveDataStatus !== "live_connected") required(missingByStep.economics, input.knownDataLimitations, "Known data limitations");

  if (input.proofAssetCount < 1) missingByStep.proof.push("At least one selected proof block");

  if (input.scopeItemCount < 1) missingByStep.scope.push("Package scope");
  if (input.scopeItemCount > 0 && !input.scopeHasClientDescriptions) {
    missingByStep.scope.push("Client-facing scope descriptions");
  }

  required(missingByStep.investment, input.monthlyFee, "Monthly fee");
  required(missingByStep.investment, input.vatStatus, "VAT status");
  required(missingByStep.investment, input.minimumTerm, "Minimum term");
  required(missingByStep.investment, input.noticePeriod, "Notice period");
  required(missingByStep.investment, input.startDate, "Start date");
  required(missingByStep.investment, input.expiryDate, "Expiry date");
  required(missingByStep.investment, input.adSpendRule, "Ad spend rule");
  if (!hasValue(input.setupFee)) {
    missingByStep.investment.push("Setup fee, even if zero");
  }

  const clientUseMissingItems = (input.clientUseMissingItems || [])
    .map((item) => item.trim())
    .filter(Boolean);
  for (const item of clientUseMissingItems) {
    if (item.startsWith("Proof:")) {
      missingByStep.proof.push(item);
    } else if (item.startsWith("Scope:")) {
      missingByStep.scope.push(item);
    } else {
      missingByStep.review.push(item);
    }
  }

  const preReviewMissing = proposalBuilderSteps
    .filter((step) => !["review", "send"].includes(step.id))
    .flatMap((step) => missingByStep[step.id]);
  if (preReviewMissing.length > 0) missingByStep.review.push(...preReviewMissing);
  if (!input.previewReady) {
    const previewMissingItems = (input.previewMissingItems || []).map((item) => item.trim()).filter(Boolean);
    missingByStep.review.push(...(previewMissingItems.length ? previewMissingItems : ["V5 preview readiness"]));
  }

  if (missingByStep.review.length > 0) missingByStep.send.push("Ready V5 proposal");
  if (!hasValue(input.savedProposalId)) missingByStep.send.push("Saved draft");

  return proposalBuilderSteps.map((step) => ({
    ...step,
    missing: Array.from(new Set(missingByStep[step.id])),
    status: missingByStep[step.id].length > 0 ? "needs_attention" : "complete",
  }));
}

export function getFirstIncompleteProposalBuilderStep(progress: ProposalBuilderStepProgress[]) {
  return progress.find((step) => step.missing.length > 0)?.id || "send";
}

export function getProposalBuilderMissingCount(progress: ProposalBuilderStepProgress[]) {
  return new Set(progress
    .filter((step) => step.id !== "send")
    .flatMap((step) => step.missing)).size;
}
