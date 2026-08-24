import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { BOTTOM_NAV, NAV_SECTIONS } from "@/lib/navigation";

const appRoot = process.cwd();
const allItems = [...NAV_SECTIONS.flatMap((section) => section.items), ...BOTTOM_NAV];

function routeFileFor(href: string) {
  const pathOnly = href.split("?")[0]!.split("#")[0]!;
  const segments = pathOnly === "/app" ? ["app", "app", "page.tsx"] : ["app", ...pathOnly.slice(1).split("/"), "page.tsx"];
  return join(appRoot, ...segments);
}

describe("Mission Control navigation", () => {
  it("links every sidebar item to an existing app route", () => {
    for (const item of allItems) {
      expect(existsSync(routeFileFor(item.href)), `${item.label} -> ${item.href}`).toBe(true);
    }
  });

  it("exposes the active internal modules from the main navigation", () => {
    const hrefs = new Set(allItems.map((item) => item.href));

    expect([...hrefs]).toEqual(
      expect.arrayContaining([
        "/app/leads",
        "/app/crm/pipeline",
        "/app/crm/proposals",
        "/app/comms/calls/recovery",
        "/app/ops/client-accounts",
        "/app/reports/growth-scores",
        "/app/integrations/sync-health",
        "/app/integrations/clickup/reconciliation",
        "/app/admin/tenant-scope",
      ]),
    );
  });

  it("uses explicit permissions for restricted navigation entries", () => {
    const permissionsByHref = new Map(allItems.map((item) => [item.href, item.permission]));

    expect(permissionsByHref.get("/app/settings")).toBe("settings:read");
    expect(permissionsByHref.get("/app/integrations")).toBe("webhooks:read");
    expect(permissionsByHref.get("/app/ops/team")).toBe("team:read");
    expect(permissionsByHref.get("/app/reports/growth-scores")).toBe("reports:read");
  });

  it("keeps the app shell mobile-friendly", () => {
    const sidebarSource = readFileSync(join(appRoot, "components", "sidebar.tsx"), "utf8");
    const shellSource = readFileSync(join(appRoot, "app", "app", "layout.tsx"), "utf8");

    expect(sidebarSource).toContain("lg:hidden");
    expect(sidebarSource).toContain("overflow-y-auto");
    expect(shellSource).toContain("overflow-x-clip");
  });
});
