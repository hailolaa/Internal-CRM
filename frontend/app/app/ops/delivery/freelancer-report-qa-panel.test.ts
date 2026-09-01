import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(
  new URL("../../../../lib/api-client/integration-inputs-api.ts", import.meta.url),
  "utf8",
);
const typeSource = readFileSync(
  new URL("../../../../lib/api-types/integration-inputs.ts", import.meta.url),
  "utf8",
);

describe("delivery freelancer report QA panel", () => {
  it("loads freelancer report templates and QA status from the integration inputs API", () => {
    expect(apiSource).toContain("listFreelancerReportTemplates");
    expect(apiSource).toContain("listFreelancerReports");
    expect(apiSource).toContain(
      "/api/integration-inputs/freelancer-report-templates",
    );
    expect(apiSource).toContain("/api/integration-inputs/freelancer-reports");
  });

  it("exposes the operating repair states on the Delivery Work page", () => {
    expect(pageSource).toContain("Freelancer report QA");
    expect(pageSource).toContain("Delivery status is not completion evidence");
    expect(pageSource).toContain("awaiting evidence");
    expect(pageSource).toContain("awaiting QA");
    expect(pageSource).toContain("failed QA");
    expect(pageSource).toContain("rework");
    expect(pageSource).toContain("High-risk review");
    expect(pageSource).toContain("getFreelancerReportReviewState");
    expect(pageSource).toContain("Missing current report coverage");
  });

  it("types every CG-161 report field used by the UI", () => {
    expect(typeSource).toContain("FreelancerReportTemplateRecord");
    expect(typeSource).toContain("FreelancerReportSummaryRecord");
    expect(typeSource).toContain("sourceLinks");
    expect(typeSource).toContain("verificationDate");
    expect(typeSource).toContain("needsRework");
  });
});
