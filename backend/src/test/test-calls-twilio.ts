import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
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
  };
}

async function addTrackingNumber(clinicId: string, phoneNumber: string) {
  const trackingNumberId = uuidv4();
  const normalizedNumber = phoneNumber.replace(/\D/g, "");

  await pool.execute(
    `INSERT INTO call_tracking_number
      (id, clinic_id, phone_number, normalized_number, label, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [trackingNumberId, clinicId, phoneNumber, normalizedNumber, "Twilio inbound line"],
  );

  return trackingNumberId;
}

test("Twilio call webhooks stay idempotent and clinic-scoped", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("TwilioCallsPrimary");
  const secondary = await createClinicAndAdmin("TwilioCallsSecondary");
  const trackingNumber = "+1 (555) 900-0001";
  await addTrackingNumber(primary.clinicId, trackingNumber);
  const answeredCallSid = `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`;
  const missedCallSid = `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`;
  const recordingSid = `RE${uuidv4().replace(/-/g, "").slice(0, 32)}`;

  try {
    const answeredPayload = {
      CallSid: answeredCallSid,
      AccountSid: "AC99999999999999999999999999999999",
      CallStatus: "completed",
      Direction: "inbound",
      From: "+1 (555) 111-2222",
      To: trackingNumber,
      CallDuration: "182",
      Duration: "182",
      StartTime: "2026-05-28T10:00:00Z",
      EndTime: "2026-05-28T10:03:02Z",
      AnsweredBy: "human",
    };

    const firstWebhook = await callsService.handleTwilioCallWebhook(answeredPayload);
    assert.equal(firstWebhook.created, true);
    assert.equal(firstWebhook.matched, true);
    assert.equal(firstWebhook.clinicId, primary.clinicId);

    const replayWebhook = await callsService.handleTwilioCallWebhook(answeredPayload);
    assert.equal(replayWebhook.created, false);
    assert.equal(replayWebhook.matched, true);
    assert.equal(replayWebhook.callId, firstWebhook.callId);

    const recordedWebhook = await callsService.handleTwilioRecordingWebhook({
      CallSid: answeredPayload.CallSid,
      RecordingSid: recordingSid,
      RecordingUrl: "https://recordings.example.com/call-111.mp3",
      RecordingStatus: "completed",
      RecordingDuration: "182",
      AccountSid: answeredPayload.AccountSid,
    });

    assert.equal(recordedWebhook.created, false);
    assert.equal(recordedWebhook.matched, true);
    assert.equal(recordedWebhook.callId, firstWebhook.callId);

    const missedPayload = {
      CallSid: missedCallSid,
      AccountSid: "AC99999999999999999999999999999999",
      CallStatus: "no-answer",
      Direction: "inbound",
      From: "+1 (555) 333-4444",
      To: trackingNumber,
      CallDuration: "0",
      Duration: "0",
      StartTime: "2026-05-28T11:00:00Z",
      EndTime: "2026-05-28T11:00:30Z",
    };

    const missedWebhook = await callsService.handleTwilioCallWebhook(missedPayload);
    assert.equal(missedWebhook.created, true);
    assert.equal(missedWebhook.matched, true);
    assert.equal(missedWebhook.clinicId, primary.clinicId);

    const allCalls = await callsService.listCalls(primary.clinicId);
    assert.equal(allCalls.length, 2);

    const missedCalls = await callsService.listCalls(primary.clinicId, { missedOnly: true });
    assert.equal(missedCalls.length, 1);
    assert.equal(missedCalls[0]?.id, missedWebhook.callId);
    assert.equal(missedCalls[0]?.outcome, "no_answer");

    const firstCall = await callsService.getCall(primary.clinicId, firstWebhook.callId as string);
    assert.equal(firstCall.recordingUrl, "https://recordings.example.com/call-111.mp3");
    assert.equal(firstCall.outcome, "connected");

    const complianceUpdated = await callsService.updateCall(
      primary.clinicId,
      primary.userId,
      firstWebhook.callId as string,
      {
        consentCaptured: true,
        consentMethod: "verbal",
        consentTimestamp: "2026-05-28T10:00:30.000Z",
        retentionDeadline: "2026-12-31",
      },
    );
    assert.equal(complianceUpdated.consentCaptured, true);
    assert.equal(complianceUpdated.consentMethod, "verbal");
    assert.equal(complianceUpdated.consentTimestamp, "2026-05-28T10:00:30.000Z");
    assert.equal(complianceUpdated.retentionDeadline, "2026-12-31");

    const deletionRequest = await callsService.createRecordingDeletionRequest(
      primary.clinicId,
      primary.userId,
      firstWebhook.callId as string,
      { reason: "Patient requested removal after retention review." },
    );
    assert.equal(deletionRequest.callId, firstWebhook.callId);
    assert.equal(deletionRequest.status, "requested");

    const requestVisibleOnCall = await callsService.getCall(primary.clinicId, firstWebhook.callId as string);
    assert.equal(requestVisibleOnCall.recordingDeletionRequest.id, deletionRequest.id);
    assert.equal(requestVisibleOnCall.recordingDeletionRequest.status, "requested");

    const completedRequest = await callsService.updateRecordingDeletionRequest(
      primary.clinicId,
      primary.userId,
      deletionRequest.id,
      { status: "completed" },
    );
    assert.equal(completedRequest.status, "completed");
    assert.ok(completedRequest.resolvedAt);

    await assert.rejects(
      () => callsService.updateRecordingDeletionRequest(
        secondary.clinicId,
        secondary.userId,
        deletionRequest.id,
        { status: "approved" },
      ),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to update the recording deletion request",
    );

    const summary = await callsService.getCallSummary(primary.clinicId);
    assert.equal(summary.totalCalls, 2);
    assert.equal(summary.missedCalls, 1);
    assert.ok(summary.callToBookingRate >= 0);

    await assert.rejects(
      () => callsService.getCall(secondary.clinicId, firstWebhook.callId as string),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to access the call",
    );

    console.log("[twilio-calls] webhook idempotency and reporting test passed");
  } finally {
    await pool.execute(
      `UPDATE call_recording_deletion_request
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND call_id IN (
           SELECT id FROM \` call \`
           WHERE clinic_id = ?
             AND twilio_call_sid IN (?, ?)
         )
         AND deleted_at IS NULL`,
      [primary.clinicId, primary.clinicId, answeredCallSid, missedCallSid],
    );

    await pool.execute(
      `UPDATE \` call \`
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND twilio_call_sid IN (?, ?)
         AND deleted_at IS NULL`,
      [primary.clinicId, answeredCallSid, missedCallSid],
    );

    await pool.execute(
      `DELETE FROM call_tracking_number
       WHERE clinic_id = ?
         AND normalized_number = ?`,
      [primary.clinicId, trackingNumber.replace(/\D/g, "")],
    );
    await pool.end();
  }
});
