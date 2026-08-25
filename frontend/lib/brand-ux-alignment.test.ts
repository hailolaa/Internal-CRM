import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(path, "utf8");
}

describe("ClinicGrower brand and UX alignment", () => {
  it("keeps shared brand assets, fonts and tokens referenced", () => {
    const logo = read("components/brand/ClinicGrowerLogo.tsx");
    const layout = read("app/layout.tsx");
    const globals = read("app/globals.css");
    const tokens = read("styles/tokens.css");
    const docs = read("../docs/brand-ux-alignment.md");

    expect(logo).toContain("/brand/clinic-grower-logo-inline.png");
    expect(logo).toContain("/brand/clinic-grower-icon-light-circular.png");
    expect(layout).toContain("Inter");
    expect(layout).toContain("Plus_Jakarta_Sans");
    expect(globals).toContain('@import "../styles/tokens.css"');
    expect(tokens).toContain("--color-primary: #151f21");
    expect(tokens).toContain("--color-accent: #60b4af");
    expect(tokens).toContain("--color-teal-muted: #5e8a8d");
    expect(docs).toContain("ClinicGrower Mission Control");
    expect(docs).toContain("Clinic OS");
    expect(docs).toContain("analytics");
  });

  it("keeps the public package presentation aligned to the approved commercial structure", () => {
    const onboarding = read("components/public-onboarding-page.tsx");

    expect(onboarding).toContain("Free Clinic Growth Audit");
    expect(onboarding).toContain("It does not provide the verified numerical Clinic Growth Score.");
    expect(onboarding).toContain("Clinic Growth Diagnostic");
    expect(onboarding).toContain("£395 + VAT one-off");
    expect(onboarding).toContain("Treatment Growth");
    expect(onboarding).toContain("£995 + VAT/month");
    expect(onboarding).toContain("Clinic Growth");
    expect(onboarding).toContain("£1,995 + VAT/month");
    expect(onboarding).toContain("Recommended for established clinics");
    expect(onboarding).toContain("Market Leader");
    expect(onboarding).toContain("£3,495 + VAT/month");
    expect(onboarding).toContain("Start with one treatment. Expand only when the numbers justify it.");
    expect(onboarding).toContain("Start Your Free Clinic Growth Audit.");

    expect(onboarding).not.toContain("Most Popular");
    expect(onboarding).not.toContain("Lead Concierge");
    expect(onboarding).not.toContain("Performance OS");
    expect(onboarding).not.toContain("Virtual Growth Director");
    expect(onboarding).not.toContain("Growth Engine Plus");
    expect(onboarding).not.toContain("Clinic Growth Engine");
    expect(onboarding).not.toContain("£2,495");
    expect(onboarding).not.toContain("£4,995");
    expect(onboarding).not.toMatch(/per day|daily-equivalent/i);
  });

  it("keeps active intake examples and package choices off retired public offers", () => {
    const files = [
      read("app/app/marketing/offers/new/page.tsx"),
      read("app/app/marketing/campaigns/new/page.tsx"),
      read("app/app/crm/contacts/new/page.tsx"),
      read("app/app/crm/contacts/edit/page.tsx"),
      read("app/app/settings/api/page.tsx"),
      read("app/app/settings/api/docs/page.tsx"),
      read("app/app/comms/templates/page.tsx"),
      read("app/app/ops/client-accounts/new/page.tsx"),
    ].join("\n");

    expect(files).toContain("Free Clinic Growth Audit");
    expect(files).toContain("Clinic Growth Diagnostic");
    expect(files).toContain("Treatment Growth");
    expect(files).toContain("Clinic Growth");
    expect(files).toContain("Market Leader");

    expect(files).not.toContain("Lead Concierge");
    expect(files).not.toContain("Performance OS");
    expect(files).not.toContain("Growth Engine Plus");
    expect(files).not.toContain("Clinic Growth Engine");
  });
});
