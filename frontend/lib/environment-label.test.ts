import { describe, expect, it } from "vitest";
import { getEnvironmentBannerContent } from "./environment-label";

describe("environment label", () => {
  it("does not show a banner for production", () => {
    expect(getEnvironmentBannerContent("production")).toBeNull();
    expect(getEnvironmentBannerContent("")).toBeNull();
  });

  it("shows staging as an unmistakable non-production environment", () => {
    expect(getEnvironmentBannerContent("staging")).toEqual({
      label: "STAGING",
      description: "Staging environment - not production data.",
    });
  });

  it("normalizes other non-production environments", () => {
    expect(getEnvironmentBannerContent("Preview Lab")?.label).toBe("PREVIEW LAB");
    expect(getEnvironmentBannerContent("preview_lab")?.description).toBe("Preview Lab environment - not production data.");
  });
});
