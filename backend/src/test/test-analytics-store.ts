import assert from "node:assert/strict";
import test from "node:test";
import { analyticsStoreService } from "../modules/analytics-store/analytics-store.service.js";
import { fleetIngestionService } from "../modules/fleet-ingestion/fleet-ingestion.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("analytics dimensions are tenant-scoped and idempotent", async () => {
  const clinicA = await createTestClinicAndAdmin("analytics-dim-a");
  const clinicB = await createTestClinicAndAdmin("analytics-dim-b");

  const first = await analyticsStoreService.upsertDimension({
    clinicId: clinicA.clinicId,
    dimensionType: "service_line",
    dimensionKey: "implants",
    label: "Implants",
    dataState: "live",
  });
  const updated = await analyticsStoreService.upsertDimension({
    clinicId: clinicA.clinicId,
    dimensionType: "service_line",
    dimensionKey: "implants",
    label: "Dental implants",
    dataState: "live",
  });
  const otherTenant = await analyticsStoreService.upsertDimension({
    clinicId: clinicB.clinicId,
    dimensionType: "service_line",
    dimensionKey: "implants",
    label: "Implants",
    dataState: "live",
  });

  assert.equal(first.id, updated.id);
  assert.equal(updated.label, "Dental implants");
  assert.notEqual(updated.id, otherTenant.id);
});

test("analytics facts are grain-correct, deterministic and carry source lineage", async () => {
  const clinic = await createTestClinicAndAdmin("analytics-fact");
  const source = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `analytics-source-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "account_summary",
    sourceLabel: "Clinic OS account summary",
    dataState: "live",
  });
  const event = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "account_summary",
    sourceEntity: "account_summary",
    sourceRecordId: "summary-001",
    providerEventId: "analytics-event-001",
    payload: { bookedConsults: 14 },
  });

  const first = await analyticsStoreService.recordFact({
    clinicId: clinic.clinicId,
    metricKey: "booked_consults",
    grain: "daily",
    grainDate: "2026-08-20",
    metricValue: 14,
    unit: "count",
    dimensions: { service_line: "implants", channel: "google_ads" },
    provenance: "connector",
    sourceId: source.id,
    sourceEventId: event.id,
  });
  const updated = await analyticsStoreService.recordFact({
    clinicId: clinic.clinicId,
    metricKey: "booked_consults",
    grain: "daily",
    grainDate: "2026-08-20",
    metricValue: 15,
    unit: "count",
    dimensions: { channel: "google_ads", service_line: "implants" },
    provenance: "connector",
    sourceId: source.id,
    sourceEventId: event.id,
  });
  const facts = await analyticsStoreService.listFacts(clinic.clinicId, {
    metricKey: "booked_consults",
    startDate: "2026-08-01",
    endDate: "2026-08-31",
  });

  assert.equal(first.id, updated.id);
  assert.equal(updated.metricValue, 15);
  assert.equal(updated.sourceId, source.id);
  assert.equal(updated.sourceEventId, event.id);
  assert.equal(facts.length, 1);
  assert.equal(facts[0]?.dimensionHash, updated.dimensionHash);
});

test("analytics snapshots preserve point-in-time metric sets", async () => {
  const clinic = await createTestClinicAndAdmin("analytics-snapshot");
  const snapshot = await analyticsStoreService.createSnapshot({
    clinicId: clinic.clinicId,
    snapshotKey: "monthly_growth_score",
    asOfDate: "2026-08-31",
    metricSet: {
      bookedConsults: 15,
      attendedConsults: 12,
      score: { visibility: 72, conversion: 65 },
    },
    sourceWatermark: {
      clinic_os: "cursor-2026-08-31",
    },
  });
  const updated = await analyticsStoreService.createSnapshot({
    clinicId: clinic.clinicId,
    snapshotKey: "monthly_growth_score",
    asOfDate: "2026-08-31",
    metricSet: {
      bookedConsults: 16,
      attendedConsults: 13,
      score: { visibility: 74, conversion: 66 },
    },
    sourceWatermark: {
      clinic_os: "cursor-2026-08-31-rerun",
    },
  });

  assert.equal(snapshot.id, updated.id);
  assert.equal(updated.asOfDate, "2026-08-31");
  assert.equal(updated.metricSet.bookedConsults, 16);
  assert.deepEqual(updated.sourceWatermark, { clinic_os: "cursor-2026-08-31-rerun" });
  assert.notEqual(updated.lineageHash, snapshot.lineageHash);
});
