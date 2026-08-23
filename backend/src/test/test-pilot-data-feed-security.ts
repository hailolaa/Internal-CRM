import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { analyticsQualityService } from "../modules/analytics-store/analytics-quality.service.js";
import { analyticsStoreService } from "../modules/analytics-store/analytics-store.service.js";
import { pilotDataFeedSecurityService } from "../modules/analytics-store/pilot-data-feed-security.service.js";
import { fleetIngestionService } from "../modules/fleet-ingestion/fleet-ingestion.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("pilot security review passes only with tenant isolation, clean reconciliation and fresh feeds", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("pilot-review");
  const source = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `pilot-review-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "pilot_feed",
    sourceLabel: "Pilot feed",
    dataState: "live",
  });
  const event = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "pilot_feed",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    providerEventId: "pilot-event-001",
    payload: { leadId: "lead-001" },
  });
  await fleetIngestionService.markEventProcessed(clinic.clinicId, event.id, { checkpoint: "pilot-cursor-001" });
  await analyticsStoreService.recordFact({
    clinicId: clinic.clinicId,
    metricKey: "pilot.leads",
    grain: "daily",
    grainDate: "2026-08-24",
    metricValue: 1,
    unit: "count",
    dimensions: { source: "pilot" },
    provenance: "connector",
    sourceId: source.id,
    sourceEventId: event.id,
  });

  const passed = await pilotDataFeedSecurityService.runSecurityReview({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    reviewedBy: "Haile Michael",
  });

  await analyticsQualityService.reconcileExpectedFacts({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    expectedFacts: [{ metricKey: "pilot.missing", grain: "daily", grainDate: "2026-08-24", dimensions: { source: "pilot" } }],
  });
  const failed = await pilotDataFeedSecurityService.runSecurityReview({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    reviewedBy: "Haile Michael",
  });

  assert.equal(passed.reviewStatus, "passed");
  assert.equal(passed.tenantIsolationStatus, "passed");
  assert.equal(passed.reconciliationStatus, "passed");
  assert.equal(passed.freshnessStatus, "passed");
  assert.equal(failed.reviewStatus, "failed");
  assert.equal(failed.reconciliationStatus, "failed");
});

test("pilot erasure removes source traces without deleting another tenant data", async () => {
  const clinicA = await createTestClinicAndAdmin("pilot-erasure-a");
  const clinicB = await createTestClinicAndAdmin("pilot-erasure-b");
  const sourceA = await fleetIngestionService.configureSource({
    clinicId: clinicA.clinicId,
    tenantKey: `pilot-erasure-a-${clinicA.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "shared_feed",
    sourceLabel: "Shared feed A",
    dataState: "live",
  });
  const sourceB = await fleetIngestionService.configureSource({
    clinicId: clinicB.clinicId,
    tenantKey: `pilot-erasure-b-${clinicB.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "shared_feed",
    sourceLabel: "Shared feed B",
    dataState: "live",
  });
  const eventA = await fleetIngestionService.ingestEvent({
    clinicId: clinicA.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "shared_feed",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    providerEventId: "pilot-erase-a",
    payload: { leadId: "lead-001" },
  });
  const eventB = await fleetIngestionService.ingestEvent({
    clinicId: clinicB.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "shared_feed",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    providerEventId: "pilot-erase-b",
    payload: { leadId: "lead-001" },
  });
  await fleetIngestionService.resolveIdentity({
    clinicId: clinicA.clinicId,
    sourceSystem: "clinic_os",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    targetType: "lead",
    targetId: "lead-a",
    confidence: "known",
  });
  await fleetIngestionService.resolveIdentity({
    clinicId: clinicB.clinicId,
    sourceSystem: "clinic_os",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    targetType: "lead",
    targetId: "lead-b",
    confidence: "known",
  });
  await fleetIngestionService.markEventProcessed(clinicA.clinicId, eventA.id, { checkpoint: "erase-a" });
  await fleetIngestionService.markEventProcessed(clinicB.clinicId, eventB.id, { checkpoint: "erase-b" });
  await analyticsStoreService.recordFact({
    clinicId: clinicA.clinicId,
    metricKey: "pilot.erase.leads",
    grain: "daily",
    grainDate: "2026-08-24",
    metricValue: 1,
    unit: "count",
    dimensions: { tenant: "a" },
    provenance: "connector",
    sourceId: sourceA.id,
    sourceEventId: eventA.id,
  });
  await analyticsStoreService.recordFact({
    clinicId: clinicB.clinicId,
    metricKey: "pilot.erase.leads",
    grain: "daily",
    grainDate: "2026-08-24",
    metricValue: 1,
    unit: "count",
    dimensions: { tenant: "b" },
    provenance: "connector",
    sourceId: sourceB.id,
    sourceEventId: eventB.id,
  });
  await analyticsQualityService.startBackfill({ clinicId: clinicA.clinicId, sourceId: sourceA.id, backfillKey: "pilot-erasure" });
  await analyticsQualityService.reconcileExpectedFacts({
    clinicId: clinicA.clinicId,
    sourceId: sourceA.id,
    expectedFacts: [{ metricKey: "pilot.erase.missing", grain: "daily", grainDate: "2026-08-24", dimensions: { tenant: "a" } }],
  });
  await pilotDataFeedSecurityService.runSecurityReview({
    clinicId: clinicA.clinicId,
    sourceId: sourceA.id,
    reviewedBy: "Haile Michael",
  });

  const erased = await pilotDataFeedSecurityService.eraseSourceData({
    clinicId: clinicA.clinicId,
    sourceId: sourceA.id,
    reason: "Pilot erasure verification",
  });
  const remainingTotal = Object.values(erased.remainingTraces).reduce((sum, count) => sum + count, 0);
  const [tenantBEvents]: any = await pool.execute(
    `SELECT COUNT(*) as count FROM fleet_ingestion_event WHERE clinic_id = ? AND source_id = ?`,
    [clinicB.clinicId, sourceB.id],
  );
  const [tenantBIdentity]: any = await pool.execute(
    `SELECT COUNT(*) as count FROM fleet_identity_mapping WHERE clinic_id = ? AND target_id = 'lead-b'`,
    [clinicB.clinicId],
  );

  assert.equal(remainingTotal, 0);
  assert.equal(erased.deleted.fleetIngestionSources, 1);
  assert.equal(erased.deleted.analyticsMetricFacts, 1);
  assert.equal(Number(tenantBEvents[0].count), 1);
  assert.equal(Number(tenantBIdentity[0].count), 1);
});
