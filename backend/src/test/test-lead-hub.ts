import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { pipelineDealsService } from "../modules/pipeline/pipeline.deals.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

const CALL_TABLE = "`\u00A0call\u00A0`";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

function toMysqlDatetime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function ensureClinicianAvailability(clinicId: string, clinicianId: string, date: Date) {
  const availabilityId = uuidv4();
  await pool.execute(
    `INSERT INTO clinician_availability
      (id, clinic_id, clinician_id, day_of_week, start_time, end_time, slot_interval_minutes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [availabilityId, clinicId, clinicianId, date.getDay(), "09:00:00", "17:00:00", 30],
  );
  return availabilityId;
}

async function createClinicAndAdmin(prefix: string) {
  return createTestClinicAndAdmin(prefix);
}

async function fetchJson(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(init.headers || {}),
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function fetchText(baseUrl: string, path: string, token: string, init: RequestInit = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
      ...(init.headers || {}),
    },
  });
  const body = await response.text();
  return { response, body };
}

async function closeServer(server: Server) {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => (error ? reject(error) : resolve()));
  });
}

test("lead hub API supports lead CRUD, detail activity, required stages, stage moves, lost reason, and tenant safety", async () => {
  await testConnection();
  console.log("[lead-hub] database connection OK");

  const primary = await createClinicAndAdmin("LeadHubPrimary");
  const secondary = await createClinicAndAdmin("LeadHubSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start lead hub test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let contactId = "";
  let dealId = "";
  const formId = uuidv4();
  const formSubmissionId = uuidv4();
  const appointmentId = uuidv4();
  const smsId = uuidv4();
  const callId = uuidv4();
  const templateId = uuidv4();
  const convertedClientClinicId = uuidv4();
  const convertedClientProfileId = uuidv4();
  const convertedClientContactLinkId = uuidv4();
  let drawerAppointmentId = "";
  let drawerDepositId = "";
  let drawerTaskId = "";
  let drawerMessageId = "";
  let drawerAvailabilityId = "";

  try {
    const createLead = await fetchJson(baseUrl, "/api/contacts", primary.token, {
      method: "POST",
      body: JSON.stringify({
        firstName: "Lead",
        lastName: "Hub",
        email: uniqueEmail("lead_hub"),
        phone: "+1 (555) 230-0001",
        status: "New",
        source: "meta_ads",
        value: 4200,
        treatmentInterests: ["Dental Implants"],
        tags: ["lead-hub"],
        notes: "Manual lead creation from lead hub test",
      }),
    });
    assert.equal(createLead.response.status, 201);
    contactId = createLead.body.data.contact.id;
    assert.ok(contactId);
    assert.equal(createLead.body.data.contact.source, "meta_ads");
    assert.deepEqual(createLead.body.data.contact.treatmentInterests, ["Dental Implants"]);
    console.log("[lead-hub] manual lead creation passed");

    const searchList = await fetchJson(baseUrl, "/api/contacts?search=Dental&source=meta_ads&status=New", primary.token);
    assert.equal(searchList.response.status, 200);
    assert.equal(searchList.body.data.contacts.some((contact: any) => contact.id === contactId), true);
    console.log("[lead-hub] lead inbox search/filter passed");

    const exportCsv = await fetchText(baseUrl, "/api/contacts/export/csv?source=meta_ads&campaign=meta", primary.token);
    assert.equal(exportCsv.response.status, 200);
    assert.equal(exportCsv.response.headers.get("content-type")?.includes("text/csv"), true);
    assert.equal(exportCsv.body.includes("Dental Implants"), true);
    console.log("[lead-hub] filtered CSV export passed");

    const updateLead = await fetchJson(baseUrl, `/api/contacts/${contactId}`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({
        status: "Qualified",
        notes: "Qualified and ready for booking",
        lastContactAt: new Date().toISOString(),
      }),
    });
    assert.equal(updateLead.response.status, 200);
    assert.equal(updateLead.body.data.status, "Qualified");
    assert.equal(updateLead.body.data.notes, "Qualified and ready for booking");
    console.log("[lead-hub] lead status update passed");

    const contacted = await fetchJson(baseUrl, `/api/contacts/${contactId}/mark-contacted`, primary.token, {
      method: "PATCH",
    });
    assert.equal(contacted.response.status, 200);
    assert.ok(contacted.body.data.firstResponseAt);
    console.log("[lead-hub] first response tracking passed");

    const slaCheck = await fetchJson(baseUrl, "/api/sla/check-breaches", primary.token, {
      method: "POST",
    });
    assert.equal(slaCheck.response.status, 200);
    assert.equal(slaCheck.body.data.clinicsChecked, 1);
    console.log("[lead-hub] manual SLA trigger passed");

    await pool.execute(
      `INSERT INTO form_definition (id, clinic_id, name, type, status, fields, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [formId, primary.clinicId, "Lead Hub Form", "Lead", "active", JSON.stringify([]), primary.userId],
    );
    await pool.execute(
      `INSERT INTO form_submission (id, clinic_id, form_id, submitted_data)
       VALUES (?, ?, ?, ?)`,
      [
        formSubmissionId,
        primary.clinicId,
        formId,
        JSON.stringify({
          email: createLead.body.data.contact.email,
          phone: createLead.body.data.contact.phone,
          source: "meta_ads",
          treatment: "Dental Implants",
        }),
      ],
    );
    await pool.execute(
      `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [smsId, primary.clinicId, contactId, primary.userId, "Lead follow-up sent", "outbound", "sent"],
    );
    await pool.execute(
      `INSERT INTO ${CALL_TABLE}
        (id, clinic_id, contact_id, user_id, source, direction, call_status, outcome, duration, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        callId,
        primary.clinicId,
        contactId,
        primary.userId,
        "Call log",
        "inbound",
        "completed",
        "follow_up_required",
        240,
        "Initial drawer action call",
      ],
    );
    await pool.execute(
      `INSERT INTO appointment
        (id, clinic_id, contact_id, clinician_id, date_time, status, treatment, value, duration_minutes, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        appointmentId,
        primary.clinicId,
        contactId,
        primary.userId,
        toMysqlDatetime(new Date(Date.now() + 24 * 60 * 60 * 1000)),
        "Scheduled",
        "Dental Implants",
        4200,
        45,
        primary.userId,
      ],
    );

    const activity = await fetchJson(baseUrl, `/api/contacts/${contactId}/activity`, primary.token);
    assert.equal(activity.response.status, 200);
    assert.equal(activity.body.data.counts.calls, 1);
    assert.equal(activity.body.data.counts.forms, 1);
    assert.equal(activity.body.data.counts.messages, 1);
    assert.equal(activity.body.data.counts.appointments, 1);
    assert.equal(activity.body.data.counts.timeline >= 2, true);
    assert.equal(activity.body.data.actions.some((action: any) => action.key === "create_booking" && action.enabled), true);
    assert.equal(activity.body.data.calls[0].actions.includes("log_call_outcome"), true);
    assert.equal(activity.body.data.forms[0].href.includes("/app/forms/submissions"), true);
    console.log("[lead-hub] lead detail linked activity passed");

    const callOutcome = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/call-outcome`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        callId,
        commercialOutcome: "booked_consult",
        bookingIntent: "booked",
        notes: "Booked from lead drawer call outcome",
      }),
    });
    assert.equal(callOutcome.response.status, 200);
    assert.equal(callOutcome.body.data.record.commercialOutcome, "booked_consult");
    assert.equal(callOutcome.body.data.activity.calls[0].outcome, "booked_consult");
    console.log("[lead-hub] drawer call outcome action passed");

    await pool.execute(
      `INSERT INTO message_template (id, clinic_id, name, channel, subject, body, status, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        templateId,
        primary.clinicId,
        `Lead drawer follow-up ${Date.now()}`,
        "sms",
        null,
        "Hi {{patient_name}}, thanks for speaking with us about {{treatment}}.",
        "active",
        primary.userId,
      ],
    );

    const messageAction = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/message-template`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        templateId,
        sendNow: false,
        variables: { treatment: "Dental Implants" },
      }),
    });
    assert.equal(messageAction.response.status, 201);
    drawerMessageId = messageAction.body.data.record.id;
    assert.equal(messageAction.body.data.record.channel, "sms");
    assert.equal(messageAction.body.data.record.status, "queued");
    assert.equal(messageAction.body.data.activity.counts.messages >= 2, true);
    console.log("[lead-hub] drawer message template action passed");

    const drawerBookingDate = new Date(Date.now() + 48 * 60 * 60 * 1000);
    drawerBookingDate.setHours(10, 0, 0, 0);
    drawerAvailabilityId = await ensureClinicianAvailability(primary.clinicId, primary.userId, drawerBookingDate);

    const bookingAction = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/booking`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        dateTime: drawerBookingDate.toISOString(),
        clinicianId: primary.userId,
        treatment: "Dental Implants",
        valueCents: 420000,
        durationMinutes: 45,
        consultNotes: "Created from lead drawer action",
      }),
    });
    assert.equal(bookingAction.response.status, 201);
    drawerAppointmentId = bookingAction.body.data.record.id;
    assert.equal(bookingAction.body.data.record.contactId, contactId);
    assert.equal(bookingAction.body.data.activity.appointments.some((item: any) => item.id === drawerAppointmentId), true);
    console.log("[lead-hub] drawer booking action passed");

    const depositAction = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/deposit`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        appointmentId: drawerAppointmentId,
        treatment: "Dental Implants",
        depositAmount: 250,
        depositPaid: false,
        status: "requested",
        depositRequested: true,
      }),
    });
    assert.equal(depositAction.response.status, 201);
    drawerDepositId = depositAction.body.data.record.id;
    assert.equal(depositAction.body.data.activity.deposits.some((item: any) => item.id === drawerDepositId), true);

    const paidDepositAction = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/deposit`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        depositId: drawerDepositId,
        depositPaid: true,
        paidDate: new Date().toISOString(),
        method: "card",
        status: "paid",
      }),
    });
    assert.equal(paidDepositAction.response.status, 200);
    assert.equal(paidDepositAction.body.data.activity.deposits.some((item: any) => item.id === drawerDepositId && item.depositPaid), true);
    console.log("[lead-hub] drawer deposit action passed");

    const taskAction = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/task`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        title: "Call lead back after drawer action test",
        description: "Created from lead drawer",
        priority: "high",
        dueDate: new Date(Date.now() + 72 * 60 * 60 * 1000).toISOString(),
      }),
    });
    assert.equal(taskAction.response.status, 201);
    drawerTaskId = taskAction.body.data.record.id;
    assert.equal(taskAction.body.data.activity.tasks.some((item: any) => item.id === drawerTaskId), true);
    console.log("[lead-hub] drawer task action passed");

    const foreignAction = await fetchJson(baseUrl, `/api/contacts/${contactId}/actions/task`, secondary.token, {
      method: "POST",
      body: JSON.stringify({ title: "Cross clinic task" }),
    });
    assert.equal(foreignAction.response.status, 404);
    console.log("[lead-hub] drawer action tenant safety passed");

    const stagesResponse = await fetchJson(baseUrl, "/api/pipeline/stages", primary.token);
    assert.equal(stagesResponse.response.status, 200);
    const stageNames = stagesResponse.body.data.map((stage: any) => stage.name);
    assert.deepEqual(stageNames, [
      "New Lead",
      "Contact Needed",
      "Contact Attempted",
      "Spoken To",
      "Free Audit Needed",
      "Free Audit In Progress",
      "Audit Complete",
      "Dashboard Access Given",
      "Proposal Needed",
      "Proposal Sent",
      "Follow-up Needed",
      "Negotiation",
      "Won",
      "Lost",
      "Nurture",
      "Future Opportunity",
    ]);
    console.log("[lead-hub] required pipeline stages passed");

    const newStage = stagesResponse.body.data.find((stage: any) => stage.name === "New Lead");
    const auditStage = stagesResponse.body.data.find((stage: any) => stage.name === "Free Audit In Progress");
    const lostStage = stagesResponse.body.data.find((stage: any) => stage.name === "Lost");
    assert.ok(newStage && auditStage && lostStage);

    const createDeal = await fetchJson(baseUrl, "/api/pipeline/deals", primary.token, {
      method: "POST",
      body: JSON.stringify({
        contactId,
        stageId: newStage.id,
        valueCents: 420000,
        source: "meta_ads",
        treatment: "Dental Implants",
        probability: 25,
      }),
    });
    assert.equal(createDeal.response.status, 201);
    dealId = createDeal.body.data.id;
    assert.equal(createDeal.body.data.contactId, contactId);
    assert.equal(createDeal.body.data.priority, "high");
    assert.ok(createDeal.body.data.nextFollowUpDate);

    const auditMove = await fetchJson(baseUrl, `/api/pipeline/deals/${dealId}/move`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({
        stageId: auditStage.id,
        notes: "Audit started from lead hub",
      }),
    });
    assert.equal(auditMove.response.status, 200);
    assert.equal(auditMove.body.data.stageName, "Free Audit In Progress");

    const invalidLostMove = await fetchJson(baseUrl, `/api/pipeline/deals/${dealId}/move`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({ stageId: lostStage.id }),
    });
    assert.equal(invalidLostMove.response.status, 400);

    const lostMove = await fetchJson(baseUrl, `/api/pipeline/deals/${dealId}/move`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({
        stageId: lostStage.id,
        lostReason: "budget",
        objectionType: "budget",
        notes: "Lost after follow-up",
      }),
    });
    assert.equal(lostMove.response.status, 200);
    assert.equal(lostMove.body.data.status, "lost");
    assert.equal(lostMove.body.data.lostReason, "budget");
    assert.equal(lostMove.body.data.objectionType, "budget");

    const reopenedMove = await fetchJson(baseUrl, `/api/pipeline/deals/${dealId}/move`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({ stageId: auditStage.id }),
    });
    assert.equal(reopenedMove.response.status, 200);
    assert.equal(reopenedMove.body.data.status, "open");
    assert.equal(reopenedMove.body.data.lostReason, "budget");
    assert.equal(reopenedMove.body.data.objectionType, "budget");

    const [reopenedRows]: any = await pool.execute(
      `SELECT d.status,
              d.lost_reason as dealLostReason,
              d.objection_type as dealObjectionType,
              c.lead_status as contactLeadStatus,
              c.lost_reason as contactLostReason,
              c.objection_type as contactObjectionType
       FROM deal d
       JOIN contact c
         ON c.id = d.contact_id
        AND c.clinic_id = d.clinic_id
       WHERE d.clinic_id = ?
         AND d.id = ?`,
      [primary.clinicId, dealId],
    );
    assert.equal(reopenedRows[0]?.status, "open");
    assert.equal(reopenedRows[0]?.dealLostReason, "budget");
    assert.equal(reopenedRows[0]?.dealObjectionType, "budget");
    assert.equal(
      reopenedRows[0]?.contactLeadStatus,
      "lost",
      "reopening preserves the contact's Lost classification until a separate lead update",
    );
    assert.equal(reopenedRows[0]?.contactLostReason, "budget");
    assert.equal(reopenedRows[0]?.contactObjectionType, "budget");

    await pool.execute(
      `INSERT INTO clinic
        (id, name, email, phone, timezone, subscription_plan, subscription_status, max_users)
       VALUES (?, ?, ?, '555-0199', 'Europe/London', 'professional', 'active', 5)`,
      [
        convertedClientClinicId,
        `Lead Hub Converted Client ${convertedClientClinicId}`,
        uniqueEmail("lead_hub_converted_client"),
      ],
    );
    await pool.execute(
      `INSERT INTO client_account_profile
        (id, clinic_id, client_status, current_package, created_by, updated_by)
       VALUES (?, ?, 'active', 'Dental Implants Growth', ?, ?)`,
      [
        convertedClientProfileId,
        convertedClientClinicId,
        primary.userId,
        primary.userId,
      ],
    );
    await pool.execute(
      `INSERT INTO client_account_contact
        (id, clinic_id, client_account_profile_id, contact_id, created_by)
       VALUES (?, ?, ?, ?, ?)`,
      [
        convertedClientContactLinkId,
        primary.clinicId,
        convertedClientProfileId,
        contactId,
        primary.userId,
      ],
    );
    await pool.execute(
      `UPDATE deal
       SET client_account_profile_id = ?,
           client_converted_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?`,
      [convertedClientProfileId, primary.clinicId, dealId],
    );
    await pool.execute(
      `UPDATE contact
       SET status = 'active',
           lead_status = 'qualified'
       WHERE clinic_id = ?
         AND id = ?`,
      [primary.clinicId, contactId],
    );

    const lostReentry = await fetchJson(baseUrl, `/api/pipeline/deals/${dealId}/move`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({ stageId: lostStage.id }),
    });
    assert.equal(lostReentry.response.status, 200);
    assert.equal(lostReentry.body.data.status, "lost");
    assert.equal(lostReentry.body.data.lostReason, "budget");
    assert.equal(lostReentry.body.data.objectionType, "budget");

    const [convertedContactRows]: any = await pool.execute(
      `SELECT c.status,
              c.lead_status as leadStatus,
              c.lost_reason as lostReason,
              c.objection_type as objectionType,
              d.client_account_profile_id as dealProfileId,
              cap.id as profileId,
              cac.id as contactLinkId
       FROM contact c
       JOIN deal d
         ON d.contact_id = c.id
        AND d.clinic_id = c.clinic_id
       JOIN client_account_profile cap
         ON cap.id = d.client_account_profile_id
       JOIN client_account_contact cac
         ON cac.clinic_id = c.clinic_id
        AND cac.client_account_profile_id = cap.id
        AND cac.contact_id = c.id
       WHERE c.clinic_id = ?
         AND c.id = ?`,
      [primary.clinicId, contactId],
    );
    assert.equal(convertedContactRows[0]?.status, "active");
    assert.equal(convertedContactRows[0]?.leadStatus, "converted");
    assert.equal(convertedContactRows[0]?.lostReason, "budget");
    assert.equal(convertedContactRows[0]?.objectionType, "budget");
    assert.equal(convertedContactRows[0]?.dealProfileId, convertedClientProfileId);
    assert.equal(convertedContactRows[0]?.profileId, convertedClientProfileId);
    assert.equal(convertedContactRows[0]?.contactLinkId, convertedClientContactLinkId);

    const [lostMovementRows]: any = await pool.execute(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.lostReason')) as lostReason,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.objectionType')) as objectionType
       FROM pipeline_deal_movement
       WHERE clinic_id = ?
         AND deal_id = ?
         AND to_stage_id = ?
       ORDER BY moved_at ASC, created_at ASC`,
      [primary.clinicId, dealId, lostStage.id],
    );
    assert.equal(lostMovementRows.length, 2);
    assert.equal(
      lostMovementRows.every((row: any) => row.lostReason === "budget" && row.objectionType === "budget"),
      true,
    );
    const [lostTimelineRows]: any = await pool.execute(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.lostReason')) as lostReason,
              JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.objectionType')) as objectionType
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.recordId')) = ?
         AND JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.changes.toStage')) = ?`,
      [
        primary.clinicId,
        contactId,
        "lead_stage_changed",
        dealId,
        lostStage.name,
      ],
    );
    assert.equal(lostTimelineRows.length, 2);
    assert.equal(
      lostTimelineRows.every((row: any) => row.lostReason === "budget" && row.objectionType === "budget"),
      true,
    );
    const [lostAuditRows]: any = await pool.execute(
      `SELECT JSON_UNQUOTE(JSON_EXTRACT(changes, '$.lostReason')) as lostReason,
              JSON_UNQUOTE(JSON_EXTRACT(changes, '$.objectionType')) as objectionType,
              JSON_UNQUOTE(JSON_EXTRACT(changes, '$.previousStatus')) as previousStatus,
              JSON_UNQUOTE(JSON_EXTRACT(changes, '$.status')) as status,
              JSON_UNQUOTE(JSON_EXTRACT(changes, '$.fromStageId')) as fromStageId,
              JSON_UNQUOTE(JSON_EXTRACT(changes, '$.toStageId')) as toStageId
       FROM audit_log
       WHERE clinic_id = ?
         AND entity_type = 'deal'
         AND entity_id = ?
         AND action = 'PIPELINE_DEAL_MOVED'
         AND JSON_UNQUOTE(JSON_EXTRACT(changes, '$.toStage')) = ?`,
      [primary.clinicId, dealId, lostStage.name],
    );
    assert.equal(lostAuditRows.length, 2);
    assert.equal(
      lostAuditRows.every((row: any) => row.lostReason === "budget" && row.objectionType === "budget"),
      true,
    );
    assert.equal(
      lostAuditRows.every((row: any) => row.status === "lost" && row.toStageId === lostStage.id),
      true,
    );
    assert.equal(
      lostAuditRows.some((row: any) => row.previousStatus === "open" && row.fromStageId === auditStage.id),
      true,
    );

    const reopenedForRollback = await fetchJson(
      baseUrl,
      `/api/pipeline/deals/${dealId}/move`,
      primary.token,
      {
        method: "PATCH",
        body: JSON.stringify({ stageId: auditStage.id }),
      },
    );
    assert.equal(reopenedForRollback.response.status, 200);
    assert.equal(reopenedForRollback.body.data.status, "open");

    const [rollbackBaselineRows]: any = await pool.execute(
      `SELECT d.pipeline_stage_id as stageId,
              d.status,
              DATE_FORMAT(d.stage_changed_at, '%Y-%m-%d %H:%i:%s') as stageChangedAt,
              DATE_FORMAT(d.lost_at, '%Y-%m-%d %H:%i:%s') as lostAt,
              d.lost_reason as dealLostReason,
              d.objection_type as dealObjectionType,
              c.lead_status as contactLeadStatus,
              c.lost_reason as contactLostReason,
              c.objection_type as contactObjectionType,
              (
                SELECT COUNT(*)
                FROM pipeline_deal_movement movement
                WHERE movement.clinic_id = d.clinic_id
                  AND movement.deal_id = d.id
              ) as movementCount,
              (
                SELECT COUNT(*)
                FROM activity event
                WHERE event.clinic_id = d.clinic_id
                  AND event.contact_id = d.contact_id
                  AND JSON_UNQUOTE(JSON_EXTRACT(event.metadata, '$.recordId')) = d.id
                  AND JSON_UNQUOTE(JSON_EXTRACT(event.metadata, '$.action')) = 'lead_stage_changed'
              ) as timelineCount,
              (
                SELECT COUNT(*)
                FROM audit_log audit
                WHERE audit.clinic_id = d.clinic_id
                  AND audit.entity_type = 'deal'
                  AND audit.entity_id = d.id
                  AND audit.action = 'PIPELINE_DEAL_MOVED'
              ) as auditCount
       FROM deal d
       JOIN contact c
         ON c.id = d.contact_id
        AND c.clinic_id = d.clinic_id
       WHERE d.clinic_id = ?
         AND d.id = ?`,
      [primary.clinicId, dealId],
    );
    assert.equal(rollbackBaselineRows[0]?.stageId, auditStage.id);
    assert.equal(rollbackBaselineRows[0]?.status, "open");

    const pipelineWithPrivateHooks = pipelineDealsService as any;
    const originalLostMoveEventsInserter = pipelineWithPrivateHooks.insertLostMoveEvents;
    pipelineWithPrivateHooks.insertLostMoveEvents = async (...args: any[]) => {
      await originalLostMoveEventsInserter.apply(pipelineDealsService, args);
      throw new Error("Injected Lost movement history failure");
    };
    let failedLostMove: Awaited<ReturnType<typeof fetchJson>> | null = null;
    try {
      failedLostMove = await fetchJson(
        baseUrl,
        `/api/pipeline/deals/${dealId}/move`,
        primary.token,
        {
          method: "PATCH",
          body: JSON.stringify({
            stageId: lostStage.id,
            lostReason: "timing",
            objectionType: "competitor",
            notes: "This transaction must roll back",
          }),
        },
      );
    } finally {
      pipelineWithPrivateHooks.insertLostMoveEvents = originalLostMoveEventsInserter;
    }
    assert.equal(failedLostMove?.response.status, 500);

    const [rolledBackLostRows]: any = await pool.execute(
      `SELECT d.pipeline_stage_id as stageId,
              d.status,
              DATE_FORMAT(d.stage_changed_at, '%Y-%m-%d %H:%i:%s') as stageChangedAt,
              DATE_FORMAT(d.lost_at, '%Y-%m-%d %H:%i:%s') as lostAt,
              d.lost_reason as dealLostReason,
              d.objection_type as dealObjectionType,
              c.lead_status as contactLeadStatus,
              c.lost_reason as contactLostReason,
              c.objection_type as contactObjectionType,
              (
                SELECT COUNT(*)
                FROM pipeline_deal_movement movement
                WHERE movement.clinic_id = d.clinic_id
                  AND movement.deal_id = d.id
              ) as movementCount,
              (
                SELECT COUNT(*)
                FROM activity event
                WHERE event.clinic_id = d.clinic_id
                  AND event.contact_id = d.contact_id
                  AND JSON_UNQUOTE(JSON_EXTRACT(event.metadata, '$.recordId')) = d.id
                  AND JSON_UNQUOTE(JSON_EXTRACT(event.metadata, '$.action')) = 'lead_stage_changed'
              ) as timelineCount,
              (
                SELECT COUNT(*)
                FROM audit_log audit
                WHERE audit.clinic_id = d.clinic_id
                  AND audit.entity_type = 'deal'
                  AND audit.entity_id = d.id
                  AND audit.action = 'PIPELINE_DEAL_MOVED'
              ) as auditCount
       FROM deal d
       JOIN contact c
         ON c.id = d.contact_id
        AND c.clinic_id = d.clinic_id
       WHERE d.clinic_id = ?
         AND d.id = ?`,
      [primary.clinicId, dealId],
    );
    assert.deepEqual(rolledBackLostRows[0], rollbackBaselineRows[0]);
    console.log("[lead-hub] atomic Lost moves, reopen policy and converted-account protection passed");

    const timeline = await fetchJson(baseUrl, `/api/contacts/${contactId}/timeline`, primary.token);
    assert.equal(timeline.response.status, 200);
    assert.equal(
      timeline.body.data.some((item: any) => item.metadata?.action === "lead_stage_changed"),
      true,
    );
    console.log("[lead-hub] timeline stage movement passed");

    const foreignRead = await fetchJson(baseUrl, `/api/contacts/${contactId}`, secondary.token);
    assert.equal(foreignRead.response.status, 404);
    const foreignUpdate = await fetchJson(baseUrl, `/api/contacts/${contactId}`, secondary.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "Lost" }),
    });
    assert.equal(foreignUpdate.response.status, 404);
    console.log("[lead-hub] tenant safety passed");
  } finally {
    if (dealId) {
      await pool.execute(`UPDATE deal SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, dealId]);
    }
    await pool.execute(
      `DELETE FROM client_account_contact
       WHERE id = ?
         AND clinic_id = ?`,
      [convertedClientContactLinkId, primary.clinicId],
    );
    await pool.execute(
      "DELETE FROM client_account_profile WHERE id = ?",
      [convertedClientProfileId],
    );
    await pool.execute(
      "DELETE FROM clinic WHERE id = ?",
      [convertedClientClinicId],
    );
    if (drawerTaskId) {
      await pool.execute(`UPDATE task SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, drawerTaskId]);
    }
    if (drawerDepositId) {
      await pool.execute(`UPDATE deposit_record SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, drawerDepositId]);
    }
    if (drawerAppointmentId) {
      await pool.execute(`UPDATE appointment SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, drawerAppointmentId]);
    }
    if (drawerAvailabilityId) {
      await pool.execute(`DELETE FROM clinician_availability WHERE clinic_id = ? AND id = ?`, [primary.clinicId, drawerAvailabilityId]);
    }
    if (drawerMessageId) {
      await pool.execute(`DELETE FROM sms WHERE clinic_id = ? AND id = ?`, [primary.clinicId, drawerMessageId]);
      await pool.execute(`DELETE FROM email WHERE clinic_id = ? AND id = ?`, [primary.clinicId, drawerMessageId]);
    }
    await pool.execute(`UPDATE appointment SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, appointmentId]);
    await pool.execute(`UPDATE ${CALL_TABLE} SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, callId]);
    await pool.execute(`UPDATE message_template SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, templateId]);
    await pool.execute(`DELETE FROM sms WHERE clinic_id = ? AND id = ?`, [primary.clinicId, smsId]);
    await pool.execute(`DELETE FROM form_submission WHERE clinic_id = ? AND id = ?`, [primary.clinicId, formSubmissionId]);
    await pool.execute(`UPDATE form_definition SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, formId]);
    await pool.execute(`DELETE FROM activity WHERE clinic_id = ? AND contact_id = ?`, [primary.clinicId, contactId]);
    if (contactId) {
      await pool.execute(`UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, contactId]);
    }
    await closeServer(server);
    await pool.end();
  }

  console.log("[lead-hub] integration test completed successfully");
});
