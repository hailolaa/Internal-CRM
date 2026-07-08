import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
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
    token: result.tokens.token,
  };
}

function toMysqlDatetime(date: Date) {
  return date.toISOString().slice(0, 19).replace("T", " ");
}

async function fetchCsv(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
  });
  const body = await response.text();
  return { response, body };
}

async function fetchJson(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

test("Phase 1 report exports produce tenant-scoped CSV with clear unsupported states", async () => {
  await testConnection();
  console.log("[report-exports] database connection OK");

  const primary = await createClinicAndAdmin("ReportExportsPrimary");
  const secondary = await createClinicAndAdmin("ReportExportsSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start report exports test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  const primarySpendId = uuidv4();
  const secondarySpendId = uuidv4();
  const primaryNoShowId = uuidv4();
  const secondaryNoShowId = uuidv4();
  const startDate = "2026-06-01";
  const endDate = "2026-06-30";

  try {
    const primaryContact = await contactsService.createContact(primary.clinicId, primary.userId, {
      firstName: "Export",
      lastName: "Primary",
      email: uniqueEmail("report_export_primary"),
      phone: "555-1000",
      source: "google_ads",
      status: "New",
      value: 5000,
      treatmentInterests: ["Implants"],
    });
    const secondaryContact = await contactsService.createContact(secondary.clinicId, secondary.userId, {
      firstName: "Export",
      lastName: "Secondary",
      email: uniqueEmail("report_export_secondary"),
      phone: "555-2000",
      source: "google_ads",
      status: "New",
      value: 5000,
      treatmentInterests: ["Implants"],
    });

    await pool.execute(
      `INSERT INTO manual_spend_entry
        (id, clinic_id, source, channel, campaign, amount, period, start_date, end_date, attribution_label, notes, created_by)
       VALUES (?, ?, 'google_ads', 'paid_search', ?, 250.00, 'June 2026', ?, ?, 'manual', 'Primary report export test', ?)`,
      [primarySpendId, primary.clinicId, "Primary Export Campaign", startDate, endDate, primary.userId],
    );
    await pool.execute(
      `INSERT INTO manual_spend_entry
        (id, clinic_id, source, channel, campaign, amount, period, start_date, end_date, attribution_label, notes, created_by)
       VALUES (?, ?, 'google_ads', 'paid_search', ?, 999.00, 'June 2026', ?, ?, 'manual', 'Secondary report export test', ?)`,
      [secondarySpendId, secondary.clinicId, "Secondary Export Campaign", startDate, endDate, secondary.userId],
    );
    await pool.execute(
      `INSERT INTO appointment
        (id, clinic_id, contact_id, clinician_id, date_time, status, treatment, value, duration_minutes, no_show_reason, created_by)
       VALUES (?, ?, ?, ?, ?, 'NoShow', 'Implants', 3200, 45, 'Patient did not attend export test', ?)`,
      [
        primaryNoShowId,
        primary.clinicId,
        primaryContact.contact.id,
        primary.userId,
        toMysqlDatetime(new Date("2026-06-12T10:30:00.000Z")),
        primary.userId,
      ],
    );
    await pool.execute(
      `INSERT INTO appointment
        (id, clinic_id, contact_id, clinician_id, date_time, status, treatment, value, duration_minutes, no_show_reason, created_by)
       VALUES (?, ?, ?, ?, ?, 'NoShow', 'Implants', 8700, 45, 'Secondary patient did not attend export test', ?)`,
      [
        secondaryNoShowId,
        secondary.clinicId,
        secondaryContact.contact.id,
        secondary.userId,
        toMysqlDatetime(new Date("2026-06-12T10:30:00.000Z")),
        secondary.userId,
      ],
    );
    console.log("[report-exports] scoped seed data passed");

    const attribution = await fetchCsv(
      baseUrl,
      `/api/reports/exports/attribution?startDate=${startDate}&endDate=${endDate}`,
      primary.token,
    );
    assert.equal(attribution.response.status, 200);
    assert.match(attribution.response.headers.get("content-type") || "", /text\/csv/);
    assert.match(attribution.response.headers.get("content-disposition") || "", /phase1-attribution-report/);
    assert.match(attribution.body, /^reportType,section,metric,label,value,currency,provenance/);
    assert.match(attribution.body, /Primary Export Campaign/);
    assert.doesNotMatch(attribution.body, /Secondary Export Campaign/);
    assert.match(attribution.body, /GBP/);
    console.log("[report-exports] attribution CSV tenant scope passed");

    const revenue = await fetchCsv(
      baseUrl,
      `/api/reports/exports/revenue?startDate=${startDate}&endDate=${endDate}`,
      primary.token,
    );
    assert.equal(revenue.response.status, 200);
    assert.match(revenue.body, /summary_cards/);
    assert.match(revenue.body, /financials/);
    console.log("[report-exports] revenue CSV passed");

    const operational = await fetchCsv(
      baseUrl,
      `/api/reports/exports/operational?startDate=${startDate}&endDate=${endDate}`,
      primary.token,
    );
    assert.equal(operational.response.status, 200);
    assert.match(operational.body, /funnel/);
    assert.match(operational.body, /leakage/);
    console.log("[report-exports] operational CSV passed");

    const pipeline = await fetchCsv(
      baseUrl,
      `/api/reports/exports/pipeline?startDate=${startDate}&endDate=${endDate}`,
      primary.token,
    );
    assert.equal(pipeline.response.status, 200);
    assert.match(pipeline.body, /open_opportunities|empty_state/);
    console.log("[report-exports] pipeline CSV passed");

    const noShows = await fetchCsv(
      baseUrl,
      `/api/reports/exports/no-shows?startDate=${startDate}&endDate=${endDate}`,
      primary.token,
    );
    assert.equal(noShows.response.status, 200);
    assert.match(noShows.response.headers.get("content-disposition") || "", /phase1-no-shows-report/);
    assert.match(noShows.body, /no_show_recovery_queue/);
    assert.match(noShows.body, /Export Primary/);
    assert.match(noShows.body, /5551000/);
    assert.match(noShows.body, /Patient did not attend export test/);
    assert.match(noShows.body, /Rebook the consult/);
    assert.doesNotMatch(noShows.body, /Export Secondary/);
    console.log("[report-exports] no-shows CSV tenant scope passed");

    const unsupported = await fetchJson(baseUrl, "/api/reports/exports/revenue?format=pdf", primary.token);
    assert.equal(unsupported.response.status, 400);
    assert.equal(unsupported.body.status, "error");
    assert.match(JSON.stringify(unsupported.body.errors), /Only CSV report exports are supported/);
    console.log("[report-exports] unsupported export state passed");

    console.log("[report-exports] integration test completed successfully");
  } finally {
    await closeServer(server);
    await pool.execute(
      "UPDATE manual_spend_entry SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (?, ?)",
      [primarySpendId, secondarySpendId],
    );
    await pool.execute(
      "UPDATE appointment SET deleted_at = CURRENT_TIMESTAMP WHERE id IN (?, ?)",
      [primaryNoShowId, secondaryNoShowId],
    );
    await pool.end();
  }
});
