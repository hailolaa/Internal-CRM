import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { callsService } from "../modules/calls/calls.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";

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

  return { trackingNumberId, normalizedNumber };
}

test("calls support commercial outcomes, contact linking, and metrics", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("CallsCommercialPrimary");
  const secondary = await createClinicAndAdmin("CallsCommercialSecondary");
  const trackingNumber = "+1 (555) 901-0001";
  const contactPhone = "+1 (555) 222-0001";
  const secondPhone = "+1 (555) 222-0002";
  const { normalizedNumber } = await addTrackingNumber(primary.clinicId, trackingNumber);

  const existingContact = await contactsService.createContact(primary.clinicId, primary.userId, {
    firstName: "Existing",
    lastName: "Caller",
    email: uniqueEmail("calls_commercial_contact"),
    phone: contactPhone,
    source: "integration-test",
    value: 7500,
    treatmentInterests: ["Injectables"],
  });

  const firstCallSid = `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`;
  const secondCallSid = `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`;
  const firstRecordingSid = `RE${uuidv4().replace(/-/g, "").slice(0, 32)}`;

  let firstCallId = "";
  let secondCallId = "";
  let manualCallId = "";
  let firstCallContactId = existingContact.contact.id;
  let secondCallContactId = "";

  try {
    const manualCall = await callsService.createCall(primary.clinicId, primary.userId, {
      contactId: existingContact.contact.id,
      direction: "outbound",
      duration: 420,
      commercialOutcome: "follow_up_required",
      notes: "Manual call logged from integration test",
      source: "manual_call",
      treatmentMentioned: "Injectables",
      createdAt: "2026-05-28T08:30:00Z",
    });
    manualCallId = manualCall.id;
    assert.equal(manualCall.contactId, existingContact.contact.id);
    assert.equal(manualCall.direction, "outbound");
    assert.equal(manualCall.duration, 420);
    assert.equal(manualCall.commercialOutcome, "follow_up_required");
    assert.equal(manualCall.disposition, "follow_up_needed");
    assert.equal(manualCall.notes, "Manual call logged from integration test");
    assert.equal(manualCall.treatmentMentioned, "Injectables");
    assert.equal(manualCall.source, "manual_call");

    await assert.rejects(
      () => callsService.createCall(secondary.clinicId, secondary.userId, {
        contactId: existingContact.contact.id,
        direction: "inbound",
        duration: 60,
      }),
      (error: any) => error?.statusCode === 400,
      "Another clinic should not be able to create a call for this contact",
    );

    const linkedWebhook = await callsService.handleTwilioCallWebhook({
      CallSid: firstCallSid,
      AccountSid: "AC99999999999999999999999999999999",
      CallStatus: "completed",
      Direction: "inbound",
      From: contactPhone,
      To: trackingNumber,
      CallDuration: "142",
      Duration: "142",
      StartTime: "2026-05-28T09:00:00Z",
      EndTime: "2026-05-28T09:02:22Z",
      AnsweredBy: "human",
    });

    assert.equal(linkedWebhook.created, true);
    assert.equal(linkedWebhook.matched, true);
    assert.equal(linkedWebhook.clinicId, primary.clinicId);
    firstCallId = linkedWebhook.callId as string;

    const linkedCall = await callsService.getCall(primary.clinicId, firstCallId);
    assert.equal(linkedCall.contactId, existingContact.contact.id);
    assert.equal(linkedCall.contactName, "Existing Caller");

    const recordedWebhook = await callsService.handleTwilioRecordingWebhook({
      CallSid: firstCallSid,
      RecordingSid: firstRecordingSid,
      RecordingUrl: "https://recordings.example.com/call-222.mp3",
      RecordingStatus: "completed",
      RecordingDuration: "142",
      AccountSid: "AC99999999999999999999999999999999",
    });

    assert.equal(recordedWebhook.matched, true);
    assert.equal(recordedWebhook.callId, firstCallId);

    await callsService.updateCall(primary.clinicId, primary.userId, firstCallId, {
      commercialOutcome: "booked_consult",
      notes: "Booked after follow-up review",
      assignedUserId: primary.userId,
      source: "phone",
      transcript: "Caller was interested in Invisalign, asked about availability and booked a consultation for next week. Patient sounded happy with the plan.",
      missedRecoveryStatus: "resolved",
    });

    const refreshedCall = await callsService.getCall(primary.clinicId, firstCallId);
    assert.equal(refreshedCall.commercialOutcome, "booked_consult");
    assert.equal(refreshedCall.disposition, "booked");
    assert.equal(refreshedCall.notes, "Booked after follow-up review");
    assert.equal(refreshedCall.source, "phone");
    assert.equal(refreshedCall.assignedTo, "CallsCommercialPrimary Admin");
    assert.equal(callsService.getOutcomeOptions().some((item) => item.value === "missed_no_answer"), true);
    const callCsv = await callsService.exportCallsCsv(primary.clinicId);
    assert.equal(callCsv.includes("booked_consult"), true);
    assert.equal(callCsv.includes("Existing Caller"), true);

    const intelligentCall = await callsService.generateCallIntelligence(primary.clinicId, primary.userId, firstCallId);
    assert.equal(intelligentCall.bookingIntent, "booked");
    assert.equal(intelligentCall.sentiment, "positive");
    assert.equal(intelligentCall.treatmentMentioned, "Invisalign");
    assert.equal(intelligentCall.qualityScore >= 80, true);
    assert.equal(intelligentCall.aiSummary.includes("Invisalign"), true);
    assert.ok(intelligentCall.summaryGeneratedAt);

    const transcribedCall = await callsService.transcribeCallRecording(primary.clinicId, primary.userId, firstCallId, {
      generateIntelligence: false,
    });
    assert.equal(transcribedCall.transcript.includes("Transcript unavailable"), true);
    assert.equal(transcribedCall.transcript.includes("Booked after follow-up review"), true);

    const [activityRows]: any = await pool.execute(
      `SELECT metadata
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND type = 'Call'
       ORDER BY created_at DESC
       LIMIT 10`,
      [primary.clinicId, existingContact.contact.id],
    );

    const metadata = activityRows
      .map((row: any) => typeof row.metadata === "string" ? JSON.parse(row.metadata) : row.metadata)
      .find((row: any) => row?.action === "call.updated" && row?.changes?.commercialOutcome === "booked_consult");
    assert.ok(metadata, "Expected call.updated activity to be logged");
    assert.equal(metadata.action, "call.updated");
    assert.equal(metadata.changes?.commercialOutcome, "booked_consult");
    assert.equal(metadata.changes?.notesChanged, true);

    const newContactWebhook = await callsService.handleTwilioCallWebhook({
      CallSid: secondCallSid,
      AccountSid: "AC99999999999999999999999999999999",
      CallStatus: "completed",
      Direction: "inbound",
      From: secondPhone,
      To: trackingNumber,
      CallDuration: "95",
      Duration: "95",
      StartTime: "2026-05-28T10:00:00Z",
      EndTime: "2026-05-28T10:01:35Z",
    });

    assert.equal(newContactWebhook.created, true);
    assert.equal(newContactWebhook.matched, true);
    secondCallId = newContactWebhook.callId as string;

    const newCall = await callsService.getCall(primary.clinicId, secondCallId);
    secondCallContactId = newCall.contactId;
    assert.equal(newCall.contactName, "Unknown Caller");

    await assert.rejects(
      () => callsService.transcribeCallRecording(primary.clinicId, primary.userId, secondCallId),
      (error: any) => error?.statusCode === 400,
      "Calls without recordings should not be transcribed",
    );

    const [newContactRows]: any = await pool.execute(
      `SELECT first_name as firstName,
              last_name as lastName,
              phone,
              source,
              tags
       FROM contact
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [secondCallContactId, primary.clinicId],
    );

    const createdContact = newContactRows[0] || {};
    assert.equal(createdContact.firstName, "Unknown");
    assert.equal(createdContact.lastName, "Caller");
    assert.equal(String(createdContact.phone || ""), secondPhone.replace(/\D/g, ""));
    assert.equal(createdContact.source, "twilio_call");

    await pool.execute(
      `UPDATE \` call \`
       SET created_at = CASE
         WHEN id = ? THEN '2026-06-15 09:00:00'
         WHEN id = ? THEN '2026-07-15 10:00:00'
         ELSE created_at
       END
       WHERE clinic_id = ? AND id IN (?, ?)`,
      [firstCallId, secondCallId, primary.clinicId, firstCallId, secondCallId],
    );

    const summary = await callsService.getCallSummary(primary.clinicId);
    assert.equal(summary.totalCalls, 3);
    assert.equal(summary.connectedCalls, 3);
    assert.equal(summary.bookedConsults, 1);
    assert.equal(summary.callToBookingRate, 33);

    const juneSummary = await callsService.getCallSummary(primary.clinicId, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    assert.equal(juneSummary.totalCalls, 1);
    assert.equal(juneSummary.bookedConsults, 1);

    const juneCalls = await callsService.listCalls(primary.clinicId, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    assert.equal(juneCalls.length, 1);
    assert.equal(juneCalls[0]?.id, firstCallId);

    const staffMetrics = await callsService.getStaffCallMetrics(primary.clinicId);
    const assignedStaff = staffMetrics.find((row: { userId?: string | null }) => row.userId === primary.userId);
    assert.ok(assignedStaff, "Expected assigned staff metrics to exist");
    assert.equal(assignedStaff?.totalCalls >= 1, true);
    assert.equal(assignedStaff?.bookedConsults >= 1, true);
    assert.equal(assignedStaff?.scoredCalls >= 1, true);
    assert.equal(typeof assignedStaff?.averageQualityScore, "number");

    const juneStaffMetrics = await callsService.getStaffCallMetrics(primary.clinicId, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    assert.equal(juneStaffMetrics.length, 1);
    assert.equal(juneStaffMetrics[0]?.userId, primary.userId);
    assert.equal(juneStaffMetrics[0]?.totalCalls, 1);

    const aiBreakdowns = await callsService.getCallAnalyticsBreakdowns(primary.clinicId, {
      startDate: "2026-06-01",
      endDate: "2026-06-30",
    });
    assert.equal(aiBreakdowns.some((row: any) => row.categoryType === "sentiment" && row.categoryKey === "positive" && row.scoredCalls === 1), true);
    assert.equal(aiBreakdowns.some((row: any) => row.categoryType === "treatment" && row.label === "Invisalign"), true);

    const emptyBreakdowns = await callsService.getCallAnalyticsBreakdowns(primary.clinicId, {
      startDate: "2026-08-01",
      endDate: "2026-08-31",
    });
    assert.deepEqual(emptyBreakdowns, []);

    const emptySummary = await callsService.getCallSummary(secondary.clinicId);
    assert.equal(emptySummary.totalCalls, 0);
    assert.equal(emptySummary.missedCalls, 0);
    assert.equal(emptySummary.bookedConsults, 0);

    const emptyStaffMetrics = await callsService.getStaffCallMetrics(secondary.clinicId);
    assert.deepEqual(emptyStaffMetrics, []);

    await assert.rejects(
      () => callsService.getCall(secondary.clinicId, firstCallId),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to view the call",
    );

    await assert.rejects(
      () => callsService.updateCall(secondary.clinicId, secondary.userId, firstCallId, {
        commercialOutcome: "lost",
      }),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to update the call",
    );

    await assert.rejects(
      () => callsService.generateCallIntelligence(secondary.clinicId, secondary.userId, firstCallId),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to generate call intelligence",
    );

    await assert.rejects(
      () => callsService.transcribeCallRecording(secondary.clinicId, secondary.userId, firstCallId),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to transcribe the call",
    );

    console.log("[calls-commercial] outcome, contact linking, and metrics test passed");
  } finally {
    await pool.execute(
      `DELETE FROM activity
       WHERE clinic_id = ?
         AND contact_id IN (?, ?)` ,
      [primary.clinicId, firstCallContactId, secondCallContactId || firstCallContactId],
    );

    await pool.execute(
      `DELETE FROM \` call \`
       WHERE clinic_id = ?
         AND (twilio_call_sid IN (?, ?) OR id = ?)`,
      [primary.clinicId, firstCallSid, secondCallSid, manualCallId || "none"],
    );

    await pool.execute(
      `DELETE FROM contact
       WHERE clinic_id = ?
         AND id IN (?, ?)` ,
      [primary.clinicId, firstCallContactId, secondCallContactId || firstCallContactId],
    );

    await pool.execute(
      `DELETE FROM call_tracking_number
       WHERE clinic_id = ?
         AND normalized_number = ?`,
      [primary.clinicId, normalizedNumber],
    );
    await pool.end();
  }
});
