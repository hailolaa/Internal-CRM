import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import pool from "../config/database.js";
import { config } from "../config/index.js";
import app from "../app.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const migrationPaths = [
  resolve(currentDir, "../../scripts/migrations/20260715_add_client_account_contact_relations.sql"),
  resolve(currentDir, "../../scripts/migrations/20260818_add_clinic_data_state.sql"),
  resolve(currentDir, "../../scripts/migrations/20260819_add_missed_call_recovery_integration.sql"),
];

const signingSecret = "clinicgrower-missed-call-test-secret-32";

function unique(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

async function runMigrations() {
  for (const migrationPath of migrationPaths) {
    const sql = await readFile(migrationPath, "utf8");
    for (const statement of sql.split(/;\s*\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      await pool.query(statement);
    }
  }
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
}

async function createWorkspace(prefix: string, dataState = "live") {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, data_state, data_state_label, is_demo, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', ?, ?, ?, 20)`,
    [
      clinicId,
      `${prefix} Workspace`,
      `${unique(prefix)}@example.com`,
      "020 7946 0000",
      "18 Harley Street",
      "London",
      "England",
      "W1G 9QH",
      "UK",
      "Europe/London",
      dataState,
      dataState === "demo" ? "Demo workspace data" : "Live workspace data",
      dataState === "demo" ? 1 : 0,
    ],
  );

  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, role,
       email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', 'SUPER_ADMIN', CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, `${unique(`${prefix}-admin`)}@example.com`, passwordHash, prefix],
  );

  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return {
    clinicId,
    userId,
    token: generateToken({ userId, clinicId, role: "SUPER_ADMIN", email: `${prefix}@example.com` }),
  };
}

async function createClientAccount(prefix: string, accountManagerId?: string | null, dataState = "live") {
  const clientClinicId = uuidv4();
  const profileId = uuidv4();

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, data_state, data_state_label, is_demo, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', ?, ?, ?, 20)`,
    [
      clientClinicId,
      `${prefix} Client`,
      `${unique(prefix)}@client.test`,
      "020 7946 0000",
      "18 Harley Street",
      "London",
      "England",
      "W1G 9QH",
      "UK",
      "Europe/London",
      dataState,
      dataState === "demo" ? "Demo client data" : "Live client data",
      dataState === "demo" ? 1 : 0,
    ],
  );

  await pool.execute(
    `INSERT INTO client_account_profile
      (id, clinic_id, account_manager_id, active_services, client_status)
     VALUES (?, ?, ?, ?, 'active')`,
    [profileId, clientClinicId, accountManagerId || null, JSON.stringify([])],
  );

  return { clientClinicId, profileId };
}

async function createMapping(args: {
  workspaceClinicId: string;
  clientAccountProfileId: string;
  clinicGrowerClinicId: string;
  ownerUserId?: string | null;
  isActive?: boolean;
}) {
  const mappingId = uuidv4();
  await pool.execute(
    `INSERT INTO clinicgrower_client_mapping
      (id, clinic_id, client_account_profile_id, clinicgrower_clinic_id,
       default_owner_user_id, fallback_queue_label, is_active)
     VALUES (?, ?, ?, ?, ?, 'Missed Call Recovery queue', ?)`,
    [
      mappingId,
      args.workspaceClinicId,
      args.clientAccountProfileId,
      args.clinicGrowerClinicId,
      args.ownerUserId || null,
      args.isActive === false ? 0 : 1,
    ],
  );
  return mappingId;
}

async function createContact(args: {
  clinicId: string;
  accountName?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
}) {
  const contactId = uuidv4();
  await pool.execute(
    `INSERT INTO contact
      (id, clinic_id, account_name, first_name, last_name, email, phone,
       communication_permissions, phone_permission, sms_permission, tags,
       status, lead_status, source, permission_source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, 0, ?, 'lead', 'new', 'manual', 'test fixture')`,
    [
      contactId,
      args.clinicId,
      args.accountName || "Existing client account",
      args.firstName || "Existing",
      args.lastName || "Caller",
      `${unique("known-caller")}@example.com`,
      args.phone || "+447700900123",
      JSON.stringify({ phone: true, email: false, sms: false, whatsapp: false }),
      JSON.stringify(["known-caller"]),
    ],
  );
  return contactId;
}

