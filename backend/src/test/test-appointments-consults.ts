import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { appointmentsService } from "../modules/appointments/appointments.service.js";
import { consultsService } from "../modules/consults/consults.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const email = uniqueEmail(`${prefix}_admin`);
  const result = await authService.registerClinic({
    clinicName: `${prefix} Clinic`,
    adminEmail: email,
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

async function createContact(clinicId: string, userId: string, prefix: string) {
  const created = await contactsService.createContact(clinicId, userId, {
    firstName: prefix,
    lastName: "Contact",
    email: uniqueEmail(`${prefix}_contact`),
    phone: "555-0200",
    source: "integration-test",
    value: 3500,
    treatmentInterests: ["Injectables"],
  });

  return created.contact;
}

function getNextWeekdayDate(daysAhead = 1) {
  const date = new Date();
  date.setDate(date.getDate() + daysAhead);

  while (date.getDay() === 0 || date.getDay() === 6) {
    date.setDate(date.getDate() + 1);
  }

  return date;
}

async function ensureClinicianAvailability(clinicId: string, clinicianId: string, date: Date) {
  const dayOfWeek = date.getDay();
  const availabilityId = uuidv4();

  await pool.execute(
    `INSERT INTO clinician_availability
      (id, clinic_id, clinician_id, day_of_week, start_time, end_time, slot_interval_minutes, is_active)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1)`,
    [availabilityId, clinicId, clinicianId, dayOfWeek, "09:00:00", "17:00:00", 30],
  );

  return availabilityId;
}

test("appointments and consult outcomes persist for conversion workflows", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("AppointmentsConsults");
  const secondary = await createClinicAndAdmin("AppointmentsConsultsForeign");
  const contact = await createContact(primary.clinicId, primary.userId, "AppointmentsConsults");
  const appointmentDate = getNextWeekdayDate(1);
  appointmentDate.setHours(10, 0, 0, 0);
  const availabilityId = await ensureClinicianAvailability(primary.clinicId, primary.userId, appointmentDate);

  const appointment = await appointmentsService.createAppointment(primary.clinicId, primary.userId, {
    contactId: contact.id,
    clinicianId: primary.userId,
    dateTime: appointmentDate.toISOString(),
    status: "scheduled",
    treatment: "Injectables Consultation",
    valueCents: 250000,
    durationMinutes: 45,
    consultNotes: "Initial consult booked for conversion workflow",
  });

  assert.equal(appointment.status, "scheduled");
  assert.equal(appointment.contactId, contact.id);

  const followUpDate = getNextWeekdayDate(3);
  followUpDate.setHours(11, 0, 0, 0);
  const followUpAvailabilityId = await ensureClinicianAvailability(
    primary.clinicId,
    primary.userId,
    followUpDate,
  );

  const updatedAppointment = await appointmentsService.updateAppointment(
    primary.clinicId,
    primary.userId,
    appointment.id,
    {
      dateTime: followUpDate.toISOString(),
      status: "completed",
      clinicianId: primary.userId,
      treatment: "Injectables Consultation",
      valueCents: 275000,
      consultNotes: "Consult completed and ready for outcome logging",
    },
  );

  assert.equal(updatedAppointment.status, "completed");
  assert.equal(updatedAppointment.valueCents, 275000);
  assert.equal(updatedAppointment.contactId, contact.id);

  const recurringStart = getNextWeekdayDate(8);
  recurringStart.setHours(9, 0, 0, 0);
  const recurringAvailabilityId = await ensureClinicianAvailability(
    primary.clinicId,
    primary.userId,
    recurringStart,
  );
  const recurringAppointment = await appointmentsService.createAppointment(primary.clinicId, primary.userId, {
    contactId: contact.id,
    clinicianId: primary.userId,
    dateTime: recurringStart.toISOString(),
    status: "scheduled",
    treatment: "Weekly Skin Review",
    valueCents: 15000,
    durationMinutes: 30,
    recurrenceRule: { frequency: "weekly", interval: 1, count: 3 },
  });

  assert.ok(recurringAppointment.recurrenceSeriesId, "Recurring appointment should have a series id");
  assert.equal(recurringAppointment.recurrencePosition, 1);
  assert.equal(recurringAppointment.recurrenceRule?.frequency, "weekly");

  const recurringRangeEnd = new Date(recurringStart);
  recurringRangeEnd.setDate(recurringRangeEnd.getDate() + 21);
  const recurringSeries = await appointmentsService.listAppointments(primary.clinicId, {
    start: recurringStart.toISOString(),
    end: recurringRangeEnd.toISOString(),
  });
  const recurringOccurrences = recurringSeries.filter(
    (item) => item.recurrenceSeriesId === recurringAppointment.recurrenceSeriesId,
  );
  assert.equal(recurringOccurrences.length, 3, "Weekly recurrence should create the requested occurrences");

  const consult = await consultsService.createConsult(primary.clinicId, primary.userId, {
    contactId: contact.id,
    appointmentId: appointment.id,
    patientName: `${contact.firstName} ${contact.lastName}`,
    treatment: "Injectables",
    practitioner: "Primary Admin",
    practitionerId: primary.userId,
    outcome: "Sold",
    revenue: 2750,
    date: updatedAppointment.dateTime,
    notes: "Booked from consult integration test",
    depositStatus: "paid",
  });

  assert.ok(consult.id, "Expected consult to be created");

  const consults = await consultsService.listConsults(primary.clinicId);
  const createdConsult = consults.find((item) => item.id === consult.id);
  assert.ok(createdConsult, "Created consult should appear in list");
  assert.equal(createdConsult?.outcome, "Sold");
  assert.equal(createdConsult?.revenue, 2750);
  assert.equal(createdConsult?.depositStatus, "paid");
  assert.equal(createdConsult?.appointmentId, appointment.id);

  const summary = await consultsService.getSummary(primary.clinicId);
  assert.ok(summary.totalConsults >= 1, "Summary should count at least one consult");
  assert.ok(summary.bookedCount >= 1, "Summary should count a booked consult");
  assert.ok(summary.totalRevenue >= 2750, "Summary should include booked revenue");

  const practitionerConversion = await consultsService.getPractitionerConversion(primary.clinicId);
  const primaryPractitioner = practitionerConversion.find((item) => item.practitioner === "Primary Admin");
  assert.ok(primaryPractitioner, "Practitioner conversion should include the primary practitioner");
  assert.ok(primaryPractitioner!.bookedCount >= 1, "Practitioner booked count should be tracked");
  assert.ok(primaryPractitioner!.revenue >= 2750, "Practitioner revenue should be tracked");

  await assert.rejects(
    () => appointmentsService.updateAppointment(secondary.clinicId, secondary.userId, appointment.id, {
      status: "cancelled",
    }),
    (error: any) => error?.statusCode === 404,
    "Another clinic should not be able to update the appointment",
  );

  await assert.rejects(
    () => consultsService.updateConsult(secondary.clinicId, secondary.userId, consult.id, {
      outcome: "No-show",
    }),
    (error: any) => error?.statusCode === 404,
    "Another clinic should not be able to update the consult",
  );

  await consultsService.updateOutcome(primary.clinicId, primary.userId, consult.id, {
    outcome: "No-show",
    depositStatus: "waived",
    lostReason: "Patient did not attend",
    revenue: 0,
  });

  const afterOutcome = await consultsService.listConsults(primary.clinicId);
  const updatedConsult = afterOutcome.find((item) => item.id === consult.id);
  assert.equal(updatedConsult?.outcome, "No-show");
  assert.equal(consultsService.getOutcomeOptions().some((item) => item.value === "Finance"), true);
  const consultCsv = await consultsService.exportConsultsCsv(primary.clinicId);
  assert.equal(consultCsv.includes("Injectables"), true);
  assert.equal(updatedConsult?.depositStatus, "waived");
  assert.equal(updatedConsult?.lostReason, "Patient did not attend");

  await pool.execute(
    `DELETE FROM clinician_availability
     WHERE id IN (?, ?)
       AND clinic_id = ?`,
    [availabilityId, followUpAvailabilityId, primary.clinicId],
  );

  await pool.execute(
    `DELETE FROM clinician_availability
     WHERE id = ?
       AND clinic_id = ?`,
    [recurringAvailabilityId, primary.clinicId],
  );

  await pool.execute(
    `UPDATE appointment
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE clinic_id = ?
       AND (id = ? OR recurrence_series_id = ?)
       AND deleted_at IS NULL`,
    [primary.clinicId, appointment.id, recurringAppointment.recurrenceSeriesId],
  );

  await pool.execute(
    `UPDATE manual_consult_entry
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [consult.id, primary.clinicId],
  );

  console.log("[appointments+consults] workflow test passed");
  await pool.end();
});
