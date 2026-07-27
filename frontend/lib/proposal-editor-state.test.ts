import { describe, expect, it } from "vitest";
import type { ProposalRecord } from "@/lib/api-types";
import {
  PROPOSAL_EDITOR_STATUSES,
  isCurrentProposalRequest,
  isFinalProposalStatus,
  loadOptionalProposalPackages,
  proposalEditorHref,
  proposalIdentityFromRecord,
  proposalRequestRouteKey,
  resolveProposalSaveTarget,
} from "@/lib/proposal-editor-state";

describe("proposal editor route state", () => {
  it("builds an encoded resume route", () => {
    expect(proposalEditorHref("proposal/id with spaces")).toBe(
      "/app/crm/proposals/edit?id=proposal%2Fid%20with%20spaces",
    );
  });

  it("never updates a previously loaded proposal after the route changes", () => {
    expect(resolveProposalSaveTarget("proposal-b", "proposal-a")).toBeNull();
    expect(resolveProposalSaveTarget("proposal-b", "")).toBeNull();
    expect(resolveProposalSaveTarget("", "proposal-a")).toBeNull();
  });

  it("resolves create and matching update targets", () => {
    expect(resolveProposalSaveTarget("", "")).toEqual({ mode: "create" });
    expect(resolveProposalSaveTarget("proposal-b", "proposal-b")).toEqual({
      mode: "update",
      proposalId: "proposal-b",
    });
  });

  it("preserves loaded contact and account identity for resumed previews", () => {
    const proposal = {
      contactName: "Avery Reviewer",
      accountName: "Browser Review Dental",
      clientAccountName: "Browser Review Group",
    } as ProposalRecord;

    expect(proposalIdentityFromRecord(proposal)).toEqual({
      contactName: "Avery Reviewer",
      accountName: "Browser Review Dental",
      clientAccountName: "Browser Review Group",
    });
  });

  it("only exposes non-terminal editor statuses", () => {
    expect(PROPOSAL_EDITOR_STATUSES).toEqual([
      "draft",
      "ready",
      "sent",
      "viewed",
      "follow_up_due",
    ]);
    expect(isFinalProposalStatus("accepted")).toBe(true);
    expect(isFinalProposalStatus("won")).toBe(true);
    expect(isFinalProposalStatus("lost")).toBe(true);
    expect(isFinalProposalStatus("expired")).toBe(true);
    expect(isFinalProposalStatus("archived")).toBe(true);
    expect(isFinalProposalStatus("follow_up_due")).toBe(false);
  });

  it("only accepts an async response for its active request and route", () => {
    const request = { requestId: 4, routeKey: "id=proposal-a" };

    expect(isCurrentProposalRequest(request, request)).toBe(true);
    expect(isCurrentProposalRequest(
      { requestId: 5, routeKey: "id=proposal-a" },
      request,
    )).toBe(false);
    expect(isCurrentProposalRequest(
      { requestId: 4, routeKey: "id=proposal-b" },
      request,
    )).toBe(false);
  });

  it("changes request ownership for same-proposal query navigation", () => {
    const firstRoute = proposalRequestRouteKey(
      "/app/crm/proposals/preview/",
      "id=proposal-a&mode=summary",
    );
    const nextRoute = proposalRequestRouteKey(
      "/app/crm/proposals/preview",
      "id=proposal-a&mode=detail",
    );

    expect(firstRoute).toBe(
      "/app/crm/proposals/preview?id=proposal-a&mode=summary",
    );
    expect(isCurrentProposalRequest(
      { requestId: 1, routeKey: nextRoute },
      { requestId: 1, routeKey: firstRoute },
    )).toBe(false);
  });

  it("treats package suggestions as optional proposal enrichment", async () => {
    const packages = [{ id: "package-1" }] as Awaited<
      ReturnType<typeof loadOptionalProposalPackages>
    >;

    await expect(loadOptionalProposalPackages(async () => packages)).resolves.toBe(packages);
    await expect(loadOptionalProposalPackages(async () => {
      throw new Error("Forbidden");
    })).resolves.toEqual([]);
  });
});
