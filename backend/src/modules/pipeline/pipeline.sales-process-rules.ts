import type { PipelineStageKind } from "./pipeline.types.js";

export const salesProcessPolicyVersion = "cg-023-current-rules-v1";

export const revenueCriticalTransitionKinds: PipelineStageKind[] = ["won", "lost"];

export const salesStageRuleSummaries = [
  {
    stage: "Won",
    enforcedRequirements: [
      "human commercial confirmation",
      "final value greater than zero",
      "package or service recorded",
      "client account write permission for direct user moves",
    ],
  },
  {
    stage: "Lost",
    enforcedRequirements: [
      "human commercial confirmation",
      "lost reason recorded",
      "objection type recorded",
    ],
  },
  {
    stage: "Booked stages",
    enforcedRequirements: ["booked date/time recorded"],
  },
  {
    stage: "Pricing change",
    enforcedRequirements: ["human commercial confirmation"],
  },
] as const;

export function isRevenueCriticalStageKind(kind: PipelineStageKind) {
  return revenueCriticalTransitionKinds.includes(kind);
}

export function requiresCommercialConfirmationForStage(kind: PipelineStageKind) {
  return isRevenueCriticalStageKind(kind);
}

export function requiresCommercialConfirmationForValueChange(
  currentValueCents: number,
  nextValueCents: number | null | undefined,
) {
  return nextValueCents !== undefined
    && nextValueCents !== null
    && nextValueCents !== currentValueCents;
}

export function getSalesProcessPolicy() {
  return {
    version: salesProcessPolicyVersion,
    maxDecisionRequired: true,
    statusIsNotEvidence: true,
    revenueCriticalTransitions: revenueCriticalTransitionKinds,
    rules: salesStageRuleSummaries,
    externalApprovalGate:
      "Max must approve the final sales stages, qualification policy, SLA windows and lost-reason rules before this task is acceptance-complete.",
  };
}
