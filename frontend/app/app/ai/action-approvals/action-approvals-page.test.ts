import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";

describe("AI action approval page", () => {
  it("exposes a guarded human review flow without automatic execution language", () => {
    const source = readFileSync("app/app/ai/action-approvals/page.tsx", "utf8");

    expect(source).toContain('hasPermission("ai_actions:review")');
    expect(source).toContain("Save review edits");
    expect(source).toContain("Approve");
    expect(source).toContain("Reject");
    expect(source).toContain("Commit approved action");
    expect(source).toContain("Committed and locked");
    expect(source).not.toContain("Auto-send");
  });
});
