import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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

test("fleet queue processing marks events processed and advances checkpoints", async () => {
  const clinic = await createTestClinicAndAdmin("fleet-queue");
  await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-queue-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "account_summary",
    sourceLabel: "Clinic OS account summary",
    dataState: "live",
  });
  const source = (await fleetIngestionService.listSources(clinic.clinicId))[0]!;
  const receipt = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "account_summary",
    sourceEntity: "account_summary",
    sourceRecordId: "summary-001",
    providerEventId: "summary-event-001",
    payload: { sourceVersion: "v1", bookedConsults: 12 },
    payloadSummary: { sourceVersion: "v1" },
  });

  const processed = await fleetIngestionService.processQueuedEvents(
    { clinicId: clinic.clinicId, limit: 10 },
    async (event) => {
      assert.equal(event.id, receipt.id);
      assert.equal(event.payloadSummary?.sourceVersion, "v1");
      return { checkpoint: "cursor-001" };
    },
  );
  const checkpoint = await fleetIngestionService.getCheckpoint(clinic.clinicId, source.id);
  const [rows]: any = await pool.execute(
    `SELECT processing_status as status FROM fleet_ingestion_event WHERE id = ?`,
    [receipt.id],
  );

  assert.equal(processed.attempted, 1);
  assert.equal(processed.processed, 1);
  assert.equal(rows[0].status, "processed");
  assert.equal(checkpoint.syncStatus, "healthy");
  assert.equal(checkpoint.checkpoint, "cursor-001");
});

test("fleet queue retries with limits, dead-letters failures and supports replay", async () => {
  const clinic = await createTestClinicAndAdmin("fleet-dlq");
  await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-dlq-${clinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "operations_feed",
    sourceLabel: "Clinic OS operations feed",
    dataState: "live",
  });
  const source = (await fleetIngestionService.listSources(clinic.clinicId))[0]!;
  const receipt = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "operations_feed",
    sourceEntity: "task",
    sourceRecordId: "task-001",
    providerEventId: "ops-event-001",
    payload: { taskId: "task-001" },
  });

  const firstFailure = await fleetIngestionService.markEventFailed(clinic.clinicId, receipt.id, {
    retryable: true,
    retryAfterMs: 1000,
    errorClass: "provider_timeout",
    errorMessage: "Provider timeout.",
  });
  assert.equal(firstFailure, "retrying");

  for (let index = 0; index < 5; index += 1) {
    await fleetIngestionService.markEventFailed(clinic.clinicId, receipt.id, {
      retryable: true,
      errorClass: "provider_timeout",
      errorMessage: "Provider timeout.",
    });
  }

  const deadLetters = await fleetIngestionService.listDeadLetterEvents(clinic.clinicId);
  const deadLetterCheckpoint = await fleetIngestionService.getCheckpoint(clinic.clinicId, source.id);
  const replayed = await fleetIngestionService.replayDeadLetterEvent(clinic.clinicId, receipt.id);
  const replayCheckpoint = await fleetIngestionService.getCheckpoint(clinic.clinicId, source.id);

  assert.equal(deadLetters.length, 1);
  assert.equal(deadLetters[0]?.id, receipt.id);
  assert.equal(deadLetterCheckpoint.syncStatus, "dead_letter");
  assert.equal(deadLetterCheckpoint.deadLetterCount, 1);
  assert.equal(replayed.processingStatus, "queued");
  assert.equal(replayed.retryCount, 0);
  assert.equal(replayCheckpoint.deadLetterCount, 0);
  assert.equal(replayCheckpoint.retryingCount, 1);
});

