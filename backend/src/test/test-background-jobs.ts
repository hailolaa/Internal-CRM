
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";

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
    source: "integration-test",
    value: 1000,
    treatmentInterests: ["Injectables"],
  });

  return created.contact;
}

function runSchedulerMode(enabled: boolean) {
  const snippet = `
    import { testConnection } from './dist/config/database.js';
    import { config } from './dist/config/index.js';
    import { backgroundJobsScheduler } from './dist/modules/background-jobs/background-jobs.scheduler.js';

    await testConnection();
    await backgroundJobsScheduler.start();
    backgroundJobsScheduler.stop();
    console.log(JSON.stringify({ enabled: config.backgroundJobs.enabled }));
    process.exit(0);
  `;

  const result = spawnSync(process.execPath, ["--input-type=module", "-e", snippet], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      BACKGROUND_JOBS_ENABLED: enabled ? "true" : "false",
      NODE_ENV: "development",
    },
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stdout,
    new RegExp(enabled ? "Background jobs scheduler started" : "Background jobs scheduler disabled"),
  );
  return result.stdout;
}

test("background jobs scheduler respects enabled and disabled startup modes", async () => {
  await testConnection();

  const disabledOutput = runSchedulerMode(false);
  const enabledOutput = runSchedulerMode(true);

  assert.match(disabledOutput, /"enabled":false/);
  assert.match(enabledOutput, /"enabled":true/);
});

test("background job shells run and return clinic-scoped reporting data", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("BackgroundJobs");
  const contact = await createContact(primary.clinicId, primary.userId, "BackgroundJobs");

  const { runSlaBreachCheck, runDailySlaReport } = await import("../modules/background-jobs/background-jobs.tasks.js");
  const { backgroundJobsService } = await import("../modules/background-jobs/background-jobs.service.js");

  const jobs = await backgroundJobsService.listJobs();
  assert.ok(jobs.schedulerEnabled !== undefined, "Scheduler state should be exposed");
  assert.ok(jobs.jobs.some((job) => job.id === "sla-breach-check"), "SLA breach check should exist");
  assert.ok(jobs.jobs.some((job) => job.id === "daily-sla-report"), "Daily report job should exist");

  const breachResult = await runSlaBreachCheck();
  assert.ok(typeof breachResult.clinicsChecked === "number");
  assert.ok(typeof breachResult.contactsChecked === "number");
  assert.ok(typeof breachResult.breachesCreated === "number");

  const reportResult = await runDailySlaReport();
  assert.ok(typeof reportResult.clinicsChecked === "number");
  assert.ok(typeof reportResult.appointmentsChecked === "number");
  assert.ok(typeof reportResult.soldConsults === "number");
  assert.ok(typeof reportResult.consultRevenue === "number");

  await contactsService.updateContactProfile(primary.clinicId, primary.userId, contact.id, {
    status: "new",
  });

  console.log("[background-jobs] scheduler and task shells test passed");
});
