import assert from "node:assert/strict";
import test from "node:test";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { slaService } from "../modules/sla/sla.service.js";
import { runSlaBreachCheck } from "../modules/background-jobs/background-jobs.tasks.js";

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

async function createLead(clinicId: string, userId: string, prefix: string, source: string, value: number) {
  const created = await contactsService.createContact(clinicId, userId, {
    firstName: prefix,
    lastName: "Lead",
    email: uniqueEmail(`${prefix}_lead`),
    source,
    value,
    treatmentInterests: ["Injectables"],
  });

  return created.contact;
}

test("SLA breach detection and response metrics stay clinic-scoped", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("SlaPrimary");
  const secondary = await createClinicAndAdmin("SlaSecondary");

  const breachedLead = await createLead(primary.clinicId, primary.userId, "SlaBreached", "web", 5000);
  const contactedLead = await createLead(primary.clinicId, primary.userId, "SlaContacted", "google", 2500);

  await pool.execute(
    `UPDATE contact
     SET sla_target_minutes = 5,
         sla_deadline_at = DATE_SUB(NOW(), INTERVAL 10 MINUTE)
     WHERE id = ?
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [breachedLead.id, primary.clinicId],
  );

  const contactedResult = await slaService.markContacted(primary.clinicId, primary.userId, contactedLead.id);
  assert.ok(contactedResult.firstResponseAt, "Mark contacted should set first response time");
  assert.ok(contactedResult.responseMinutes >= 0, "Mark contacted should return response minutes");

  const breachResult = await runSlaBreachCheck();
  assert.ok(Number(breachResult.clinicsChecked || 0) >= 1, "Scheduler shell should check clinics");
  assert.ok(Number(breachResult.breachesCreated || 0) >= 1, "Expected at least one breach to be recorded");

  const summary = await slaService.getSummary(primary.clinicId);
  assert.equal(summary.targetMinutes, 5);
  assert.ok(summary.activeLeadCount >= 1, "Primary clinic should have active leads");
  assert.ok(summary.breachedLeadCount >= 1, "Primary clinic should report breaches");
  assert.equal(summary.riskLabel, "estimated");
  assert.ok(summary.estimatedRevenueRisk >= 5000, "Revenue risk should include the breached lead value");

  const breaches = await slaService.listBreaches(primary.clinicId);
  const primaryBreach = breaches.find((item) => item.contactId === breachedLead.id);
  assert.ok(primaryBreach, "Breach list should include the breached lead");
  assert.equal(primaryBreach?.riskLabel, "estimated");
  assert.ok(primaryBreach?.estimatedRevenueRisk >= 5000, "Breach revenue risk should be estimated");

  const responseMetrics = await slaService.getResponseTimeMetrics(primary.clinicId);
  assert.ok(responseMetrics.respondedLeads >= 1, "Response metrics should count contacted leads");
  const googleMetric = responseMetrics.bySource.find((item) => item.source === "google");
  assert.ok(googleMetric, "Response metrics should include the contacted source");

  const staffMetrics = await slaService.getStaffResponseMetrics(primary.clinicId);
  const primaryStaff = staffMetrics.find((item) => item.userId === primary.userId);
  assert.ok(primaryStaff, "Staff response metrics should include the responding user");
  assert.ok(primaryStaff!.respondedLeads >= 1, "Staff response metrics should count the contacted lead");

  const secondarySummary = await slaService.getSummary(secondary.clinicId);
  assert.equal(secondarySummary.breachedLeadCount, 0, "Another clinic should not see primary breaches");

  console.log("[sla] summary, breach detection, and response metrics test passed");

  await pool.execute(
    `UPDATE contact
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_at = CURRENT_TIMESTAMP
     WHERE id IN (?, ?)
       AND clinic_id = ?
       AND deleted_at IS NULL`,
    [breachedLead.id, contactedLead.id, primary.clinicId],
  );
});