function missedCallPayload(overrides: Record<string, unknown> = {}) {
  const occurredAt = new Date();
  const sla = new Date(occurredAt.getTime() + 15 * 60 * 1000);
  return {
    eventId: uuidv4(),
    eventType: "MISSED_CALL_RECOVERY_REQUIRED",
    eventVersion: 1,
    sourceSystem: "clinicgrower",
    clinicId: "cg-clinic-001",
    tenantId: "cg-tenant-001",
    callId: uuidv4(),
    providerCallSid: `CA${uuidv4().replace(/-/g, "")}`,
    direction: "inbound",
    missedCallState: "no_answer",
    callerNumber: "+44 7700 900123",
    trackingNumber: "+44 20 7946 0000",
    source: "google_ads",
    occurredAt: occurredAt.toISOString(),
    recoverySlaTargetAt: sla.toISOString(),
    idempotencyKey: uuidv4(),
    recoveryEligible: true,
    recoveryState: "attempted",
    voicemailState: null,
    contactIdentity: null,
    acknowledgementStatus: "sent",
    acknowledgementSmsId: `SM${uuidv4().replace(/-/g, "")}`,
    ...overrides,
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

async function postClinicGrowerEvent(port: number, payload: Record<string, unknown>, headers?: Record<string, string>) {
  const rawBody = JSON.stringify(payload);
  return fetch(`http://127.0.0.1:${port}/api/webhooks/clinicgrower/missed-call-recovery`, {
    method: "POST",
    headers: headers || signedHeaders(rawBody),
    body: rawBody,
  });
}

test.before(async () => {
  await runMigrations();
  const mutableConfig = config as unknown as {
    clinicGrowerEvents: { signingSecret: string; timestampToleranceSeconds: number };
  };
  mutableConfig.clinicGrowerEvents.signingSecret = signingSecret;
  mutableConfig.clinicGrowerEvents.timestampToleranceSeconds = 300;
});

test.after(async () => {
  await pool.end();
});

test("ClinicGrower missed-call intake is signed, mapped, idempotent and creates recovery work", async () => {
  const workspace = await createWorkspace("missed-call");
  const client = await createClientAccount("missed-call", workspace.userId);
  const clinicGrowerClinicId = `cg-${uuidv4()}`;
  await createMapping({
    workspaceClinicId: workspace.clinicId,
    clientAccountProfileId: client.profileId,
    clinicGrowerClinicId,
    ownerUserId: workspace.userId,
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const payload = missedCallPayload({
      clinicId: clinicGrowerClinicId,
      contactIdentity: { name: "Known Caller" },
    });

    const forged = await postClinicGrowerEvent(port, payload, {
      Accept: "application/json",
      "Content-Type": "application/json",
      "X-ClinicGrower-Timestamp": Math.floor(Date.now() / 1000).toString(),
      "X-ClinicGrower-Signature": "sha256=wrong",
    });
    assert.equal(forged.status, 401);

    const created = await postClinicGrowerEvent(port, payload);
    const createdBody = await created.json() as any;
    assert.equal(created.status, 202);
    assert.equal(createdBody.data.status, "accepted");
    assert.ok(createdBody.data.recoveryId);
    assert.ok(createdBody.data.taskId);
    assert.ok(createdBody.data.contactId);

    const duplicate = await postClinicGrowerEvent(port, payload);
    const duplicateBody = await duplicate.json() as any;
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.data.status, "duplicate");
    assert.equal(duplicateBody.data.recoveryId, createdBody.data.recoveryId);

    const [recoveryRows]: any = await pool.execute(
      "SELECT COUNT(*) as count FROM missed_call_recovery WHERE source_event_id = ?",
      [payload.eventId],
    );
    assert.equal(Number(recoveryRows[0].count), 1);

    const [taskRows]: any = await pool.execute(
      `SELECT COUNT(*) as count, MAX(missed_task) as missedTask, MAX(assigned_user_id) as assignedUserId
       FROM task
       WHERE proof_reference = ? AND is_internal = 1`,
      [payload.providerCallSid],
    );
    assert.equal(Number(taskRows[0].count), 1);
    assert.equal(Number(taskRows[0].missedTask), 1);
    assert.equal(taskRows[0].assignedUserId, workspace.userId);

    const [timelineRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM activity
       WHERE contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'missed_call_recovery.created'`,
      [createdBody.data.contactId],
    );
    assert.equal(Number(timelineRows[0].count), 1);

    const [attemptedTimelineRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM activity
       WHERE contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'missed_call_recovery.state_changed'
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.status')) = 'attempted'`,
      [createdBody.data.contactId],
    );
    assert.equal(Number(attemptedTimelineRows[0].count), 1);

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/missed-call-recovery`, {
      headers: { Authorization: `Bearer ${workspace.token}`, Accept: "application/json" },
    });
    const listBody = await listResponse.json() as any;
    assert.equal(listResponse.status, 200);
    assert.equal(listBody.data.summary.total, 1);
    assert.equal(listBody.data.records[0].state, "attempted");
    assert.equal(listBody.data.records[0].clientName, "missed-call Client");

    const contactedResponse = await fetch(
      `http://127.0.0.1:${port}/api/missed-call-recovery/${createdBody.data.recoveryId}/state`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${workspace.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: "contacted" }),
      },
    );
    assert.equal(contactedResponse.status, 200);

    const bookedResponse = await fetch(
      `http://127.0.0.1:${port}/api/missed-call-recovery/${createdBody.data.recoveryId}/state`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${workspace.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: "booked" }),
      },
    );
    assert.equal(bookedResponse.status, 200);

    const regressionResponse = await fetch(
      `http://127.0.0.1:${port}/api/missed-call-recovery/${createdBody.data.recoveryId}/state`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${workspace.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ state: "attempted" }),
      },
    );
    assert.equal(regressionResponse.status, 400);
  } finally {
    await closeServer(server);
  }
});

