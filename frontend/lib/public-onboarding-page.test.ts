import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync("components/public-onboarding-page.tsx", "utf8");
const onboardingRoute = readFileSync("app/onboarding/page.tsx", "utf8");

describe("public onboarding page", () => {
  it("renders as a real public page instead of redirecting into the app", () => {
    expect(onboardingRoute).toContain("PublicOnboardingPage");
    expect(onboardingRoute).not.toContain("redirect(");
  });

  it("uses current ClinicGrower ownership and brand language", () => {
    expect(pageSource).toContain("ClinicGrower Mission Control");
    expect(pageSource).toContain("ClinicGrower-owned operating layer");
    expect(pageSource).toContain("ClinicGrowerLogo");
    expect(pageSource).not.toContain("Advanced Proposal Editor");
  });

  it("shows the current V5 package pricing catalogue without stale package names", () => {
    expect(pageSource).toContain("Free Clinic Growth Audit");
    expect(pageSource).toContain("Growth Diagnostic");
    expect(pageSource).toContain("£395/mo");
    expect(pageSource).toContain("Lead Concierge");
    expect(pageSource).toContain("£595/mo");
    expect(pageSource).toContain("Clinic Growth Engine");
    expect(pageSource).toContain("£2,495/mo");
    expect(pageSource).toContain("Market Leader");
    expect(pageSource).toContain("From £4,995/mo");
    expect(pageSource).not.toContain("Performance OS");
    expect(pageSource).not.toMatch(/\{\s*name:\s*"Growth Engine"/);
  });
});
