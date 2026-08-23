import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { fleetIngestionService } from "../modules/fleet-ingestion/fleet-ingestion.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

test("fleet ingestion registers tenants and configured sources idempotently", async () => {
  await testConnection();
  const clinic = await createTestClinicAndAdmin("fleet-source");

  const source = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-demo-${clinic.clinicId}`,
    displayName: "Clinic OS Demo",
    dataState: "partial",
    sourceSystem: "clinic_os",
    sourceKey: "appointments",
    sourceLabel: "Clinic OS appointments",
    endpointKind: "webhook",
  });
  const updated = await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-demo-${clinic.clinicId}`,
    displayName: "Clinic OS Demo",
    dataState: "partial",
    sourceSystem: "clinic_os",
    sourceKey: "appointments",
    sourceLabel: "Clinic OS appointments feed",
    endpointKind: "webhook",
  });
  const sources = await fleetIngestionService.listSources(clinic.clinicId);

  assert.equal(source.id, updated.id);
  assert.equal(updated.sourceLabel, "Clinic OS appointments feed");
  assert.equal(sources.length, 1);
  assert.equal(sources[0]?.dataState, "partial");
});

test("fleet identity mapping is tenant scoped and deterministic", async () => {
  const clinicA = await createTestClinicAndAdmin("fleet-identity-a");
  const clinicB = await createTestClinicAndAdmin("fleet-identity-b");

  await fleetIngestionService.registerTenant({ clinicId: clinicA.clinicId, tenantKey: `clinic-a-${clinicA.clinicId}`, dataState: "live" });
  await fleetIngestionService.registerTenant({ clinicId: clinicB.clinicId, tenantKey: `clinic-b-${clinicB.clinicId}`, dataState: "live" });

  const first = await fleetIngestionService.resolveIdentity({
    clinicId: clinicA.clinicId,
    sourceSystem: "clinic_os",
    sourceEntity: "patient",
    sourceRecordId: "patient-001",
    targetType: "contact",
    targetId: "contact-a",
    confidence: "known",
    payload: { email: "patient@example.com", name: "Patient A" },
  });
  const changed = await fleetIngestionService.resolveIdentity({
    clinicId: clinicA.clinicId,
    sourceSystem: "clinic_os",
    sourceEntity: "patient",
    sourceRecordId: "patient-001",
    targetType: "contact",
    targetId: "contact-a2",
    confidence: "known",
    payload: { email: "patient@example.com", name: "Patient A" },
  });
  const otherTenant = await fleetIngestionService.resolveIdentity({
    clinicId: clinicB.clinicId,
    sourceSystem: "clinic_os",
    sourceEntity: "patient",
    sourceRecordId: "patient-001",
    targetType: "contact",
    targetId: "contact-b",
    confidence: "known",
  });

  assert.equal(first.id, changed.id);
  assert.equal(changed.identityKey, "clinic_os:patient:patient-001");
  assert.equal(changed.targetId, "contact-a2");
  assert.notEqual(changed.id, otherTenant.id);
  assert.equal(otherTenant.clinicId, clinicB.clinicId);
});

test("fleet event ingestion requires configured active sources and prevents duplicates", async () => {
  const clinic = await createTestClinicAndAdmin("fleet-event");

  await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-event-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceLabel: "Clinic OS lead feed",
    dataState: "live",
  });

  const receipt = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    providerEventId: "evt-001",
    payload: { leadId: "lead-001", email: "lead@example.com" },
    payloadSummary: { leadId: "lead-001" },
  });
  const duplicate = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceEntity: "lead",
    sourceRecordId: "lead-001",
    providerEventId: "evt-001",
    payload: { leadId: "lead-001", email: "lead@example.com" },
    payloadSummary: { leadId: "lead-001" },
  });

  const [rows]: any = await pool.execute(
    `SELECT COUNT(*) as count FROM fleet_ingestion_event WHERE clinic_id = ? AND idempotency_key = ?`,
    [clinic.clinicId, receipt.idempotencyKey],
  );

  assert.equal(receipt.processingStatus, "queued");
  assert.equal(duplicate.processingStatus, "duplicate");
  assert.equal(duplicate.duplicateOf, receipt.id);
  assert.equal(Number(rows[0].count), 1);
});

test("fleet event ingestion blocks unconfigured, inactive and roadmap-only sources", async () => {
  const clinic = await createTestClinicAndAdmin("fleet-blocked");

  await assert.rejects(
    () => fleetIngestionService.ingestEvent({
      clinicId: clinic.clinicId,
      sourceSystem: "clinic_os",
      sourceKey: "missing",
      sourceEntity: "lead",
      sourceRecordId: "lead-001",
      payload: {},
    }),
    /not configured/,
  );

  await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-blocked-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "inactive_feed",
    sourceLabel: "Inactive feed",
    status: "inactive",
    dataState: "partial",
  });
  await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-blocked-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "roadmap_feed",
    sourceLabel: "Roadmap feed",
    status: "active",
    dataState: "roadmap",
  });

  await assert.rejects(
    () => fleetIngestionService.ingestEvent({
      clinicId: clinic.clinicId,
      sourceSystem: "clinic_os",
      sourceKey: "inactive_feed",
      sourceEntity: "lead",
      sourceRecordId: "lead-002",
      payload: {},
    }),
    /not active/,
  );
  await assert.rejects(
    () => fleetIngestionService.ingestEvent({
      clinicId: clinic.clinicId,
      sourceSystem: "clinic_os",
      sourceKey: "roadmap_feed",
      sourceEntity: "lead",
      sourceRecordId: "lead-003",
      payload: {},
    }),
    /roadmap-only/,
  );
});
