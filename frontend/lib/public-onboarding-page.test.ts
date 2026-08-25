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

  it("shows the approved public funnel and three monthly packages without stale package cards", () => {
    expect(pageSource).toContain("Free Clinic Growth Audit");
    expect(pageSource).toContain("Clinic Growth Diagnostic");
    expect(pageSource).toContain("£395 + VAT one-off");
    expect(pageSource).toContain("Treatment Growth");
    expect(pageSource).toContain("£995 + VAT/month");
    expect(pageSource).toContain("Clinic Growth");
    expect(pageSource).toContain("£1,995 + VAT/month");
    expect(pageSource).toContain("Recommended for established clinics");
    expect(pageSource).toContain("Market Leader");
    expect(pageSource).toContain("£3,495 + VAT/month");
    expect(pageSource).toContain("Start with one treatment. Expand only when the numbers justify it.");
    expect(pageSource).toContain("Start Your Free Clinic Growth Audit.");
    expect(pageSource).not.toContain("Most Popular");
    expect(pageSource).not.toContain("Lead Concierge");
    expect(pageSource).not.toContain("Performance OS");
    expect(pageSource).not.toContain("Growth Engine Plus");
    expect(pageSource).not.toContain("Clinic Growth Engine");
    expect(pageSource).not.toContain("£2,495");
    expect(pageSource).not.toContain("£4,995");
  });
});
