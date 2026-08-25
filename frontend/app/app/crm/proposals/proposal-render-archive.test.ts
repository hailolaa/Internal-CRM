import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proposalListPage = readFileSync("app/app/crm/proposals/page.tsx", "utf8");
const proposalsApiClient = readFileSync("lib/api-client/proposals-api.ts", "utf8");
const proposalTypes = readFileSync("lib/api-types/proposals.ts", "utf8");

describe("proposal render archive", () => {
  it("surfaces searchable frozen PDF archive records from the proposal list", () => {
    expect(proposalListPage).toContain("Archived PDFs");
    expect(proposalListPage).toContain("PDF archive");
    expect(proposalListPage).toContain("Frozen proposal print records");
    expect(proposalListPage).toContain("Archived PDF ready");
    expect(proposalListPage).toContain("/app/crm/proposals/v5-print-preview?proposalId=");
    expect(proposalListPage).toContain("renderArchiveByProposalId");
  });

  it("uses the authenticated proposal render archive API", () => {
    expect(proposalsApiClient).toContain("renderArchive");
    expect(proposalsApiClient).toContain("/api/proposals/render-archive");
    expect(proposalTypes).toContain("ProposalRenderArchiveRecord");
    expect(proposalTypes).toContain('artifactType: "v5_print_pdf"');
  });
});
