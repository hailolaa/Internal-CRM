import { describe, expect, it } from "vitest";
import { buildClientAccountProfilePath } from "./internal-ops-api";

describe("buildClientAccountProfilePath", () => {
  it("keeps the current-workspace profile endpoint when no target is provided", () => {
    expect(buildClientAccountProfilePath()).toBe("/api/client-accounts/profile");
    expect(buildClientAccountProfilePath("  ")).toBe("/api/client-accounts/profile");
  });

  it("builds an encoded central-editing endpoint for a target clinic", () => {
    expect(buildClientAccountProfilePath(" clinic/id ")).toBe(
      "/api/client-accounts/clinic%2Fid/profile",
    );
  });
});
