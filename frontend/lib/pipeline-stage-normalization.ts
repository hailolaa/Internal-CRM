import type { PipelineStageRecord } from "@/lib/api-types";

export type PipelineStageGroup = PipelineStageRecord & {
  mergedStageIds: string[];
};

export function getPipelineStageKey(stageName: string) {
  return stageName.trim().replace(/\s+/g, " ").toLowerCase();
}

export function dedupePipelineStages(
  stages: PipelineStageRecord[],
): PipelineStageGroup[] {
  const groups = new Map<string, PipelineStageGroup>();

  for (const stage of stages.slice().sort((a, b) => a.position - b.position)) {
    const key = getPipelineStageKey(stage.name);
    const existing = groups.get(key);

    if (!existing) {
      groups.set(key, { ...stage, mergedStageIds: [stage.id] });
      continue;
    }

    existing.mergedStageIds.push(stage.id);
  }

  return Array.from(groups.values()).sort((a, b) => a.position - b.position);
}
