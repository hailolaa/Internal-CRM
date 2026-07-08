import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { apiKeysService } from "../modules/api-keys/api-keys.service.js";
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

async function fetchApiKeyJson(baseUrl: string, path: string, apiKey: string, body: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const responseBody: any = await response.json();
  return { response, body: responseBody };
}

function parseJsonColumn(value: unknown) {
  if (!value) return {};
  if (typeof value === "object") return value as Record<string, unknown>;
  return JSON.parse(String(value)) as Record<string, unknown>;
}

test("Phase 1 integration inputs ingest leads, store manual metrics, expose setup/package/AI contracts, and keep tenant scope", async () => {
  await testConnection();
  console.log("[integration-inputs] database connection OK");

  const primary = await createClinicAndAdmin("IntegrationInputsPrimary");
  const secondary = await createClinicAndAdmin("IntegrationInputsSecondary");
  const apiKey = await apiKeysService.createApiKey(primary.clinicId, primary.userId, {
    name: "Integration inputs test",
  });
  assert.ok(apiKey.key);

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start integration inputs test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let metaContactId = "";
  let manualContactId = "";
  let metricId = "";

  try {
    const metaLead = await fetchApiKeyJson(
      baseUrl,
      "/api/integration-inputs/public/meta-leads",
      apiKey.key!,
      {
        eventId: `meta-${Date.now()}`,
        fullName: "Meta Phase Lead",
        email: uniqueEmail("meta_phase_lead"),
        phone: "+1 555 810 1100",
        source: "meta_ads",
        treatmentInterest: "Dental Implants",
        rawPayload: {
          platform: "meta",
          leadgen_id: `lg-${Date.now()}`,
          form_id: "form-123",
        },
      },
    );
    assert.equal(metaLead.response.status, 201);
    metaContactId = metaLead.body.data.contactId;
    assert.ok(metaContactId);
    console.log("[integration-inputs] Meta/API-key lead ingestion passed");

    const [rawLeadRows]: any = await pool.execute(
      `SELECT linked_entity_id as linkedEntityId, status, payload
       FROM integration_raw_payload
       WHERE clinic_id = ? AND source = 'meta_lead_form' AND linked_entity_id = ?
       LIMIT 1`,
      [primary.clinicId, metaContactId],
    );
    assert.equal(rawLeadRows.length, 1);
    assert.equal(rawLeadRows[0].status, "processed");
    assert.equal(parseJsonColumn(rawLeadRows[0].payload).platform, "meta");
    console.log("[integration-inputs] raw lead payload storage passed");

    const manualLead = await fetchJson(baseUrl, "/api/integration-inputs/manual-leads", primary.token, {
      method: "POST",
      body: JSON.stringify({
        firstName: "Manual",
        lastName: "Import",
        email: uniqueEmail("manual_import_lead"),
        source: "website_referral",
        status: "New",
        treatmentInterests: ["Invisalign"],
        notes: "Manual Phase 1 fallback lead",
      }),
    });
    assert.equal(manualLead.response.status, 201);
    manualContactId = manualLead.body.data.contactId;
    assert.ok(manualContactId);
    console.log("[integration-inputs] manual lead ingestion passed");

    const metric = await fetchJson(baseUrl, "/api/integration-inputs/manual-metrics", primary.token, {
      method: "POST",
      body: JSON.stringify({
        platform: "google_ads",
        metricDate: new Date().toISOString(),
        campaign: "Implants Search",
        metricName: "clicks",
        metricValue: 42,
        unit: "count",
        attributionLabel: "manual_google_export",
        rawPayload: { sourceFile: "google-ads-export.csv" },
      }),
    });
    assert.equal(metric.response.status, 201);
    metricId = metric.body.data.id;
    console.log("[integration-inputs] manual platform metric create passed");

    const primaryMetrics = await fetchJson(
      baseUrl,
      "/api/integration-inputs/manual-metrics?platform=google_ads&metricName=clicks",
      primary.token,
    );
    assert.equal(primaryMetrics.response.status, 200);
    assert.equal(primaryMetrics.body.data.some((item: any) => item.id === metricId), true);

    const secondaryMetrics = await fetchJson(
      baseUrl,
      "/api/integration-inputs/manual-metrics?platform=google_ads&metricName=clicks",
      secondary.token,
    );
    assert.equal(secondaryMetrics.response.status, 200);
    assert.equal(secondaryMetrics.body.data.some((item: any) => item.id === metricId), false);
    console.log("[integration-inputs] manual metrics filters and tenant scope passed");

    const setupAudit = await fetchJson(baseUrl, "/api/integration-inputs/setup-audit", primary.token);
    assert.equal(setupAudit.response.status, 200);
    assert.equal(setupAudit.body.data.metaLeadForms.endpoint, "/api/integration-inputs/public/meta-leads");
    assert.equal(setupAudit.body.data.manualMetrics.status, "ready");
    console.log("[integration-inputs] setup audit contract passed");

    const packageSummary = await fetchJson(baseUrl, "/api/integration-inputs/stripe/package-summary", primary.token);
    assert.equal(packageSummary.response.status, 200);
    assert.ok(packageSummary.body.data.billing);
    assert.ok(Array.isArray(packageSummary.body.data.services));
    console.log("[integration-inputs] Stripe package bridge passed");

    const aiPreview = await fetchJson(baseUrl, "/api/integration-inputs/openai/summary-preview", primary.token, {
      method: "POST",
      body: JSON.stringify({
        promptType: "owner_dashboard",
        context: {
          enquiries: 12,
          bookedConsults: 5,
          estimatedRevenue: 24000,
        },
      }),
    });
    assert.equal(aiPreview.response.status, 200);
    assert.ok(aiPreview.body.data.summary.includes("owner_dashboard"));
    assert.ok(["placeholder", "openai_ready"].includes(aiPreview.body.data.provider));
    console.log("[integration-inputs] OpenAI summary interface passed");

    console.log("[integration-inputs] integration test completed successfully");
  } finally {
    if (metricId) {
      await pool.execute(
        `UPDATE manual_platform_metric SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`,
        [primary.clinicId, metricId],
      );
    }
    await pool.execute(
      `DELETE FROM integration_raw_payload WHERE clinic_id = ? AND linked_entity_id IN (?, ?)`,
      [primary.clinicId, metaContactId || "none", manualContactId || "none"],
    );
    await pool.execute(
      `DELETE FROM integration_raw_payload WHERE clinic_id = ? AND source IN ('manual_metric:google_ads', 'openai_summary_preview')`,
      [primary.clinicId],
    );
    if (metaContactId) {
      await pool.execute(
        `UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`,
        [primary.clinicId, metaContactId],
      );
    }
    if (manualContactId) {
      await pool.execute(
        `UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`,
        [primary.clinicId, manualContactId],
      );
    }
    if (apiKey.id) {
      await pool.execute(`UPDATE api_key SET revoked_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ?`, [
        primary.clinicId,
        apiKey.id,
      ]);
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }
});
