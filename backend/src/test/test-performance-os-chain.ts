import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { appointmentsService } from "../modules/appointments/appointments.service.js";
import { callsService } from "../modules/calls/calls.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { consultsService } from "../modules/consults/consults.service.js";
import { insightsService } from "../modules/insights/insights.service.js";

const CALL_TABLE = "`\u00A0call\u00A0`";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toMysqlDatetime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

function nextWeekdayDate(daysAhead = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);
  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }
  return date;
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

async function createPatientUser(clinicId: string, prefix: string) {
  const result = await authService.registerPatient({
    clinicId,
    email: uniqueEmail(`${prefix}_patient`),
    password: "password123",
    firstName: prefix,
    lastName: "Patient",
    phone: "555-0199",
  });

  return {
    userId: result.user.id,
    token: result.tokens.token,
  };
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

test("Performance OS attribution chain links source to revenue, insight, alert, and action task with tenant safety", async () => {
  await testConnection();
  console.log("[performance-os] database connection OK");

  const primary = await createClinicAndAdmin("PerformanceOsPrimary");
  const secondary = await createClinicAndAdmin("PerformanceOsSecondary");
  const patient = await createPatientUser(primary.clinicId, "PerformanceOs");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start performance OS test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  const campaignId = uuidv4();
  const attributionId = uuidv4();
  const formId = uuidv4();
  const submissionId = uuidv4();
  const trackingId = uuidv4();
  const insightId = uuidv4();
  const alertId = uuidv4();
  const trackingNumber = "+1 (555) 902-0001";
  const normalizedTrackingNumber = trackingNumber.replace(/\D/g, "");
  const appointmentDate = nextWeekdayDate(1);
  appointmentDate.setHours(10, 0, 0, 0);
  let availabilityId = "";
  let appointmentId = "";
  let consultId = "";
  let callId = "";
  let taskId = "";

  const lead = await contactsService.createContact(primary.clinicId, primary.userId, {
    firstName: "Performance",
    lastName: "Lead",
    email: uniqueEmail("performance_chain_lead"),
    phone: "+1 (555) 220-0001",
    source: "meta_ads",
    status: "lead",
    value: 7800,
    treatmentInterests: ["Performance Veneers"],
    notes: "Lead for attribution chain test",
  });

  try {
    await pool.execute(
      `INSERT INTO campaign
        (id, clinic_id, name, description, type, status, start_date, end_date, budget, channel)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        campaignId,
        primary.clinicId,
        "Performance OS Launch",
        "Campaign used by attribution chain test",
        "paid_search",
        "active",
        toDateOnly(new Date()),
        toDateOnly(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)),
        2500,
        "paid_search",
      ],
    );

    await pool.execute(
      `INSERT INTO attribution
        (id, clinic_id, contact_id, campaign_id, channel, touchpoint_date, conversion_date, value)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attributionId,
        primary.clinicId,
        lead.contact.id,
        campaignId,
        "paid_search",
        toMysqlDatetime(new Date()),
        toMysqlDatetime(appointmentDate),
        7800,
      ],
    );

    await pool.execute(
      `INSERT INTO form_definition (id, clinic_id, name, type, status, fields, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [formId, primary.clinicId, "Performance Lead Form", "Lead", "active", JSON.stringify([]), primary.userId],
    );

    await pool.execute(
      `INSERT INTO form_submission (id, clinic_id, form_id, submitted_data)
       VALUES (?, ?, ?, ?)`,
      [
        submissionId,
        primary.clinicId,
        formId,
        JSON.stringify({
          email: lead.contact.email,
          phone: lead.contact.phone,
          source: "meta_ads",
          campaign: "Performance OS Launch",
          treatment: "Performance Veneers",
        }),
      ],
    );

    await pool.execute(
      `INSERT INTO call_tracking_number
        (id, clinic_id, phone_number, normalized_number, label, is_active)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [trackingId, primary.clinicId, trackingNumber, normalizedTrackingNumber, "Performance OS inbound line"],
    );

    const callResult = await callsService.handleTwilioCallWebhook({
      CallSid: `CA${uuidv4().replace(/-/g, "").slice(0, 32)}`,
      AccountSid: "AC99999999999999999999999999999999",
      CallStatus: "completed",
      Direction: "inbound",
      From: lead.contact.phone,
      To: trackingNumber,
      CallDuration: "180",
      Duration: "180",
      StartTime: "2026-06-01T11:00:00Z",
      EndTime: "2026-06-01T11:03:00Z",
    });
    callId = callResult.callId as string;
    await callsService.updateCall(primary.clinicId, primary.userId, callId, {
      commercialOutcome: "booked_consult",
      source: "meta_ads",
      notes: "Booked from Performance OS attribution test",
    });

    await pool.execute(
      `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), primary.clinicId, lead.contact.id, primary.userId, "Thanks, your consult is booked.", "outbound", "sent"],
    );

    availabilityId = await ensureClinicianAvailability(primary.clinicId, primary.userId, appointmentDate);
    const appointment = await appointmentsService.createAppointment(primary.clinicId, primary.userId, {
      contactId: lead.contact.id,
      clinicianId: primary.userId,
      dateTime: appointmentDate.toISOString(),
      status: "completed",
      treatment: "Performance Veneers",
      valueCents: 780000,
      durationMinutes: 45,
      consultNotes: "Completed consult from attribution chain test",
    });
    appointmentId = appointment.id;

    const consult = await consultsService.createConsult(primary.clinicId, primary.userId, {
      contactId: lead.contact.id,
      appointmentId,
      patientName: "Performance Lead",
      treatment: "Performance Veneers",
      practitioner: "PerformanceOsPrimary Admin",
      practitionerId: primary.userId,
      outcome: "Treatment Booked",
      revenue: 7800,
      date: appointment.dateTime,
      notes: "Sold treatment from attribution chain test",
      depositStatus: "paid",
    });
    consultId = consult.id;

    await pool.execute(
      `INSERT INTO insight
        (id, clinic_id, type, severity, title, summary, recommended_action,
         source_type, source_id, source_contact_id, status, generated_from, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        insightId,
        primary.clinicId,
        "high_value_conversion",
        "high",
        "High-value treatment sold from paid search",
        "Paid search lead converted to treatment revenue.",
        "Review campaign budget and follow-up sequence.",
        "consult",
        consultId,
        lead.contact.id,
        "open",
        "performance_os_chain",
        JSON.stringify({ revenue: 7800, source: "meta_ads" }),
        primary.userId,
      ],
    );

    const taskResult = await insightsService.createActionTask(primary.clinicId, primary.userId, insightId, {
      assignedTo: "PerformanceOsPrimary Admin",
      dueDate: toDateOnly(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)),
    });
    taskId = taskResult.taskId;

    await pool.execute(
      `INSERT INTO performance_alert
        (id, clinic_id, type, severity, title, summary, source_type, source_id,
         source_contact_id, insight_id, status, metadata, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        alertId,
        primary.clinicId,
        "revenue_follow_up",
        "medium",
        "Revenue follow-up needed",
        "Treatment sold; make sure handoff and retention actions are assigned.",
        "insight",
        insightId,
        lead.contact.id,
        insightId,
        "open",
        JSON.stringify({ actionTaskId: taskId }),
        primary.userId,
      ],
    );

    const patientForbidden = await fetchJson(
      baseUrl,
      `/api/performance-os/attribution-chain?contactId=${lead.contact.id}`,
      patient.token,
    );
    assert.equal(patientForbidden.response.status, 403);
    console.log("[performance-os] patient blocked from attribution chain passed");

    const secondaryBoundary = await fetchJson(
      baseUrl,
      `/api/performance-os/attribution-chain?contactId=${lead.contact.id}`,
      secondary.token,
    );
    assert.equal(secondaryBoundary.response.status, 404);
    console.log("[performance-os] tenant boundary passed");

    const chainResponse = await fetchJson(
      baseUrl,
      `/api/performance-os/attribution-chain?contactId=${lead.contact.id}`,
      primary.token,
    );
    assert.equal(chainResponse.response.status, 200);
    const chain = chainResponse.body.data;
    assert.equal(chain.contact.id, lead.contact.id);
    assert.equal(chain.source.label, "meta_ads");
    assert.equal(chain.source.primaryCampaign, "Performance OS Launch");
    assert.equal(chain.campaigns.length, 1);
    assert.equal(chain.campaigns[0].channel, "paid_search");
    assert.equal(chain.touchpoints.forms.length, 1);
    assert.equal(chain.touchpoints.calls.length, 1);
    assert.equal(chain.touchpoints.calls[0].outcome, "booked_consult");
    assert.equal(chain.touchpoints.messages.length, 1);
    assert.equal(chain.bookings.length, 1);
    assert.equal(chain.bookings[0].id, appointmentId);
    assert.equal(chain.consultations.length, 1);
    assert.equal(chain.consultations[0].outcome, "Treatment Booked");
    assert.equal(chain.treatments.length, 1);
    assert.equal(chain.treatments[0].sold, true);
    assert.equal(chain.revenue.total, 7800);
    assert.equal(chain.insights.length, 1);
    assert.equal(chain.insights[0].actionTaskId, taskId);
    assert.equal(chain.alerts.length, 1);
    assert.equal(chain.alerts[0].id, alertId);
    assert.deepEqual(chain.unknowns, []);
    console.log("[performance-os] full attribution chain passed");

    const alertsResponse = await fetchJson(
      baseUrl,
      `/api/performance-os/alerts?contactId=${lead.contact.id}&status=open`,
      primary.token,
    );
    assert.equal(alertsResponse.response.status, 200);
    assert.equal(alertsResponse.body.data.length, 1);
    assert.equal(alertsResponse.body.data[0].title, "Revenue follow-up needed");
    console.log("[performance-os] alerts API passed");
  } finally {
    await pool.execute(`DELETE FROM performance_alert WHERE clinic_id = ? AND id = ?`, [primary.clinicId, alertId]);
    await pool.execute(`UPDATE insight SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, insightId]);
    if (taskId) {
      await pool.execute(`UPDATE task SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, taskId]);
    }
    if (consultId) {
      await pool.execute(`UPDATE manual_consult_entry SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, consultId]);
    }
    if (appointmentId) {
      await pool.execute(`UPDATE appointment SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, appointmentId]);
    }
    await pool.execute(`DELETE FROM clinician_availability WHERE clinic_id = ? AND id = ?`, [primary.clinicId, availabilityId]);
    await pool.execute(`DELETE FROM sms WHERE clinic_id = ? AND contact_id = ?`, [primary.clinicId, lead.contact.id]);
    if (callId) {
      await pool.execute(`UPDATE ${CALL_TABLE} SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, callId]);
    }
    await pool.execute(`DELETE FROM call_tracking_number WHERE clinic_id = ? AND id = ?`, [primary.clinicId, trackingId]);
    await pool.execute(`UPDATE attribution SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, attributionId]);
    await pool.execute(`UPDATE campaign SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, campaignId]);
    await pool.execute(`DELETE FROM form_submission WHERE clinic_id = ? AND id = ?`, [primary.clinicId, submissionId]);
    await pool.execute(`UPDATE form_definition SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, formId]);
    await pool.execute(`DELETE FROM activity WHERE clinic_id = ? AND contact_id = ?`, [primary.clinicId, lead.contact.id]);
    await pool.execute(`UPDATE contact SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL`, [primary.clinicId, lead.contact.id]);
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
  }

  console.log("[performance-os] integration test completed successfully");
});
