import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { apiKeysService } from "../modules/api-keys/api-keys.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
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

  const primary = await createTestClinicAndAdmin("IntegrationInputsPrimary");
  const secondary = await createTestClinicAndAdmin("IntegrationInputsSecondary");
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
  const freelancerEventPrefix = `cg161-${Date.now()}`;

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

    const templateResponse = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-report-templates", primary.token);
    assert.equal(templateResponse.response.status, 200);
    const workTypes = templateResponse.body.data.map((template: any) => template.workType).sort();
    assert.deepEqual(workTypes, ["design_video", "gbp", "ppc", "reporting", "seo", "wordpress_development"]);
    console.log("[integration-inputs] freelancer report templates passed");

    for (const workType of workTypes) {
      const accepted = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-reports", primary.token, {
        method: "POST",
        body: JSON.stringify({
          workType,
          sourceEventId: `${freelancerEventPrefix}-${workType}-accepted`,
          reportTitle: `${workType} accepted report`,
          accountLabel: "ClinicGrower test account",
          reportingPeriodStart: "2026-08-01",
          reportingPeriodEnd: "2026-08-31",
          metrics: [
            { name: "leads", value: 12, unit: "count", baseline: 8, target: 15 },
          ],
          evidence: [
            {
              label: "Work evidence",
              url: "https://example.com/evidence",
              workPerformed: "Updated the account, checked the baseline and recorded the expected result.",
              rationale: "Supports the accepted QA path.",
              expectedResult: "Improved visibility and cleaner reporting.",
              accountOrPage: "Test account",
            },
          ],
          risks: ["No material risk in test case"],
          recommendedActions: ["Keep monitoring next period"],
          sourceLinks: ["https://example.com/source"],
          qaStatus: "accepted",
          verificationDate: "2026-09-01",
        }),
      });
      assert.equal(accepted.response.status, 201);
      assert.equal(accepted.body.data.created, true);
      assert.equal(accepted.body.data.report.qaStatus, "accepted");

      const rejected = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-reports", primary.token, {
        method: "POST",
        body: JSON.stringify({
          workType,
          sourceEventId: `${freelancerEventPrefix}-${workType}-rejected`,
          reportTitle: `${workType} rejected report`,
          reportingPeriodStart: "2026-08-01",
          reportingPeriodEnd: "2026-08-31",
          metrics: [
            { name: "leads", value: 4, unit: "count" },
          ],
          evidence: [
            {
              label: "Incomplete evidence",
              workPerformed: "Work was claimed but the source did not prove it.",
            },
          ],
          risks: ["Missing source proof"],
          recommendedActions: ["Return for evidence"],
          sourceLinks: ["https://example.com/rejected-source"],
          qaStatus: "rejected",
          qaNotes: "Rejected because the submitted evidence does not support the claim.",
        }),
      });
      assert.equal(rejected.response.status, 201);
      assert.equal(rejected.body.data.report.needsRework, true);
    }

    const awaitingEvidence = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-reports", primary.token, {
      method: "POST",
      body: JSON.stringify({
        workType: "ppc",
        sourceEventId: `${freelancerEventPrefix}-awaiting-evidence`,
        reportTitle: "PPC missing evidence",
        reportingPeriodStart: "2026-08-01",
        reportingPeriodEnd: "2026-08-31",
        metrics: [{ name: "spend", value: 1000, unit: "gbp" }],
        evidence: [{ label: "Claimed account update" }],
        risks: [],
        recommendedActions: [],
      }),
    });
    assert.equal(awaitingEvidence.response.status, 201);
    assert.equal(awaitingEvidence.body.data.report.qaStatus, "awaiting_evidence");

    const awaitingQa = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-reports", primary.token, {
      method: "POST",
      body: JSON.stringify({
        workType: "seo",
        sourceEventId: `${freelancerEventPrefix}-awaiting-qa`,
        reportTitle: "SEO awaiting QA",
        reportingPeriodStart: "2026-08-01",
        reportingPeriodEnd: "2026-08-31",
        metrics: [{ name: "priority_keywords", value: 5, unit: "count" }],
        evidence: [
          {
            label: "Search visibility evidence",
            url: "https://example.com/seo-evidence",
            workPerformed: "Optimised the priority page and supplied a before/after screenshot.",
          },
        ],
        sourceLinks: ["https://example.com/seo-source"],
      }),
    });
    assert.equal(awaitingQa.response.status, 201);
    assert.equal(awaitingQa.body.data.report.qaStatus, "awaiting_qa");

    const duplicateAccepted = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-reports", primary.token, {
      method: "POST",
      body: JSON.stringify({
        workType: "ppc",
        sourceEventId: `${freelancerEventPrefix}-ppc-accepted`,
        reportTitle: "Duplicate PPC accepted report",
        reportingPeriodStart: "2026-08-01",
        reportingPeriodEnd: "2026-08-31",
        metrics: [{ name: "leads", value: 99 }],
        evidence: [{ label: "Duplicate", workPerformed: "Duplicate retry" }],
        sourceLinks: ["https://example.com/source"],
        qaStatus: "accepted",
      }),
    });
    assert.equal(duplicateAccepted.response.status, 200);
    assert.equal(duplicateAccepted.body.data.created, false);

    const freelancerReports = await fetchJson(baseUrl, "/api/integration-inputs/freelancer-reports", primary.token);
    assert.equal(freelancerReports.response.status, 200);
    assert.equal(freelancerReports.body.data.summary.accepted, 6);
    assert.equal(freelancerReports.body.data.summary.rejected, 6);
    assert.equal(freelancerReports.body.data.summary.awaitingEvidence, 1);
    assert.equal(freelancerReports.body.data.summary.awaitingQa, 1);
    assert.equal(freelancerReports.body.data.summary.reworkRate, 0.5);
    assert.deepEqual(freelancerReports.body.data.summary.workTypesCovered, workTypes);

    const secondaryFreelancerReports = await fetchJson(
      baseUrl,
      "/api/integration-inputs/freelancer-reports",
      secondary.token,
    );
    assert.equal(secondaryFreelancerReports.response.status, 200);
    assert.equal(secondaryFreelancerReports.body.data.summary.total, 0);
    console.log("[integration-inputs] freelancer report QA controls passed");

    console.log("[integration-inputs] integration test completed successfully");
  } finally {
    await pool.execute(
      `DELETE FROM freelancer_report_review WHERE clinic_id = ? AND source_event_id LIKE ?`,
      [primary.clinicId, `${freelancerEventPrefix}%`],
    );
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