test("ClinicGrower missed-call intake blocks unmapped, inactive and demo tenants without creating tasks", async () => {
  const workspace = await createWorkspace("missed-call-unmapped");
  const inactiveClient = await createClientAccount("missed-call-inactive", null);
  const demoClient = await createClientAccount("missed-call-demo", null, "demo");
  const inactiveClinicGrowerClinicId = `cg-inactive-${uuidv4()}`;
  const demoClinicGrowerClinicId = `cg-demo-${uuidv4()}`;
  await createMapping({
    workspaceClinicId: workspace.clinicId,
    clientAccountProfileId: inactiveClient.profileId,
    clinicGrowerClinicId: inactiveClinicGrowerClinicId,
    isActive: false,
  });
  await createMapping({
    workspaceClinicId: workspace.clinicId,
    clientAccountProfileId: demoClient.profileId,
    clinicGrowerClinicId: demoClinicGrowerClinicId,
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const unmappedPayload = missedCallPayload({ clinicId: `cg-unmapped-${uuidv4()}` });
    const unmappedResponse = await postClinicGrowerEvent(port, unmappedPayload);
    const unmappedBody = await unmappedResponse.json() as any;
    assert.equal(unmappedResponse.status, 202);
    assert.equal(unmappedBody.data.status, "mapping_required");
    assert.equal(unmappedBody.data.retryable, true);

    const inactivePayload = missedCallPayload({ clinicId: inactiveClinicGrowerClinicId });
    const inactiveResponse = await postClinicGrowerEvent(port, inactivePayload);
    const inactiveBody = await inactiveResponse.json() as any;
    assert.equal(inactiveResponse.status, 202);
    assert.equal(inactiveBody.data.status, "inactive_mapping");

    const demoPayload = missedCallPayload({ clinicId: demoClinicGrowerClinicId });
    const demoResponse = await postClinicGrowerEvent(port, demoPayload);
    const demoBody = await demoResponse.json() as any;
    assert.equal(demoResponse.status, 202);
    assert.equal(demoBody.data.status, "rejected");

    const testPayload = missedCallPayload({ clinicId: inactiveClinicGrowerClinicId, environment: "test" });
    const testEventResponse = await postClinicGrowerEvent(
      port,
      testPayload,
    );
    const testEventBody = await testEventResponse.json() as any;
    assert.equal(testEventResponse.status, 202);
    assert.equal(testEventBody.data.status, "rejected");

    const [taskRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM task
       WHERE proof_reference IN (?, ?, ?)`,
      [unmappedPayload.providerCallSid, inactivePayload.providerCallSid, demoPayload.providerCallSid],
    );
    assert.equal(Number(taskRows[0].count), 0);
  } finally {
    await closeServer(server);
  }
});

test("ClinicGrower missed-call intake validates replay and malformed requests", async () => {
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const replayPayload = missedCallPayload();
    const replayRawBody = JSON.stringify(replayPayload);
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 60 * 60);
    const replayResponse = await postClinicGrowerEvent(port, replayPayload, signedHeaders(replayRawBody, staleTimestamp));
    assert.equal(replayResponse.status, 401);

    const malformedPayload = { ...missedCallPayload(), eventId: "" };
    const malformedResponse = await postClinicGrowerEvent(port, malformedPayload);
    const malformedBody = await malformedResponse.json() as any;
    assert.equal(malformedResponse.status, 400);
    assert.match(malformedBody.message, /eventId is required/i);

    const occurredAt = new Date();
    const lateSlaPayload = missedCallPayload({
      occurredAt: occurredAt.toISOString(),
      recoverySlaTargetAt: new Date(occurredAt.getTime() + 30 * 60 * 1000).toISOString(),
    });
    const lateSlaResponse = await postClinicGrowerEvent(port, lateSlaPayload);
    const lateSlaBody = await lateSlaResponse.json() as any;
    assert.equal(lateSlaResponse.status, 400);
    assert.match(lateSlaBody.message, /15-minute missed-call recovery SLA/i);
  } finally {
    await closeServer(server);
  }
});

test("ClinicGrower missed-call intake supports eligible states, voicemail and fallback ownership", async () => {
  const workspace = await createWorkspace("missed-call-states");
  const client = await createClientAccount("missed-call-states", null);
  const clinicGrowerClinicId = `cg-states-${uuidv4()}`;
  await createMapping({
    workspaceClinicId: workspace.clinicId,
    clientAccountProfileId: client.profileId,
    clinicGrowerClinicId,
    ownerUserId: null,
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const states = ["busy", "failed", "canceled", "voicemail"] as const;
    for (const [index, state] of states.entries()) {
      const response = await postClinicGrowerEvent(
        port,
        missedCallPayload({
          clinicId: clinicGrowerClinicId,
          missedCallState: state,
          callerNumber: `+44 7700 90012${index}`,
          voicemailState: state === "voicemail" ? "recorded" : null,
          acknowledgementStatus: state === "failed" ? "failed" : "sent",
        }),
      );
      const body = await response.json() as any;
      assert.equal(response.status, 202);
      assert.equal(body.data.status, "accepted");
    }

    const listResponse = await fetch(`http://127.0.0.1:${port}/api/missed-call-recovery`, {
      headers: { Authorization: `Bearer ${workspace.token}`, Accept: "application/json" },
    });
    const listBody = await listResponse.json() as any;
    assert.equal(listResponse.status, 200);
    assert.equal(listBody.data.summary.total, 4);
    assert.equal(listBody.data.summary.voicemail, 1);
    assert.equal(listBody.data.records.every((record: any) => record.ownerLabel === "Missed Call Recovery queue"), true);
    assert.equal(listBody.data.records.some((record: any) => record.acknowledgementStatus === "failed"), true);

    const [taskRows]: any = await pool.execute(
      `SELECT COUNT(*) as count, COUNT(assigned_user_id) as assignedCount
       FROM task
       WHERE clinic_id = ? AND template_key = 'clinicgrower_missed_call_recovery'`,
      [workspace.clinicId],
    );
    assert.equal(Number(taskRows[0].count), 4);
    assert.equal(Number(taskRows[0].assignedCount), 0);
  } finally {
    await closeServer(server);
  }
});

