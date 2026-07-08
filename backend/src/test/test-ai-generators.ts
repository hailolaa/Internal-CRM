import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
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

async function sendJson(baseUrl: string, path: string, token: string, body: unknown = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload: any = await response.json();
  return { response, body: payload };
}

async function getJson(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload: any = await response.json();
  return { response, body: payload };
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("AI generator endpoints save tenant-scoped deterministic runs", async () => {
  await testConnection();
  console.log("[ai-generators] database connection OK");

  const originalOpenAi = {
    apiKey: config.openai.apiKey,
    insightsEnabled: config.openai.insightsEnabled,
  };
  (config as any).openai.insightsEnabled = false;
  (config as any).openai.apiKey = "";

  const primary = await createClinicAndAdmin("AiGeneratorsPrimary");
  const secondary = await createClinicAndAdmin("AiGeneratorsSecondary");
  const contactId = uuidv4();
  const appointmentId = uuidv4();
  const competitorId = uuidv4();
  const spendId = uuidv4();
  const consultId = uuidv4();

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start AI generator test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    await pool.execute(
      `INSERT INTO contact
        (id, clinic_id, email, first_name, last_name, phone, source, status, value, treatment_interests)
       VALUES (?, ?, ?, 'AI', 'Patient', '555-0101', 'google_ads', 'New', 2500, CAST(? AS JSON))`,
      [contactId, primary.clinicId, uniqueEmail("ai_generator_patient"), JSON.stringify(["Implants"])],
    );
    await pool.execute(
      `INSERT INTO appointment
        (id, clinic_id, contact_id, clinician_id, date_time, status, treatment, value, duration_minutes, created_by)
       VALUES (?, ?, ?, NULL, '2026-07-01 10:00:00', 'Scheduled', 'Implants', 2500, 45, ?)`,
      [appointmentId, primary.clinicId, contactId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO manual_spend_entry
        (id, clinic_id, source, channel, campaign, amount, period, start_date, end_date, attribution_label, created_by)
       VALUES (?, ?, 'google_ads', 'paid_search', 'AI Generator Test', 500, 'June 2026', '2026-06-01', '2026-06-30', 'manual', ?)`,
      [spendId, primary.clinicId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO manual_consult_entry
        (id, clinic_id, contact_id, patient_name, treatment, practitioner, outcome, revenue, consult_date, created_by)
       VALUES (?, ?, ?, 'AI Patient', 'Implants', 'Dr Test', 'Treatment Booked', 2500, '2026-06-15', ?)`,
      [consultId, primary.clinicId, contactId, primary.userId],
    );
    await pool.execute(
      `INSERT INTO competitor
        (id, clinic_id, name, url, key_treatments, price_position, offer, messaging_angle, ad_presence, seo_strength, rating, reviews, created_by)
       VALUES (?, ?, 'AI Competitor', 'https://example.com', CAST(? AS JSON), 'Premium', 'Free consult', 'Premium implants', CAST(? AS JSON), 'Strong', 4.8, 150, ?)`,
      [competitorId, primary.clinicId, JSON.stringify(["Implants"]), JSON.stringify(["google_ads"]), primary.userId],
    );

    const endpoints = [
      {
        path: "/api/ai/show-rate/generate",
        payload: { startDate: "2026-06-26", endDate: "2026-07-31" },
        agentKey: "show_rate",
        outputCheck: (output: any) => assert.equal(output.summary.totalAppointments, 1),
      },
      {
        path: "/api/ai/sales-assistant/generate",
        payload: { contactId, context: "Asked about implants after seeing a Google ad." },
        agentKey: "sales_assistant",
        outputCheck: (output: any) => assert.equal(output.lead.contactId, contactId),
      },
      {
        path: "/api/ai/campaign-analyst/generate",
        payload: { googleSpend: 500, leads: 10, bookings: 3, revenue: 2500 },
        agentKey: "campaign_analyst",
        outputCheck: (output: any) => assert.equal(output.metrics.roas, 5),
      },
      {
        path: "/api/ai/ltv-optimiser/generate",
        payload: { startDate: "2026-06-01", endDate: "2026-06-30" },
        agentKey: "ltv_optimiser",
        outputCheck: (output: any) => assert.equal(output.summary.totalTreatmentRevenue, 2500),
      },
      {
        path: "/api/ai/competitor-insights/generate",
        payload: { competitorIds: [competitorId] },
        agentKey: "competitor_insights",
        outputCheck: (output: any) => assert.equal(output.marketPosition.competitors, 1),
      },
    ];

    for (const endpoint of endpoints) {
      const result = await sendJson(baseUrl, endpoint.path, primary.token, endpoint.payload);
      assert.equal(result.response.status, 201, endpoint.path);
      assert.equal(result.body.data.agentKey, endpoint.agentKey);
      assert.equal(result.body.data.status, "success");
      assert.equal(result.body.data.output.provenance.provider, "deterministic");
      assert.equal(result.body.data.output.provenance.openAiRequired, false);
      assert.equal(result.body.data.output.provenance.clinicScoped, true);
      assert.equal(result.body.data.output.provenance.mockData, false);
      endpoint.outputCheck(result.body.data.output);

      const history = await getJson(baseUrl, `/api/ai/runs?agentKey=${endpoint.agentKey}`, primary.token);
      assert.equal(history.response.status, 200);
      assert.equal(history.body.data.some((run: any) => run.id === result.body.data.id), true);

      const secondaryHistory = await getJson(baseUrl, `/api/ai/runs?agentKey=${endpoint.agentKey}`, secondary.token);
      assert.equal(secondaryHistory.response.status, 200);
      assert.equal(secondaryHistory.body.data.some((run: any) => run.id === result.body.data.id), false);
    }

    console.log("[ai-generators] generator endpoint and tenant scope checks passed");
  } finally {
    (config as any).openai.insightsEnabled = originalOpenAi.insightsEnabled;
    (config as any).openai.apiKey = originalOpenAi.apiKey;
    await closeServer(server);
    await pool.execute("UPDATE ai_run SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id IN (?, ?)", [primary.clinicId, secondary.clinicId]);
    await pool.execute("UPDATE competitor SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [competitorId]);
    await pool.execute("UPDATE manual_consult_entry SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [consultId]);
    await pool.execute("UPDATE manual_spend_entry SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [spendId]);
    await pool.execute("UPDATE appointment SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [appointmentId]);
    await pool.execute("UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?", [contactId]);
    await pool.end();
  }
});
