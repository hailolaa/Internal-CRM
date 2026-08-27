import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../../../../../lib/api-client/clickup-api.ts", import.meta.url), "utf8");
const typesSource = readFileSync(new URL("../../../../../lib/api-types/clickup.ts", import.meta.url), "utf8");

describe("ClickUp delivery provision recovery UI", () => {
  it("shows retry state and requeues failed provisions through the governed API", () => {
    expect(typesSource).toContain("ClickUpDeliveryProvisionFailure");
    expect(apiSource).toContain("listDeliveryProvisionFailures");
    expect(apiSource).toContain("retryDeliveryProvision");
    expect(pageSource).toContain("Delivery Provision Incidents");
    expect(pageSource).toContain("Checkpoint progress");
    expect(pageSource).toContain("Requeue provision");
    expect(pageSource).toContain("api.clickup.retryDeliveryProvision");
  });
});
