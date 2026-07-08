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

async function addMarketingConsent(clinicId: string, contactId: string, status: "active" | "inactive") {
  await pool.execute(
    `INSERT INTO consent (id, clinic_id, contact_id, type, status, consent_date)
     VALUES (?, ?, ?, 'marketing', ?, CURRENT_DATE)`,
    [uuidv4(), clinicId, contactId, status],
  );
}

function uuidLikeWithLegacyVariant() {
  return uuidv4().replace(
    /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-)[0-9a-f]/i,
    "$12",
  );
}

test("sequence enrollment runs due email and SMS steps with consent safeguards", async () => {
  await testConnection();
  console.log("[sequence-enrollment] database connection OK");

  const primary = await createClinicAndAdmin("SequenceEnrollmentPrimary");
  const secondary = await createClinicAndAdmin("SequenceEnrollmentSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start sequence enrollment test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let sequenceId = "";
  let contactId = "";
  let optedOutContactId = "";
  let enrollmentId = "";

  try {
    const createdContact = await contactsService.createContact(primary.clinicId, primary.userId, {
      firstName: "Sequence",
      lastName: "Patient",
      email: uniqueEmail("sequence_patient"),
      phone: "+1 (555) 222-0101",
      source: "website",
      treatmentInterests: ["Implants"],
    });
    contactId = createdContact.contact.id;
    await addMarketingConsent(primary.clinicId, contactId, "active");

    const optedOutContact = await contactsService.createContact(primary.clinicId, primary.userId, {
      firstName: "Opted",
      lastName: "Out",
      email: uniqueEmail("sequence_optout"),
      phone: "+1 (555) 222-0102",
      source: "referral",
      treatmentInterests: ["Skin"],
    });
    optedOutContactId = optedOutContact.contact.id;
    await addMarketingConsent(primary.clinicId, optedOutContactId, "inactive");

    const createSequence = await fetchJson(baseUrl, "/api/sequences", primary.token, {
      method: "POST",
      body: JSON.stringify({
        name: "Due Step Regression",
        triggerLabel: "Manual enrollment",
        status: "active",
        steps: [
          { type: "settings", sendOnWeekends: true },
          {
            type: "email",
            delay: 0,
            subject: "Welcome {{first_name}}",
            body: "Hi {{first_name}}, here is your guide.",
          },
          {
            type: "sms",
            delay: 0,
            body: "Hi {{first_name}}, reply YES to book.",
          },
        ],
      }),
    });
    assert.equal(createSequence.response.status, 201);
    sequenceId = uuidLikeWithLegacyVariant();
    await pool.execute(
      `UPDATE communication_sequence
       SET id = ?
       WHERE id = ?
         AND clinic_id = ?`,
      [sequenceId, createSequence.body.data.id, primary.clinicId],
    );

    const enroll = await fetchJson(baseUrl, `/api/sequences/${sequenceId}/enrollments`, primary.token, {
      method: "POST",
      body: JSON.stringify({ contactId }),
    });
    assert.equal(enroll.response.status, 201);
    assert.equal(enroll.body.data.status, "active");
    assert.equal(enroll.body.data.contactId, contactId);
    assert.equal(enroll.body.data.currentStepIndex, 0);
    enrollmentId = enroll.body.data.id;
    console.log("[sequence-enrollment] active consent enrollment passed");

    const optedOutEnroll = await fetchJson(baseUrl, `/api/sequences/${sequenceId}/enrollments`, primary.token, {
      method: "POST",
      body: JSON.stringify({ contactId: optedOutContactId }),
    });
    assert.equal(optedOutEnroll.response.status, 400);
    assert.equal(String(optedOutEnroll.body.message).includes("inactive marketing consent"), true);
    console.log("[sequence-enrollment] opt-out guard passed");

    const foreignEnrollments = await fetchJson(
      baseUrl,
      `/api/sequences/${sequenceId}/enrollments`,
      secondary.token,
    );
    assert.equal(foreignEnrollments.response.status, 404);
    console.log("[sequence-enrollment] tenant isolation passed");

    const firstRun = await fetchJson(baseUrl, "/api/sequences/run-due?limit=10", primary.token, {
      method: "POST",
    });
    assert.equal(firstRun.response.status, 200);
    assert.equal(firstRun.body.data.processed, 1);
    assert.equal(firstRun.body.data.sent, 1);

    const [emailRows]: any = await pool.execute(
      `SELECT subject, body, status
       FROM email
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [primary.clinicId, contactId],
    );
    assert.equal(emailRows.length, 1);
    assert.equal(emailRows[0].subject, "Welcome {{first_name}}");
    assert.equal(emailRows[0].body, "Hi Sequence, here is your guide.");
    assert.equal(emailRows[0].status, "sent");

    const [afterFirstRunRows]: any = await pool.execute(
      `SELECT status, current_step_index as currentStepIndex
       FROM communication_sequence_enrollment
       WHERE id = ? AND clinic_id = ?`,
      [enrollmentId, primary.clinicId],
    );
    assert.equal(afterFirstRunRows[0].status, "active");
    assert.equal(Number(afterFirstRunRows[0].currentStepIndex), 1);
    console.log("[sequence-enrollment] email due step passed");

    const secondRun = await fetchJson(baseUrl, "/api/sequences/run-due?limit=10", primary.token, {
      method: "POST",
    });
    assert.equal(secondRun.response.status, 200);
    assert.equal(secondRun.body.data.processed, 1);
    assert.equal(secondRun.body.data.sent, 1);

    const [smsRows]: any = await pool.execute(
      `SELECT message, status, provider_response as providerResponse
       FROM sms
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [primary.clinicId, contactId],
    );
    assert.equal(smsRows.length, 1);
    assert.equal(smsRows[0].message, "Hi Sequence, reply YES to book.");
    assert.equal(smsRows[0].status, "sent");
    assert.equal(String(smsRows[0].providerResponse).includes("sequence"), true);

    const [completedRows]: any = await pool.execute(
      `SELECT status, completed_at as completedAt
       FROM communication_sequence_enrollment
       WHERE id = ? AND clinic_id = ?`,
      [enrollmentId, primary.clinicId],
    );
    assert.equal(completedRows[0].status, "completed");
    assert.ok(completedRows[0].completedAt);

    const [runRows]: any = await pool.execute(
      `SELECT step_index as stepIndex, status, message_id as messageId
       FROM communication_sequence_step_run
       WHERE clinic_id = ?
         AND enrollment_id = ?
       ORDER BY step_index ASC`,
      [primary.clinicId, enrollmentId],
    );
    assert.equal(runRows.length, 2);
    assert.deepEqual(runRows.map((row: any) => row.status), ["sent", "sent"]);
    assert.equal(runRows.every((row: any) => row.messageId), true);
    console.log("[sequence-enrollment] SMS due step and completion passed");
  } finally {
    if (sequenceId) {
      await pool.execute(
        `UPDATE communication_sequence SET deleted_at = CURRENT_TIMESTAMP WHERE clinic_id = ? AND id = ?`,
        [primary.clinicId, sequenceId],
      );
    }
    if (contactId || optedOutContactId) {
      const emptyId = "00000000-0000-0000-0000-000000000000";
      await pool.execute(
        `UPDATE contact
         SET deleted_at = CURRENT_TIMESTAMP
         WHERE clinic_id = ?
           AND id IN (?, ?)`,
        [primary.clinicId, contactId || emptyId, optedOutContactId || emptyId],
      );
    }

    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error?: Error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }

  console.log("[sequence-enrollment] integration test completed successfully");
});
