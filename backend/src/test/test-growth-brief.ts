import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import { config } from "../config/index.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: uniqueEmail(`${prefix}_admin`),
    adminPassword: "password123",
    firstName: prefix,
    lastName: "Admin",
    phone: "555-0100",
  });

  return {
    clinicId: result.user.clinicId,
    userId: result.user.id,
    token: result.tokens.token,
  };
}

async function fetchJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("Growth Brief runs are tenant-scoped and live generation returns controlled unavailable state without OpenAI", async () => {
  await testConnection();
  console.log("[growth-brief] database connection OK");

  const originalOpenAi = {
    apiKey: config.openai.apiKey,
    insightsEnabled: config.openai.insightsEnabled,
  };
  (config as any).openai.insightsEnabled = false;
  (config as any).openai.apiKey = "";

  const primary = await createClinicAndAdmin("GrowthBriefPrimary");
  const secondary = await createClinicAndAdmin("GrowthBriefSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start Growth Brief test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let primaryRunId = "";
  let secondaryRunId = "";

  try {
    const primaryRun = await fetchJson(baseUrl, "/api/ai/runs", primary.token, {
      method: "POST",
      body: JSON.stringify({
        agentName: "Growth Brief",
        agentKey: "growth_brief",
        task: "Saved Growth Brief",
        input: JSON.stringify({ range: { startDate: "2026-06-01", endDate: "2026-06-30" } }),
        output: {
          summary: "Saved real backend run",
          recommendations: ["Review leakage follow-up"],
          provenance: { mockData: false },
        },
        status: "success",
      }),
    });
    assert.equal(primaryRun.response.status, 201);
    primaryRunId = primaryRun.body.data.id;

    const secondaryRun = await fetchJson(baseUrl, "/api/ai/runs", secondary.token, {
      method: "POST",
      body: JSON.stringify({
        agentName: "Growth Brief",
        agentKey: "growth_brief",
        task: "Secondary Growth Brief",
        output: { summary: "Secondary run", recommendations: ["Do not leak"] },
        status: "success",
      }),
    });
    assert.equal(secondaryRun.response.status, 201);
    secondaryRunId = secondaryRun.body.data.id;
    console.log("[growth-brief] saved run setup passed");

    const history = await fetchJson(baseUrl, "/api/ai/runs?agentKey=growth_brief", primary.token);
    assert.equal(history.response.status, 200);
    assert.equal(history.body.data.some((run: any) => run.id === primaryRunId), true);
    assert.equal(history.body.data.some((run: any) => run.id === secondaryRunId), false);
    assert.equal(history.body.data[0].agentKey, "growth_brief");
    assert.equal(history.body.data.find((run: any) => run.id === primaryRunId).output.provenance.mockData, false);
    console.log("[growth-brief] saved run history tenant scope passed");

    const unavailable = await fetchJson(baseUrl, "/api/ai/growth-brief/generate", primary.token, {
      method: "POST",
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      }),
    });
    assert.equal(unavailable.response.status, 503);
    assert.equal(unavailable.body.status, "error");
    assert.match(unavailable.body.message, /Growth Brief generation is unavailable/);
    assert.equal(unavailable.body.errors.code, "openai_disabled");
    console.log("[growth-brief] controlled OpenAI unavailable state passed");

    (config as any).openai.insightsEnabled = true;
    const missingKey = await fetchJson(baseUrl, "/api/ai/growth-brief/generate", primary.token, {
      method: "POST",
      body: JSON.stringify({
        startDate: "2026-06-01",
        endDate: "2026-06-30",
      }),
    });
    assert.equal(missingKey.response.status, 503);
    assert.equal(missingKey.body.status, "error");
    assert.match(missingKey.body.message, /OpenAI is not configured/);
    assert.equal(missingKey.body.errors.code, "missing_openai_api_key");
    console.log("[growth-brief] controlled missing OpenAI key state passed");

    console.log("[growth-brief] integration test completed successfully");
  } finally {
    (config as any).openai.insightsEnabled = originalOpenAi.insightsEnabled;
    (config as any).openai.apiKey = originalOpenAi.apiKey;
    await closeServer(server);

    await pool.execute("UPDATE ai_run SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (?, ?)", [
      primaryRunId || "missing",
      secondaryRunId || "missing",
    ]);
    await pool.end();
  }
});