test("ClinicGrower missed-call intake links known contacts and retries mapping-required events safely", async () => {
  const workspace = await createWorkspace("missed-call-retry");
  const client = await createClientAccount("missed-call-retry", workspace.userId);
  const clinicGrowerClinicId = `cg-retry-${uuidv4()}`;
  const knownContactId = await createContact({
    clinicId: workspace.clinicId,
    accountName: "missed-call-retry Client",
    firstName: "Known",
    lastName: "Patient",
    phone: "+44 7700 900555",
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Failed to start test server");
  const port = (address as AddressInfo).port;

  try {
    const pendingPayload = missedCallPayload({
      clinicId: clinicGrowerClinicId,
      callerNumber: "+44 7700 900555",
      contactIdentity: { name: "Should Not Create" },
    });
    const pendingResponse = await postClinicGrowerEvent(port, pendingPayload);
    const pendingBody = await pendingResponse.json() as any;
    assert.equal(pendingResponse.status, 202);
    assert.equal(pendingBody.data.status, "mapping_required");
    assert.equal(pendingBody.data.retryable, true);

    const mappingResponse = await fetch(`http://127.0.0.1:${port}/api/missed-call-recovery/mappings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${workspace.token}`,
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        clientAccountProfileId: client.profileId,
        clinicGrowerClinicId,
        clinicGrowerClinicName: "ClinicGrower retry clinic",
        defaultOwnerUserId: workspace.userId,
      }),
    });
    const mappingBody = await mappingResponse.json() as any;
    assert.equal(mappingResponse.status, 201);

    const mappingUpdateResponse = await fetch(
      `http://127.0.0.1:${port}/api/missed-call-recovery/mappings/${mappingBody.data.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${workspace.token}`,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fallbackQueueLabel: "Callback queue" }),
      },
    );
    assert.equal(mappingUpdateResponse.status, 200);

    const retryResponse = await postClinicGrowerEvent(port, pendingPayload);
    const retryBody = await retryResponse.json() as any;
    assert.equal(retryResponse.status, 202);
    assert.equal(retryBody.data.status, "accepted");
    assert.equal(retryBody.data.contactId, knownContactId);

    const duplicateResponse = await postClinicGrowerEvent(port, pendingPayload);
    const duplicateBody = await duplicateResponse.json() as any;
    assert.equal(duplicateResponse.status, 200);
    assert.equal(duplicateBody.data.status, "duplicate");
    assert.equal(duplicateBody.data.contactId, knownContactId);

    const [contactRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM contact
       WHERE clinic_id = ? AND phone = ? AND deleted_at IS NULL`,
      [workspace.clinicId, "+44 7700 900555"],
    );
    assert.equal(Number(contactRows[0].count), 1);
  } finally {
    await closeServer(server);
  }
});
