export type MobilePipelineStageLike = {
  id: string;
  deals: readonly unknown[];
};

export const MOBILE_PIPELINE_INFORMATION_ORDER = [
  "client",
  "stage",
  "nextFollowUp",
  "priority",
  "treatment",
  "owner",
  "value",
  "source",
] as const;

export function resolveMobilePipelineStageId(
  stages: readonly MobilePipelineStageLike[],
  selectedStageId: string | null,
) {
  if (selectedStageId && stages.some((stage) => stage.id === selectedStageId)) {
    return selectedStageId;
  }

  return (
    stages.find((stage) => stage.deals.length > 0)?.id ||
    stages[0]?.id ||
    null
  );
}
