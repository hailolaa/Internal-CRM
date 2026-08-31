import assert from "node:assert/strict";
import crypto from "node:crypto";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { config } from "../config/index.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

const signingSecret = "clinic-os-alpha-sync-test-secret-32";
const generatedAt = "2026-08-27T10:00:00.000Z";

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value as Record<string, unknown>).sort().map((key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function payloadHash(value: unknown) {
  return crypto.createHash("sha256").update(stableStringify(value)).digest("hex");
}

function eventPayload(clinicId: string, entity: string, sourceId: string, summary: Record<string, unknown>) {
  const eventWithoutIdentity = {
    entity,
    sourceId,
    occurredAt: generatedAt,
    summary,
  };
  const hash = payloadHash(eventWithoutIdentity);
  return {
    ...eventWithoutIdentity,
    payloadHash: hash,
    idempotencyKey: `clinic_os.alpha_sync.v1:${clinicId}:${entity}:${sourceId}:${hash}`,
  };
}

function alphaPayload(clinic: { clinicId: string; label: string }, overrides: Record<string, unknown> = {}) {
  const events = [
    eventPayload(clinic.clinicId, "lead", `${clinic.clinicId}-lead-1`, {
      contactId: `${clinic.clinicId}-contact-1`,
      stageId: "new",
      source: "Google Ads",
      responseState: "current",
    }),
    eventPayload(clinic.clinicId, "integration_status", "meta_ads", {
      sourceSystem: "meta_ads",
      configured: true,
      dataFreshness: "failed",
    }),
    eventPayload(clinic.clinicId, "clinic_summary", clinic.clinicId, {
      leadCount: 1,
      appointmentCount: 0,
      consultationCount: 0,
      integrationCount: 1,
    }),
  ];
  const withoutHash = {
    contractVersion: "clinic_os.alpha_sync.v1",
    generatedAt,
    sourceSystem: "clinic_os",
    clinic: {
      clinicId: clinic.clinicId,
      tenantKey: `clinic-os:${clinic.clinicId}`,
      displayName: clinic.label,
      dataState: "partial",
    },
    leads: [],
    appointments: [],
    consultations: [],
    integrations: [],
    responseTimeMetrics: [],
    summary: {
      leadCount: 1,
      appointmentCount: 0,
      consultationCount: 0,
      integrationCount: 1,
      staleOrFailedCount: 1,
      selectedRevenueFields: {
        opportunityValueCents: 0,
        appointmentValueCents: 0,
        consultRevenueValue: 0,
        soldConsultRevenueValue: 0,
      },
      sla: { targetMinutes: 15 },
    },
    events,
    ...overrides,
  };
  return {
    ...withoutHash,
    payloadHash: payloadHash(withoutHash),
  };
}

function signedHeaders(rawBody: string, timestamp = Math.floor(Date.now() / 1000).toString()) {
  const signature = `sha256=${crypto.createHmac("sha256", signingSecret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    "X-ClinicGrower-Timestamp": timestamp,
    "X-ClinicGrower-Signature": signature,
  };
}

async function postAlpha(port: number, payload: Record<string, unknown>, headers?: Record<string, string>) {
  const rawBody = JSON.stringify(payload);
  return fetch(`http://127.0.0.1:${port}/api/webhooks/clinic-os/alpha-sync`, {
    method: "POST",
    headers: headers || signedHeaders(rawBody),
    body: rawBody,
  });
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

test.before(async () => {
  await testConnection();
  const mutableConfig = config as unknown as {
    clinicGrowerEvents: { signingSecret: string; timestampToleranceSeconds: number };
  };
  mutableConfig.clinicGrowerEvents.signingSecret = signingSecret;
  mutableConfig.clinicGrowerEvents.timestampToleranceSeconds = 300;
});

test.after(async () => {
  await pool.end();
});

test("Clinic OS alpha sync receiver accepts two pilot clinics, preserves tenant scope and surfaces failed freshness", async () => {
  const pilotA = await createTestClinicAndAdmin("alpha-sync-pilot-a");
  const pilotB = await createTestClinicAndAdmin("alpha-sync-pilot-b");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const payloadA = alphaPayload({ clinicId: pilotA.clinicId, label: "Pilot A" });
    const payloadB = alphaPayload({ clinicId: pilotB.clinicId, label: "Pilot B" });

    const createdA = await postAlpha(port, payloadA);
    const bodyA = await createdA.json() as any;
    const duplicateA = await postAlpha(port, payloadA);
    const duplicateBodyA = await duplicateA.json() as any;
    const createdB = await postAlpha(port, payloadB);
    const bodyB = await createdB.json() as any;

    assert.equal(createdA.status, 202);
    assert.equal(bodyA.data.acceptedEvents, 3);
    assert.equal(bodyA.data.duplicateEvents, 0);
    assert.equal(bodyA.data.freshnessAlerts, 1);
    assert.equal(duplicateA.status, 202);
    assert.equal(duplicateBodyA.data.acceptedEvents, 0);
    assert.equal(duplicateBodyA.data.duplicateEvents, 3);
    assert.equal(createdB.status, 202);
    assert.equal(bodyB.data.clinicId, pilotB.clinicId);

    const [eventRows]: any = await pool.execute(
      `SELECT clinic_id as clinicId, source_entity as entity, processing_status as status
       FROM fleet_ingestion_event
       WHERE clinic_id IN (?, ?)
       ORDER BY clinic_id, source_entity`,
      [pilotA.clinicId, pilotB.clinicId],
    );
    assert.equal(eventRows.length, 6);
    assert.equal(eventRows.every((row: any) => row.status === "processed"), true);
    assert.equal(eventRows.filter((row: any) => row.clinicId === pilotA.clinicId).length, 3);
    assert.equal(eventRows.filter((row: any) => row.clinicId === pilotB.clinicId).length, 3);

    const [identityRows]: any = await pool.execute(
      `SELECT clinic_id as clinicId, source_record_id as sourceRecordId
       FROM fleet_identity_mapping
       WHERE clinic_id IN (?, ?)`,
      [pilotA.clinicId, pilotB.clinicId],
    );
    assert.equal(identityRows.some((row: any) => row.clinicId === pilotA.clinicId && String(row.sourceRecordId).includes(pilotB.clinicId)), false);
    assert.equal(identityRows.some((row: any) => row.clinicId === pilotB.clinicId && String(row.sourceRecordId).includes(pilotA.clinicId)), false);

    const health = await fetch(`http://127.0.0.1:${port}/api/fleet-ingestion/sync-health`, {
      headers: { Authorization: `Bearer ${pilotA.token}` },
    });
    const healthBody = await health.json() as any;
    const pilotAHealth = healthBody.data.health.find((row: any) => row.clinicId === pilotA.clinicId && row.sourceKey === "alpha_sync");
    const pilotBHealth = healthBody.data.health.find((row: any) => row.clinicId === pilotB.clinicId && row.sourceKey === "alpha_sync");
    const pilotAExceptions = healthBody.data.exceptions.filter((item: any) => item.clinicId === pilotA.clinicId);
    assert.equal(health.status, 200);
    assert.equal(healthBody.data.summary.clients >= 2, true);
    assert.ok(pilotAHealth);
    assert.ok(pilotBHealth);
    assert.equal(pilotAHealth.sourceDataState, "partial");
    assert.equal(pilotAHealth.slaStatus, "breached");
    assert.equal(pilotAExceptions.some((item: any) => item.type === "freshness"), true);
  } finally {
    await closeServer(server);
  }
});

