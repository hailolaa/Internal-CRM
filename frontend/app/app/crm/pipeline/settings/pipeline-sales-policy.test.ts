import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(
  new URL("../../../../../lib/api-client/pipeline-api.ts", import.meta.url),
  "utf8",
);
const typeSource = readFileSync(
  new URL("../../../../../lib/api-types/operations/pipeline.ts", import.meta.url),
  "utf8",
);

describe("pipeline sales process policy surface", () => {
  it("loads the read-only sales process policy from the pipeline API", () => {
    expect(apiSource).toContain("getSalesProcessPolicy");
    expect(apiSource).toContain("/api/pipeline/sales-process-policy");
    expect(typeSource).toContain("SalesProcessPolicyRecord");
  });

  it("shows the current enforcement and external Max decision boundary", () => {
    expect(pageSource).toContain("Current Enforcement");
    expect(pageSource).toContain("Status alone is not");
    expect(pageSource).toContain("Max approval is still required");
    expect(pageSource).toContain("externalApprovalGate");
  });

  it("sends human commercial confirmation for terminal stage moves", () => {
    const pipelinePageSource = readFileSync(
      new URL("../page.tsx", import.meta.url),
      "utf8",
    );
    expect(pipelinePageSource).toContain("commercialConfirmation: true");
  });
});
