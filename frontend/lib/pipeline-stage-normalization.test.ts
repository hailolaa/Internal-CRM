import { describe, expect, it } from "vitest";
import type { PipelineStageRecord } from "@/lib/api-types";
import { dedupePipelineStages } from "./pipeline-stage-normalization";

function stage(
  id: string,
  name: string,
  position: number,
): PipelineStageRecord {
  return {
    id,
    pipelineId: "pipeline-1",
    name,
    color: "bg-blue-500",
    position,
    kind: "open",
    isLocked: false,
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
  };
}

describe("dedupePipelineStages", () => {
  it("keeps one display stage per canonical name and tracks merged ids", () => {
    const stages = dedupePipelineStages([
      stage("won-duplicate", "Won", 8),
      stage("booked-1", "Discovery Call Booked", 4),
      stage("won-1", "Won", 6),
      stage("booked-duplicate", "  Discovery   Call Booked ", 9),
    ]);

    expect(stages.map((item) => item.name)).toEqual([
      "Discovery Call Booked",
      "Won",
    ]);
    expect(stages[0]?.mergedStageIds).toEqual([
      "booked-1",
      "booked-duplicate",
    ]);
    expect(stages[1]?.mergedStageIds).toEqual([
      "won-1",
      "won-duplicate",
    ]);
  });
});