test("Clinic OS alpha sync receiver rejects bad signatures, replay timestamps, malformed payloads and unmapped clinics", async () => {
  const pilot = await createTestClinicAndAdmin("alpha-sync-security");
  const payload = alphaPayload({ clinicId: pilot.clinicId, label: "Pilot Security" });
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const rawBody = JSON.stringify(payload);
    const badSignature = await postAlpha(port, payload, {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-ClinicGrower-Timestamp": Math.floor(Date.now() / 1000).toString(),
      "X-ClinicGrower-Signature": "sha256=bad",
    });
    assert.equal(badSignature.status, 401);

    const oldTimestamp = String(Math.floor(Date.now() / 1000) - 1000);
    const replay = await postAlpha(port, payload, signedHeaders(rawBody, oldTimestamp));
    assert.equal(replay.status, 401);

    const hashMismatch = await postAlpha(port, {
      ...payload,
      clinic: { ...(payload.clinic as any), displayName: "Tampered Clinic" },
    });
    assert.equal(hashMismatch.status, 400);

    const malformed = alphaPayload({ clinicId: pilot.clinicId, label: "Pilot Security" }, { events: [] });
    const malformedResponse = await postAlpha(port, malformed);
    assert.equal(malformedResponse.status, 400);

    const missingClinic = await postAlpha(port, alphaPayload({ clinicId: uuidv4(), label: "Missing Clinic" }));
    assert.equal(missingClinic.status, 404);
  } finally {
    await closeServer(server);
  }
});
