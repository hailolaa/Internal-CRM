import assert from "node:assert/strict";
import test from "node:test";
import pool from "../config/database.js";
import { analyticsQualityService } from "../modules/analytics-store/analytics-quality.service.js";
import { analyticsStoreService } from "../modules/analytics-store/analytics-store.service.js";
import { fleetIngestionService } from "../modules/fleet-ingestion/fleet-ingestion.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("analytics backfill checkpoints are resumable and source scoped", async () => {
  const clinic = await createTestClinicAndAdmin("analytics-backfill");
  const source = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `backfill-source-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "history",
    sourceLabel: "Clinic OS history",
    dataState: "live",
  });

  const run = await analyticsQualityService.startBackfill({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    backfillKey: "clinic_os_history",
    cursor: "cursor-001",
  });
  const checkpoint = await analyticsQualityService.updateBackfillCheckpoint(clinic.clinicId, "clinic_os_history", {
    cursor: "cursor-002",
    recordsSeen: 20,
    recordsWritten: 18,
    recordsQuarantined: 2,
  });
  const completed = await analyticsQualityService.updateBackfillCheckpoint(clinic.clinicId, "clinic_os_history", {
    status: "completed",
    recordsSeen: 0,
  });

  assert.equal(run.status, "running");
  assert.equal(checkpoint.cursor, "cursor-002");
  assert.equal(checkpoint.recordsSeen, 20);
  assert.equal(checkpoint.recordsWritten, 18);
  assert.equal(checkpoint.recordsQuarantined, 2);
  assert.equal(completed.status, "completed");
  assert.equal(completed.cursor, "cursor-002");
});

test("analytics reconciliation records missing facts and exposes lineage for present facts", async () => {
  const clinic = await createTestClinicAndAdmin("analytics-reconcile");
  const source = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `reconcile-source-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "summary",
    sourceLabel: "Clinic OS summary",
    dataState: "live",
  });
  const event = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "summary",
    sourceEntity: "summary",
    sourceRecordId: "summary-001",
    providerEventId: "reconcile-event-001",
    payload: { leads: 11 },
  });
  const fact = await analyticsStoreService.recordFact({
    clinicId: clinic.clinicId,
    metricKey: "lead_count",
    grain: "daily",
    grainDate: "2026-08-20",
    metricValue: 11,
    dimensions: { channel: "google_ads" },
    provenance: "connector",
    sourceId: source.id,
    sourceEventId: event.id,
  });

  const issues = await analyticsQualityService.reconcileExpectedFacts({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    expectedFacts: [
      { metricKey: "lead_count", grain: "daily", grainDate: "2026-08-20", dimensions: { channel: "google_ads" } },
      { metricKey: "booked_consults", grain: "daily", grainDate: "2026-08-20", dimensions: { channel: "google_ads" } },
    ],
  });
  const lineage = await analyticsQualityService.getFactLineage(clinic.clinicId, fact.id);

  assert.equal(issues.length, 1);
  assert.equal(issues[0]?.issueType, "missing_fact");
  assert.match(issues[0]?.entityKey || "", /booked_consults/);
  assert.equal(lineage.sourceId, source.id);
  assert.equal(lineage.sourceEventId, event.id);
  assert.equal(lineage.providerEventId, "reconcile-event-001");
});

test("analytics freshness creates and resolves stale-source alerts", async () => {
  const clinic = await createTestClinicAndAdmin("analytics-freshness");
  const source = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `freshness-source-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "freshness",
    sourceLabel: "Clinic OS freshness",
    dataState: "live",
  });
  const event = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "freshness",
    sourceEntity: "summary",
    sourceRecordId: "freshness-001",
    providerEventId: "freshness-event-001",
    payload: { ok: true },
  });
  await fleetIngestionService.markEventProcessed(clinic.clinicId, event.id, { checkpoint: "freshness-cursor" });

  await pool.execute(
    `UPDATE fleet_ingestion_checkpoint
     SET last_processed_event_at = DATE_SUB(UTC_TIMESTAMP(), INTERVAL 2 HOUR)
     WHERE clinic_id = ? AND source_id = ?`,
    [clinic.clinicId, source.id],
  );
  const stale = await analyticsQualityService.assessFreshness({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    thresholdMinutes: 30,
  });
  await pool.execute(
    `UPDATE fleet_ingestion_checkpoint
     SET last_processed_event_at = UTC_TIMESTAMP()
     WHERE clinic_id = ? AND source_id = ?`,
    [clinic.clinicId, source.id],
  );
  const healthy = await analyticsQualityService.assessFreshness({
    clinicId: clinic.clinicId,
    sourceId: source.id,
    thresholdMinutes: 30,
  });
  const [rows]: any = await pool.execute(
    `SELECT status FROM analytics_freshness_alert WHERE id = ?`,
    [stale.alertId],
  );

  assert.equal(stale.status, "stale");
  assert.ok(stale.alertId);
  assert.equal(healthy.status, "healthy");
  assert.equal(rows[0].status, "resolved");
});
