import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const scopeLibraryPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const proposalEditorSource = readFileSync(new URL("../edit/page.tsx", import.meta.url), "utf8");
const proposalsPageSource = readFileSync(new URL("../page.tsx", import.meta.url), "utf8");
const proposalsApiSource = readFileSync(new URL("../../../../../lib/api-client/proposals-api.ts", import.meta.url), "utf8");

describe("proposal scope and deliverables library", () => {
  it("exposes an admin-managed searchable scope library without replacing proposals", () => {
    expect(scopeLibraryPageSource).toContain("Scope & Deliverables Library");
    expect(scopeLibraryPageSource).toContain("Search");
    expect(scopeLibraryPageSource).toContain("All categories");
    expect(scopeLibraryPageSource).toContain("Save item");
    expect(scopeLibraryPageSource).toContain("Archive");
    expect(scopeLibraryPageSource).toContain("Restore");
    expect(scopeLibraryPageSource).toContain("proposals:write");
    expect(proposalsPageSource).toContain("/app/crm/proposals/scope-library");
    expect(proposalsPageSource).toContain("/app/crm/proposals/edit");
  });

  it("keeps package source of truth separate from reusable scope language", () => {
    expect(scopeLibraryPageSource).toContain("without changing package pricing");
    expect(scopeLibraryPageSource).toContain("Proposal users copy these rows into a proposal");
    expect(proposalEditorSource).toContain("Copied rows become proposal-specific");
    expect(proposalEditorSource).toContain("addScopeItemFromLibrary");
    expect(proposalEditorSource).toContain("libraryItemId");
    expect(proposalEditorSource).toContain("libraryVersion");
  });

  it("uses the proposal API scope-library endpoints", () => {
    expect(proposalsApiSource).toContain("/api/proposals/scope-library");
    expect(proposalsApiSource).toContain("createScopeLibraryItem");
    expect(proposalsApiSource).toContain("updateScopeLibraryItem");
    expect(proposalsApiSource).toContain("archiveScopeLibraryItem");
    expect(proposalsApiSource).toContain("restoreScopeLibraryItem");
  });
});