test("fleet sync administration shows per-client health, categorized exceptions and scoped actions", async () => {
  const clinic = await createTestClinicAndAdmin("fleet-sync-admin");
  const otherClinic = await createTestClinicAndAdmin("fleet-sync-admin-other");

  await fleetIngestionService.configureSource({
    clinicId: clinic.clinicId,
    tenantKey: `clinic-os-sync-${clinic.clinicId}`,
    displayName: "Sync Admin Clinic",
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceLabel: "Clinic OS lead feed",
    dataState: "partial",
  });
  const source = (await fleetIngestionService.listSources(clinic.clinicId))[0]!;
  const receipt = await fleetIngestionService.ingestEvent({
    clinicId: clinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceEntity: "lead",
    sourceRecordId: "lead-sync-001",
    providerEventId: "lead-sync-event-001",
    payload: { leadId: "lead-sync-001" },
  });
  await fleetIngestionService.markEventFailed(clinic.clinicId, receipt.id, {
    retryable: false,
    errorClass: "mapping_error",
    errorMessage: "Could not map lead owner lead@example.com with Bearer secret-token.",
  });

  const freshnessId = randomUUID();
  await pool.execute(
    `INSERT INTO analytics_freshness_alert
       (id, clinic_id, source_id, alert_key, status, threshold_minutes, observed_lag_minutes, message)
     VALUES (?, ?, ?, ?, 'open', 60, 180, 'Clinic OS lead feed freshness breached 60 minute threshold.')`,
    [freshnessId, clinic.clinicId, source.id, `freshness-test:${source.id}`],
  );
  const reconciliationId = randomUUID();
  await pool.execute(
    `INSERT INTO analytics_reconciliation_issue
       (id, clinic_id, source_id, issue_type, severity, status, entity_key, details)
     VALUES (?, ?, ?, 'missing_fact', 'critical', 'open', 'lead-sync-001', ?)`,
    [reconciliationId, clinic.clinicId, source.id, JSON.stringify({ metricKey: "lead_count" })],
  );

  await fleetIngestionService.configureSource({
    clinicId: otherClinic.clinicId,
    tenantKey: `clinic-os-sync-${otherClinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceLabel: "Other clinic lead feed",
    dataState: "live",
  });
  const otherReceipt = await fleetIngestionService.ingestEvent({
    clinicId: otherClinic.clinicId,
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceEntity: "lead",
    sourceRecordId: "other-lead-sync-001",
    providerEventId: "other-lead-sync-event-001",
    payload: { leadId: "other-lead-sync-001" },
  });
  await fleetIngestionService.markEventFailed(otherClinic.clinicId, otherReceipt.id, { retryable: false });

  const currentClinic = await fleetIngestionService.getSyncAdministration(clinic.clinicId, false);

  assert.equal(currentClinic.scope, "current_clinic");
  assert.equal(currentClinic.summary.clients, 1);
  assert.equal(currentClinic.summary.sources, 1);
  assert.equal(currentClinic.summary.exceptions, 3);
  assert.equal(currentClinic.health[0]?.sourceDataState, "partial");
  assert.equal(currentClinic.health[0]?.syncStatus, "dead_letter");
  assert.equal(currentClinic.health[0]?.slaStatus, "breached");
  assert.ok(currentClinic.health[0]?.latestFailedSyncAt);
  assert.equal(currentClinic.exceptions.map((item) => item.type).sort().join(","), "dead_letter,freshness,reconciliation");
  const deadLetterException = currentClinic.exceptions.find((item) => item.type === "dead_letter");
  assert.ok(deadLetterException?.availableActions.includes("replay"));
  assert.equal(deadLetterException?.detail.includes("lead@example.com"), false);
  assert.equal(deadLetterException?.detail.includes("secret-token"), false);
  await assert.rejects(
    () => fleetIngestionService.replayDeadLetterEventForScope(clinic.clinicId, otherReceipt.id, false),
    /not found/i,
  );

  const replayed = await fleetIngestionService.replayDeadLetterEventForScope(clinic.clinicId, receipt.id, false, clinic.userId, "Retry after owner mapping review.");
  assert.equal(replayed.processingStatus, "queued");

  const freshnessAcknowledged = await fleetIngestionService.resolveSyncExceptionForScope(
    clinic.clinicId,
    "freshness",
    freshnessId,
    false,
    clinic.userId,
    "acknowledge",
    "Provider lag acknowledged.",
  );
  assert.equal(freshnessAcknowledged.status, "acknowledged");
  await assert.rejects(
    () => fleetIngestionService.resolveSyncExceptionForScope(clinic.clinicId, "freshness", freshnessId, false, clinic.userId, "acknowledge"),
    /only open/i,
  );
  const freshnessResolved = await fleetIngestionService.resolveSyncExceptionForScope(clinic.clinicId, "freshness", freshnessId, false, clinic.userId, "resolve", "Provider lag recovered.");
  const reconciliationResolved = await fleetIngestionService.resolveSyncExceptionForScope(
    clinic.clinicId,
    "reconciliation",
    reconciliationId,
    false,
    clinic.userId,
    "dismiss",
    "Reconciliation issue reviewed and dismissed.",
  );
  assert.equal(freshnessResolved.status, "resolved");
  assert.equal(reconciliationResolved.status, "dismissed");

  const [actionLogRows]: any = await pool.execute(
    `SELECT action, actor_user_id as actorUserId, reason
     FROM fleet_sync_exception_action_log
     WHERE clinic_id = ?
     ORDER BY FIELD(action, 'replayed', 'acknowledged', 'resolved', 'dismissed')`,
    [clinic.clinicId],
  );
  assert.deepEqual(
    actionLogRows.map((row: any) => row.action),
    ["replayed", "acknowledged", "resolved", "dismissed"],
  );
  assert.ok(actionLogRows.every((row: any) => row.actorUserId === clinic.userId));
  assert.ok(actionLogRows.every((row: any) => row.reason));

  const afterResolution = await fleetIngestionService.getSyncAdministration(clinic.clinicId, false);
  assert.equal(afterResolution.summary.exceptions, 0);
  assert.equal(afterResolution.health[0]?.slaStatus, "at_risk");
});

test("fleet sync administration distinguishes unknown and blocked source states", async () => {
  const unknownClinic = await createTestClinicAndAdmin("fleet-sync-source-unknown");
  const blockedClinic = await createTestClinicAndAdmin("fleet-sync-source-blocked");
  await fleetIngestionService.configureSource({
    clinicId: unknownClinic.clinicId,
    tenantKey: `clinic-os-unknown-${unknownClinic.clinicId}`,
    sourceSystem: "clinic_os",
    sourceKey: "unknown_feed",
    sourceLabel: "Unknown feed",
    dataState: "live",
  });
  await fleetIngestionService.configureSource({
    clinicId: blockedClinic.clinicId,
    tenantKey: `clinic-os-blocked-${blockedClinic.clinicId}`,
    displayName: "Blocked provider tenant",
    onboardingStatus: "blocked",
    sourceSystem: "clinic_os",
    sourceKey: "blocked_feed",
    sourceLabel: "Blocked feed",
    dataState: "provider_dependent",
  });

  const unknownAdmin = await fleetIngestionService.getSyncAdministration(unknownClinic.clinicId, false);
  const blockedAdmin = await fleetIngestionService.getSyncAdministration(blockedClinic.clinicId, false);
  const unknown = unknownAdmin.health.find((row) => row.sourceKey === "unknown_feed");
  const blocked = blockedAdmin.health.find((row) => row.sourceKey === "blocked_feed");

  assert.equal(unknown?.syncStatus, "unknown");
  assert.equal(unknown?.slaStatus, "at_risk");
  assert.equal(blocked?.syncStatus, "blocked");
  assert.equal(blocked?.slaStatus, "not_applicable");
  assert.deepEqual(
    unknownAdmin.exceptions.map((item) => `${item.type}:${item.status}`),
    ["source_status:unknown"],
  );
  assert.deepEqual(
    blockedAdmin.exceptions.map((item) => `${item.type}:${item.status}`),
    ["source_status:blocked"],
  );
});
