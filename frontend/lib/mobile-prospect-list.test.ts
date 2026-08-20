import { describe, expect, it } from "vitest";
import {
  getMobileProspectSortValue,
  MOBILE_PROSPECT_INFORMATION_ORDER,
  MOBILE_PROSPECT_SORT_OPTIONS,
} from "./mobile-prospect-list";

describe("mobile prospect list", () => {
  it("keeps action-critical prospect fields first on mobile", () => {
    expect(MOBILE_PROSPECT_INFORMATION_ORDER.slice(0, 4)).toEqual([
      "prospect_identity",
      "stage_status",
      "priority",
      "next_action_follow_up",
    ]);
  });

  it("offers existing prospect sort keys without inventing a new ranking rule", () => {
    expect(MOBILE_PROSPECT_SORT_OPTIONS.map((option) => option.key)).toEqual([
      "sortDate",
      "priorityScore",
      "followUpSort",
      "slaSort",
      "auditDueSort",
      "revenue",
    ]);
  });

  it("resolves mobile sort select values from the active sort config", () => {
    expect(getMobileProspectSortValue("priorityScore", "desc")).toBe(
      "priorityScore:desc",
    );
    expect(getMobileProspectSortValue("followUpSort", "asc")).toBe(
      "followUpSort:asc",
    );
    expect(getMobileProspectSortValue("", null)).toBe("sortDate:desc");
  });
});
