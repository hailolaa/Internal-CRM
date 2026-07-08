import assert from "node:assert/strict";
import test from "node:test";
import { v4 as uuidv4 } from "uuid";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { appointmentsService } from "../modules/appointments/appointments.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { consultsService } from "../modules/consults/consults.service.js";
import { opsLogsService } from "../modules/ops-logs/ops-logs.service.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

function toDateOnly(date: Date) {
  return date.toISOString().slice(0, 10);
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

test("manual ad spend drives real ROAS and conversion metrics", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("AdSpendPrimary");
  const secondary = await createClinicAndAdmin("AdSpendSecondary");

  const conversionDate = nextWeekdayDate(1);
  conversionDate.setHours(10, 0, 0, 0);
  const futureDate = nextWeekdayDate(30);
  futureDate.setHours(10, 0, 0, 0);
  const dateRangeStart = toDateOnly(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
  const dateRangeEnd = toDateOnly(new Date(Date.now() + 3 * 24 * 60 * 60 * 1000));

  const contact = await contactsService.createContact(primary.clinicId, primary.userId, {
    firstName: "ROAS",
    lastName: "Lead",
    email: uniqueEmail("roas_lead"),
    phone: "555-200-0001",
    source: "meta_ads",
    value: 6500,
    treatmentInterests: ["Injectables"],
  });

  const availabilityId = await ensureClinicianAvailability(primary.clinicId, primary.userId, conversionDate);
  const appointment = await appointmentsService.createAppointment(primary.clinicId, primary.userId, {
    contactId: contact.contact.id,
    clinicianId: primary.userId,
    dateTime: conversionDate.toISOString(),
    status: "completed",
    treatment: "Consultation",
    valueCents: 650000,
    durationMinutes: 45,
    consultNotes: "Booked from manual spend test",
  });

  const consult = await consultsService.createConsult(primary.clinicId, primary.userId, {
    contactId: contact.contact.id,
    appointmentId: appointment.id,
    patientName: `${contact.contact.firstName} ${contact.contact.lastName}`,
    treatment: "Injectables",
    practitioner: "AdSpendPrimary Admin",
    practitionerId: primary.userId,
    outcome: "Treatment Booked",
    revenue: 6500,
    date: appointment.dateTime,
    notes: "Consult captured from real spend data",
    depositStatus: "paid",
  });

  const primarySpendId = await opsLogsService.createSpend(primary.clinicId, primary.userId, {
    source: "meta_ads",
    channel: "Paid Social",
    campaign: "Launch Week",
    amount: 1200,
    period: "May 2026",
    startDate: dateRangeStart,
    endDate: dateRangeEnd,
    attributionLabel: "manual_reviewed",
    notes: "Initial spend for launch week",
  });

  const secondarySpendId = await opsLogsService.createSpend(primary.clinicId, primary.userId, {
    source: "google_ads",
    channel: "Search",
    campaign: "Future Campaign",
    amount: 300,
    period: "June 2026",
    startDate: toDateOnly(futureDate),
    endDate: toDateOnly(futureDate),
    notes: "Future spend with no matching conversions",
  });

  try {
    const spendEntries = await opsLogsService.listSpend(primary.clinicId);
    assert.equal(spendEntries.length, 2);

    const updatedEntries = await opsLogsService.updateSpend(primary.clinicId, primary.userId, primarySpendId, {
      notes: "Adjusted after review",
      attributionLabel: "manual_reviewed_again",
    });

    const updatedPrimary = updatedEntries.find((entry: { id: string }) => entry.id === primarySpendId);
    assert.ok(updatedPrimary, "Updated spend should still be returned");
    assert.equal(updatedPrimary?.notes, "Adjusted after review");
    assert.equal(updatedPrimary?.attributionLabel, "manual_reviewed_again");

    const campaignMetrics = await opsLogsService.getCampaignMetrics(primary.clinicId);
    assert.equal(campaignMetrics.length, 2);

    const launchRow = campaignMetrics.find((row) => row.campaign === "Launch Week");
    assert.ok(launchRow, "Expected launch spend row to be grouped by campaign");
    assert.equal(launchRow?.source, "meta_ads");
    assert.equal(launchRow?.channel, "Paid Social");
    assert.equal(launchRow?.spend, 1200);
    assert.equal(launchRow?.leads, 1);
    assert.equal(launchRow?.bookedConsults, 1);
    assert.equal(launchRow?.attendedConsults, 1);
    assert.equal(launchRow?.soldTreatments, 1);
    assert.equal(launchRow?.revenue, 6500);
    assert.equal(launchRow?.costPerLead, 1200);
    assert.equal(launchRow?.costPerBookedConsult, 1200);
    assert.equal(launchRow?.costPerAttendedConsult, 1200);
    assert.equal(launchRow?.costPerSoldTreatment, 1200);
    assert.equal(launchRow?.roas, 5.42);
    assert.equal(launchRow?.attribution, "manual_reviewed_again");

    const futureRow = campaignMetrics.find((row) => row.campaign === "Future Campaign");
    assert.ok(futureRow, "Expected future spend row to be grouped separately");
    assert.equal(futureRow?.spend, 300);
    assert.equal(futureRow?.leads, 0);
    assert.equal(futureRow?.bookedConsults, 0);
    assert.equal(futureRow?.attendedConsults, 0);
    assert.equal(futureRow?.soldTreatments, 0);
    assert.equal(futureRow?.revenue, 0);
    assert.equal(futureRow?.roas, 0);
    assert.equal(futureRow?.attribution, "manual_or_estimated");

    const roasMetrics = await opsLogsService.getRoasMetrics(primary.clinicId);
    assert.equal(roasMetrics.spend, 1500);
    assert.equal(roasMetrics.revenue, 6500);
    assert.equal(roasMetrics.roas, 4.33);
    assert.equal(roasMetrics.costPerLead, 1500);
    assert.equal(roasMetrics.costPerBookedConsult, 1500);
    assert.equal(roasMetrics.costPerAttendedConsult, 1500);
    assert.equal(roasMetrics.costPerSoldTreatment, 1500);
    assert.equal(roasMetrics.attribution, "manual_or_estimated");
    assert.equal(roasMetrics.byCampaign.length, 2);

    const emptyRoas = await opsLogsService.getRoasMetrics(secondary.clinicId);
    assert.equal(emptyRoas.spend, 0);
    assert.equal(emptyRoas.revenue, 0);
    assert.equal(emptyRoas.roas, 0);
    assert.deepEqual(emptyRoas.byCampaign, []);

    const emptyCampaignMetrics = await opsLogsService.getCampaignMetrics(secondary.clinicId);
    assert.deepEqual(emptyCampaignMetrics, []);

    await assert.rejects(
      () => opsLogsService.updateSpend(secondary.clinicId, secondary.userId, primarySpendId, { notes: "nope" }),
      (error: any) => error?.statusCode === 404,
      "Another clinic should not be able to update the spend entry",
    );

    console.log("[ad-spend-roas] manual spend and conversion metrics test passed");
  } finally {
    await pool.execute(
      `UPDATE manual_spend_entry
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id IN (?, ?)
         AND deleted_at IS NULL`,
      [primary.clinicId, primarySpendId, secondarySpendId],
    );

    await pool.execute(
      `UPDATE manual_consult_entry
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, consult.id],
    );

    await pool.execute(
      `UPDATE appointment
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, appointment.id],
    );

    await pool.execute(
      `DELETE FROM clinician_availability
       WHERE clinic_id = ?
         AND id = ?`,
      [primary.clinicId, availabilityId],
    );

    await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, contact.contact.id],
    );

    await pool.end();
  }
});
