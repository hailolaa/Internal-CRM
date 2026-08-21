import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const templatePageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const proposalEditorSource = readFileSync(new URL("../edit/page.tsx", import.meta.url), "utf8");
const proposalsPageSource = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");

describe("proposal template governance UI", () => {
  it("exposes lifecycle controls without replacing the existing proposal editor", () => {
    expect(templatePageSource).toContain("Proposal Templates");
    expect(templatePageSource).toContain("New draft version");
    expect(templatePageSource).toContain("Submit");
    expect(templatePageSource).toContain("Approve");
    expect(templatePageSource).toContain("Publish");
    expect(templatePageSource).toContain("Reject with reason");
    expect(templatePageSource).toContain("Roll back to this");
    expect(templatePageSource).toContain("Compare latest");
    expect(proposalsPageSource).toContain("/app/crm/proposals/templates");
    expect(proposalsPageSource).toContain("/app/crm/proposals/edit");
  });

  it("keeps approval and source-of-truth boundaries visible", () => {
    expect(templatePageSource).toContain("proposal_templates:approve");
    expect(templatePageSource).toContain("proposal_templates:write");
    expect(templatePageSource).toContain("Locked source rules");
    expect(templatePageSource).toContain("Package catalogue, pricing, legal terms, proof assets, CRM/client data and V19 structure");
    expect(templatePageSource).toContain("Approved and published payloads are immutable.");
  });

  it("shows proposal template version metadata and stale-version warnings in the current editor", () => {
    expect(proposalEditorSource).toContain("templateVersionId");
    expect(proposalEditorSource).toContain("selectedTemplateVersion");
    expect(proposalEditorSource).toContain("templateVersionIsStale");
    expect(proposalEditorSource).toContain("This proposal references an older template version. Create a fresh proposal version before sending.");
    expect(proposalEditorSource).toContain("Published template version");
  });
});
