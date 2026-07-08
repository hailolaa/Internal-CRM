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

async function fetchConversation(baseUrl: string, token: string, contactId: string) {
  const response = await fetch(`${baseUrl}/api/comms/inbox/${contactId}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  const body: any = await response.json();
  return { response, body };
}

test("communications inbox returns ordered conversation threads and keeps notes separate", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("CommsConversationPrimary");
  const secondary = await createClinicAndAdmin("CommsConversationSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start comms test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let contactId = "";
  const emailId = uuidv4();
  const smsId = uuidv4();
  const noteId = uuidv4();

  try {
    const createdContact = await contactsService.createContact(primary.clinicId, primary.userId, {
      firstName: "Inbox",
      lastName: "Thread",
      email: uniqueEmail("comms_thread"),
      phone: "+1 (555) 321-0001",
      source: "website",
      treatmentInterests: ["Physio"],
    });

    contactId = createdContact.contact.id;

    const firstTimestamp = new Date(Date.now() - 10 * 60 * 1000);
    const secondTimestamp = new Date(Date.now() - 5 * 60 * 1000);
    const noteTimestamp = new Date(Date.now() - 2 * 60 * 1000);

    await pool.execute(
      `INSERT INTO email
        (id, clinic_id, contact_id, user_id, subject, body, direction, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        emailId,
        primary.clinicId,
        contactId,
        primary.userId,
        "Welcome to the clinic",
        "Thanks for reaching out. We will get back to you shortly.",
        "outbound",
        "sent",
        firstTimestamp,
        firstTimestamp,
      ],
    );

    await pool.execute(
      `INSERT INTO sms
        (id, clinic_id, contact_id, user_id, message, direction, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        smsId,
        primary.clinicId,
        contactId,
        primary.userId,
        "Reply if you'd like us to book a consultation.",
        "inbound",
        "delivered",
        secondTimestamp,
        secondTimestamp,
      ],
    );

    await pool.execute(
      `INSERT INTO activity
        (id, clinic_id, contact_id, type, user_id, metadata, created_at, updated_at)
       VALUES (?, ?, ?, 'Note', ?, ?, ?, ?)`,
      [
        noteId,
        primary.clinicId,
        contactId,
        primary.userId,
        JSON.stringify({
          action: "manual.note",
          source: "contact",
          recordId: noteId,
          title: "Internal note",
          changes: { note: "Patient prefers afternoons" },
        }),
        noteTimestamp,
        noteTimestamp,
      ],
    );

    const { response, body } = await fetchConversation(baseUrl, primary.token, contactId);
    assert.equal(response.ok, true, `Expected conversation lookup to return 200, got ${response.status}`);
    assert.equal(body.status, "success");
    assert.equal(body.data.contact.id, contactId);
    assert.equal(body.data.contact.name, "Inbox Thread");
    assert.equal(body.data.messages.length, 2);
    assert.equal(body.data.internalNotes.length >= 2, true);
    assert.equal(body.data.messages[0].id, emailId);
    assert.equal(body.data.messages[1].id, smsId);
    assert.equal(body.data.messages[0].channel, "email");
    assert.equal(body.data.messages[1].channel, "sms");
    assert.equal(body.data.messages[1].direction, "inbound");
    assert.equal(body.data.messages[0].sender, "CommsConversationPrimary Admin");
    assert.equal(body.data.messages[0].isInternal, false);
    assert.equal(body.data.internalNotes.every((note: any) => note.isInternal === true), true);

    const foreign = await fetchConversation(baseUrl, secondary.token, contactId);
    assert.equal(foreign.response.status, 404);
    assert.equal(foreign.body.status, "error");

    console.log("[comms-conversation] thread detail test passed");
  } finally {
    await pool.execute(
      `UPDATE activity
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, contactId],
    );

    await pool.execute(
      `UPDATE sms
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, smsId],
    );

    await pool.execute(
      `UPDATE email
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ?
         AND id = ?
         AND deleted_at IS NULL`,
      [primary.clinicId, emailId],
    );

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
