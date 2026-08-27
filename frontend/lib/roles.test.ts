import { describe, expect, it } from "vitest";
import { getPermissionsForRole } from "./roles";

describe("Mission Control least-privilege role matrix", () => {
  it("keeps privileged capabilities with the roles that own them", () => {
    expect(getPermissionsForRole("SUPER_ADMIN")).toEqual(["*"]);
    expect(getPermissionsForRole("ADMIN")).toEqual(expect.arrayContaining([
      "settings:write",
      "team:write",
      "billing:write",
      "proposal_templates:approve",
    ]));
    expect(getPermissionsForRole("SALES")).toEqual(expect.arrayContaining([
      "contacts:write",
      "proposals:write",
    ]));
    expect(getPermissionsForRole("DELIVERY")).toEqual(expect.arrayContaining([
      "internal_tasks:write",
      "strategy_logs:write",
    ]));
    expect(getPermissionsForRole("FINANCE")).toEqual(expect.arrayContaining([
      "billing:write",
      "reports:write",
      "audit:read",
    ]));
  });

  it("prevents finance, delivery, sales and read-only privilege escalation", () => {
    for (const permission of [
      "contacts:write",
      "proposals:write",
      "settings:write",
      "team:write",
    ]) expect(getPermissionsForRole("FINANCE")).not.toContain(permission);
    for (const permission of [
      "billing:write",
      "proposals:write",
      "team:write",
    ]) expect(getPermissionsForRole("DELIVERY")).not.toContain(permission);
    for (const permission of [
      "billing:write",
      "proposal_templates:approve",
      "settings:write",
    ]) expect(getPermissionsForRole("SALES")).not.toContain(permission);
    const viewer = getPermissionsForRole("READ_ONLY");
    expect(viewer.some((permission) => permission.endsWith(":write") || permission.endsWith(":delete"))).toBe(false);
  });
});
