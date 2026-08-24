import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const detailPageSource = readFileSync(new URL("./page.tsx", import.meta.url), "utf8");
const apiClientSource = readFileSync(new URL("../../../../../lib/api-client/internal-ops-api.ts", import.meta.url), "utf8");
const apiTypesSource = readFileSync(new URL("../../../../../lib/api-types/operations/internal-ops.ts", import.meta.url), "utf8");

describe("client account communication history", () => {
  it("adds a client-account communication tab to the detail page", () => {
    expect(detailPageSource).toContain("Communication history");
    expect(detailPageSource).toContain("account-communication");
    expect(detailPageSource).toContain("Email, WhatsApp, SMS, calls, recordings and transcripts");
    expect(detailPageSource).toContain("AI-ready client context");
  });

  it("loads communication history from the client account API", () => {
    expect(detailPageSource).toContain("api.clientAccounts.getCommunicationHistory(token, clinicId)");
    expect(detailPageSource).toContain("refreshCommunicationHistory");
    expect(apiClientSource).toContain("getCommunicationHistory");
    expect(apiClientSource).toContain("/communication-history");
    expect(apiClientSource).toContain("buildQuery(params)");
  });

  it("keeps proof of the required channels and call intelligence in the shared type contract", () => {
    expect(apiTypesSource).toContain('\"email\" | \"sms\" | \"whatsapp\" | \"call\"');
    expect(apiTypesSource).toContain("recordingUrl: string | null");
    expect(apiTypesSource).toContain("transcript: string | null");
    expect(apiTypesSource).toContain("aiContext");
    expect(apiTypesSource).toContain("searchableText");
  });
});
