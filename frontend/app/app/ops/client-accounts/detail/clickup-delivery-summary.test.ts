import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const apiSource = readFileSync(new URL("../../../../../lib/api-client/clickup-api.ts", import.meta.url), "utf8");
const typeSource = readFileSync(new URL("../../../../../lib/api-types/clickup.ts", import.meta.url), "utf8");

describe("client ClickUp delivery summary", () => {
  it("loads the latest provision and exposes checkpoints and the ClickUp source link", () => {
    expect(typeSource).toContain("ClickUpDeliveryProvisionRecord");
    expect(apiSource).toContain("getClientDeliveryProvision");
    expect(pageSource).toContain(".getClientDeliveryProvision(token, account.id)");
    expect(pageSource).toContain("ClickUp delivery structure");
    expect(pageSource).toContain("Delivery list");
    expect(pageSource).toContain("Open in ClickUp");
  });
});
