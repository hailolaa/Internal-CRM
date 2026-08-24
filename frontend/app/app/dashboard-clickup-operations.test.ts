import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const dashboardSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");

describe("ClickUp operations dashboard refresh", () => {
  it("keeps the live ClickUp work queue refreshable without changing task sync", () => {
    expect(dashboardSource).toContain("refreshClickUpOperations");
    expect(dashboardSource).toContain("api.clickup.getOperationsDashboard(token)");
    expect(dashboardSource).toContain("window.setInterval");
    expect(dashboardSource).toContain("60_000");
    expect(dashboardSource).toContain("Refresh");
    expect(dashboardSource).toContain("Live delivery work from ClickUp");
  });
});
