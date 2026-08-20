import { describe, expect, it } from "vitest";
import {
  MOBILE_PIPELINE_INFORMATION_ORDER,
  resolveMobilePipelineStageId,
} from "./pipeline-mobile";

describe("mobile pipeline helpers", () => {
  it("keeps the mobile card hierarchy focused on the client, stage and next action first", () => {
    expect(MOBILE_PIPELINE_INFORMATION_ORDER.slice(0, 4)).toEqual([
      "client",
      "stage",
      "nextFollowUp",
      "priority",
    ]);
  });

  it("keeps the selected mobile stage when it is still visible", () => {
    expect(resolveMobilePipelineStageId([
      { id: "qualified", deals: [] },
      { id: "proposal", deals: [{}] },
    ], "qualified")).toBe("qualified");
  });

  it("falls back to the first non-empty visible stage for mobile readability", () => {
    expect(resolveMobilePipelineStageId([
      { id: "qualified", deals: [] },
      { id: "proposal", deals: [{}] },
      { id: "won", deals: [{}] },
    ], "hidden-stage")).toBe("proposal");
  });

  it("falls back to the first visible stage when every stage is empty", () => {
    expect(resolveMobilePipelineStageId([
      { id: "qualified", deals: [] },
      { id: "proposal", deals: [] },
    ], null)).toBe("qualified");
  });
});
