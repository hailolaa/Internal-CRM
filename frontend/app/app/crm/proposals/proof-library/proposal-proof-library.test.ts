import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const proofLibraryPage = readFileSync("app/app/crm/proposals/proof-library/page.tsx", "utf8");
const proposalListPage = readFileSync("app/app/crm/proposals/page.tsx", "utf8");
const proposalEditorPage = readFileSync("app/app/crm/proposals/edit/page.tsx", "utf8");
const proposalsApiClient = readFileSync("lib/api-client/proposals-api.ts", "utf8");

describe("proposal proof library", () => {
  it("exposes searchable proof, testimonial and asset library management", () => {
    expect(proofLibraryPage).toContain("Proof, testimonial and asset library");
    expect(proofLibraryPage).toContain("Search title, copy, media or tags");
    expect(proofLibraryPage).toContain("Filter by tag");
    expect(proofLibraryPage).toContain("Archive");
    expect(proofLibraryPage).toContain("Restore");
    expect(proofLibraryPage).toContain("proposals:read");
    expect(proofLibraryPage).toContain("proposals:write");
  });

  it("keeps proof library available from proposals and the proof step", () => {
    expect(proposalListPage).toContain("/app/crm/proposals/proof-library");
    expect(proposalListPage).toContain("Proof library");
    expect(proposalEditorPage).toContain("Manage proof library");
    expect(proposalEditorPage).toContain("Search proof, testimonial, image, tag or source");
    expect(proposalEditorPage).toContain("filteredProofAssets");
  });

  it("uses proof asset API lifecycle endpoints", () => {
    expect(proposalsApiClient).toContain("proofAssetLibrary");
    expect(proposalsApiClient).toContain("updateProofAsset");
    expect(proposalsApiClient).toContain("archiveProofAsset");
    expect(proposalsApiClient).toContain("restoreProofAsset");
    expect(proposalsApiClient).toContain("/api/proposals/proof-assets");
  });
});
