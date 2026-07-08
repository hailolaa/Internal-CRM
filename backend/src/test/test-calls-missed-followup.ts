import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { callsService } from "../modules/calls/calls.service.js";

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

async function addTrackingNumber(clinicId: string, phoneNumber: string) {
  const trackingNumberId = uuidv4();
  const normalizedNumber = phoneNumber.replace(/\D/g, "");

  await pool.execute(
    `INSERT INTO call_tracking_number
      (id, clinic_id, phone_number, normalized_number, label, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [trackingNumberId, clinicId, phoneNumber, normalizedNumber, "Missed call test line"],
  );

  return trackingNumberId;
}

test("missed-call follow-up endpoint queues an SMS and blocks duplicates", async () => {
  await testConnection();

  const clinic = await createClinicAndAdmin("MissedFollowUp");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start missed follow-up test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const trackingNumber = "+1 (555) 910-0001";
  const callSid = `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`;
  const fromNumber = "+1 (555) 444-1212";
  let contactId = "";
  let createdCallId = "";

  try {
    await addTrackingNumber(clinic.clinicId, trackingNumber);

    const webhookResult = await callsService.handleTwilioCallWebhook({
      CallSid: callSid,
      AccountSid: "AC99999999999999999999999999999999",
      CallStatus: "no-answer",
      Direction: "inbound",
      From: fromNumber,
      To: trackingNumber,
      CallDuration: "0",
      Duration: "0",
      StartTime: "2026-05-29T11:00:00Z",
      EndTime: "2026-05-29T11:00:25Z",
    });

    assert.equal(webhookResult.created, true);
    assert.equal(webhookResult.matched, true);
    assert.equal(webhookResult.clinicId, clinic.clinicId);
    createdCallId = webhookResult.callId as string;

    const callRecord = await callsService.getCall(clinic.clinicId, createdCallId);
    contactId = callRecord.contactId;

    const followUpResponse = await fetch(`${baseUrl}/api/calls/${createdCallId}/follow-up`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    const followUpBody: any = await followUpResponse.json();

    assert.equal(followUpResponse.status, 201);
    assert.equal(followUpBody.status, "success");
    assert.equal(followUpBody.data.callId, createdCallId);
    assert.equal(followUpBody.data.status, "queued");

    const [smsRows]: any = await pool.execute(
      `SELECT id, status, message, call_id as callId, call_followup as callFollowup, provider_message_id as providerMessageId
       FROM sms
       WHERE clinic_id = ?
         AND call_id = ?
         AND call_followup = 1
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinic.clinicId, createdCallId],
    );

    assert.equal(smsRows.length, 1);
    assert.equal(smsRows[0].callId, createdCallId);
    assert.equal(smsRows[0].callFollowup, 1);
    assert.equal(smsRows[0].status, "queued");
    assert.ok(String(smsRows[0].message || "").includes("Sorry we missed your call"));

    const duplicateResponse = await fetch(`${baseUrl}/api/calls/${createdCallId}/follow-up`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(duplicateResponse.status, 409);

    console.log("[calls-missed-followup] endpoint queue and duplicate guard test passed");
  } finally {
    if (contactId) {
      await pool.execute(
        `UPDATE contact
         SET deleted_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ?
           AND deleted_at IS NULL`,
        [contactId],
      );
    }

    await pool.execute(
      `UPDATE sms
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND call_id = ?
         AND deleted_at IS NULL`,
      [clinic.clinicId, createdCallId || callSid],
    ).catch(() => undefined);

    await pool.execute(
      `UPDATE \`call\`
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND twilio_call_sid = ?
         AND deleted_at IS NULL`,
      [clinic.clinicId, callSid],
    ).catch(() => undefined);

    await pool.execute(
      `DELETE FROM call_tracking_number
       WHERE clinic_id = ?
         AND normalized_number = ?`,
      [clinic.clinicId, trackingNumber.replace(/\D/g, "")],
    ).catch(() => undefined);

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
