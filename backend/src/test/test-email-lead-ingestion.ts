import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import { config } from "../config/index.js";
import pool, { testConnection } from "../config/database.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function postInboundEmail(
  baseUrl: string,
  secret: string,
  payload: Record<string, unknown>,
) {
  const response = await fetch(`${baseUrl}/api/webhooks/email/inbound`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "x-webhook-secret": secret,
    },
    body: JSON.stringify(payload),
  });
  const body: any = await response.json().catch(() => ({}));
  return { response, body };
}

function parseJsonArray(value: unknown) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseJsonObject(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>;
  if (typeof value !== "string") return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

test("email enquiry webhook creates or links a lead contact with attribution, audit trail, idempotency and tenant isolation", async () => {
  await testConnection();

  const primary = await createTestClinicAndAdmin("EmailLeadPrimary");
  const secondary = await createTestClinicAndAdmin("EmailLeadSecondary");
  const originalEmailConfig = { ...config.email };
  const secret = "test-email-webhook-secret";
  const nonce = `${Date.now()}-${Math.floor(Math.random() * 100000)}`;
  const primaryRecipient = `email-leads-${nonce}@primary.example.test`;
  const secondaryRecipient = `email-leads-${nonce}@secondary.example.test`;
  const sender = `aisha.email-${nonce}@patient.example.test`;
  const providerMessageId = `provider-email-${nonce}`;

  Object.assign(config.email as any, {
    inboundWebhookSecret: secret,
    inboundDefaultWorkspaceId: "",
    inboundWorkspaceMap: {
      [primaryRecipient]: primary.clinicId,
      [secondaryRecipient]: secondary.clinicId,
    },
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start email lead ingestion test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const invalidSecret = await postInboundEmail(baseUrl, "wrong-secret", {
      from: `"Aisha Brown" <${sender}>`,
      to: primaryRecipient,
      text: "I would like to book a consultation.",
    });
    assert.equal(invalidSecret.response.status, 401);

    const unmappedRecipient = await postInboundEmail(baseUrl, secret, {
      from: `"Aisha Brown" <${sender}>`,
      to: `unmapped-${nonce}@example.test`,
      text: "I would like to book a consultation.",
    });
    assert.equal(unmappedRecipient.response.status, 403);

    const malformed = await postInboundEmail(baseUrl, secret, {
      to: primaryRecipient,
      text: "Missing sender must be rejected.",
    });
    assert.equal(malformed.response.status, 400);
    assert.match(malformed.body.message, /sender is required/i);

    const payload = {
      providerMessageId,
      from: `"Aisha Brown" <${sender}>`,
      to: primaryRecipient,
      subject: "Email enquiry - implant campaign",
      text:
        "Patient asked whether the clinic can help with implants.\n" +
        "Campaign: implant-search\n" +
        "UTM Source: google\n" +
        "UTM Medium: cpc",
      receivedAt: "2026-08-20T10:15:00.000Z",
    };

    const firstResult = await postInboundEmail(baseUrl, secret, payload);
    assert.equal(firstResult.response.status, 200);
    assert.equal(firstResult.body.status, "success");
    assert.equal(firstResult.body.data.duplicate, false);
    assert.ok(firstResult.body.data.emailId);
    assert.ok(firstResult.body.data.contactId);

    const [contactRows]: any = await pool.execute(
      `SELECT id,
              clinic_id as clinicId,
              first_name as firstName,
              last_name as lastName,
              email,
              status,
              lead_status as leadStatus,
              source,
              email_permission as emailPermission,
              communication_permissions as communicationPermissions,
              tags,
              notes
       FROM contact
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [firstResult.body.data.contactId, primary.clinicId],
    );
    assert.equal(contactRows.length, 1);
    assert.equal(contactRows[0].clinicId, primary.clinicId);
    assert.equal(contactRows[0].firstName, "Aisha");
    assert.equal(contactRows[0].lastName, "Brown");
    assert.equal(contactRows[0].email, sender);
    assert.equal(contactRows[0].status, "lead");
    assert.equal(contactRows[0].leadStatus, "new");
    assert.equal(contactRows[0].source, "email");
    assert.equal(Boolean(contactRows[0].emailPermission), true);
    assert.deepEqual(parseJsonObject(contactRows[0].communicationPermissions), {
      email: true,
      sms: false,
      whatsapp: false,
      phone: false,
    });
    assert.ok(parseJsonArray(contactRows[0].tags).includes("email-inbound"));
    assert.match(contactRows[0].notes, /Created automatically from inbound email/);

    const [emailRows]: any = await pool.execute(
      `SELECT id,
              provider_message_id as providerMessageId,
              clinic_id as clinicId,
              contact_id as contactId,
              from_email as fromEmail,
              to_email as toEmail,
              subject,
              body,
              direction,
              status
       FROM email
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [firstResult.body.data.emailId, primary.clinicId],
    );
    assert.equal(emailRows.length, 1);
    assert.equal(emailRows[0].providerMessageId, providerMessageId);
    assert.equal(emailRows[0].contactId, firstResult.body.data.contactId);
    assert.equal(emailRows[0].fromEmail, sender);
    assert.equal(emailRows[0].toEmail, primaryRecipient);
    assert.equal(emailRows[0].subject, payload.subject);
    assert.match(emailRows[0].body, /Campaign: implant-search/);
    assert.match(emailRows[0].body, /UTM Source: google/);
    assert.equal(emailRows[0].direction, "inbound");
    assert.equal(emailRows[0].status, "unread");

    const [activityRows]: any = await pool.execute(
      `SELECT metadata
       FROM activity
       WHERE clinic_id = ? AND contact_id = ? AND type IN ('Email', 'Note')
       ORDER BY timestamp ASC`,
      [primary.clinicId, firstResult.body.data.contactId],
    );
    const activityMetadata = activityRows.map((row: any) => parseJsonObject(row.metadata));
    assert.ok(
      activityMetadata.some(
        (metadata: any) =>
          metadata.action === "lead_created_from_inbound_email" &&
          metadata.recordId === firstResult.body.data.contactId,
      ),
      "lead creation should be visible on the contact timeline",
    );
    assert.ok(
      activityMetadata.some(
        (metadata: any) =>
          metadata.action === "inbound_email_received" &&
          metadata.recordId === firstResult.body.data.emailId &&
          metadata.changes?.providerMessageId === providerMessageId,
      ),
      "email receipt should be visible on the contact timeline",
    );

    const [auditRows]: any = await pool.execute(
      `SELECT action, entity_type as entityType, entity_id as entityId, changes
       FROM audit_log
       WHERE clinic_id = ? AND action = 'INBOUND_EMAIL_RECEIVED' AND entity_id = ?
       LIMIT 1`,
      [primary.clinicId, firstResult.body.data.emailId],
    );
    assert.equal(auditRows.length, 1);
    assert.equal(auditRows[0].entityType, "email");
    const auditChanges = parseJsonObject(auditRows[0].changes);
    assert.equal(auditChanges.contactId, firstResult.body.data.contactId);
    assert.equal(auditChanges.providerMessageId, providerMessageId);

    const retryResult = await postInboundEmail(baseUrl, secret, payload);
    assert.equal(retryResult.response.status, 200);
    assert.equal(retryResult.body.data.duplicate, true);
    assert.equal(retryResult.body.data.emailId, firstResult.body.data.emailId);
    assert.equal(retryResult.body.data.contactId, firstResult.body.data.contactId);

    const [primaryCounts]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM contact WHERE clinic_id = ? AND email = ? AND deleted_at IS NULL) as contactCount,
         (SELECT COUNT(*) FROM email WHERE clinic_id = ? AND provider_message_id = ? AND deleted_at IS NULL) as emailCount
       `,
      [primary.clinicId, sender, primary.clinicId, providerMessageId],
    );
    assert.equal(Number(primaryCounts[0].contactCount), 1);
    assert.equal(Number(primaryCounts[0].emailCount), 1);

    const linkedResult = await postInboundEmail(baseUrl, secret, {
      ...payload,
      providerMessageId: `${providerMessageId}-second`,
      subject: "Follow-up email enquiry - implant campaign",
      text: "The same patient followed up with another email.",
    });
    assert.equal(linkedResult.response.status, 200);
    assert.equal(linkedResult.body.data.duplicate, false);
    assert.equal(linkedResult.body.data.contactId, firstResult.body.data.contactId);
    assert.notEqual(linkedResult.body.data.emailId, firstResult.body.data.emailId);

    const secondaryResult = await postInboundEmail(baseUrl, secret, {
      ...payload,
      to: secondaryRecipient,
    });
    assert.equal(secondaryResult.response.status, 200);
    assert.equal(secondaryResult.body.data.duplicate, false);
    assert.notEqual(secondaryResult.body.data.contactId, firstResult.body.data.contactId);
    assert.notEqual(secondaryResult.body.data.emailId, firstResult.body.data.emailId);

    const [secondaryCounts]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM contact WHERE clinic_id = ? AND email = ? AND deleted_at IS NULL) as secondaryContactCount,
         (SELECT COUNT(*) FROM email WHERE clinic_id = ? AND provider_message_id = ? AND deleted_at IS NULL) as secondaryEmailCount,
         (SELECT COUNT(*) FROM email WHERE clinic_id = ? AND provider_message_id = ? AND deleted_at IS NULL) as primaryEmailCount
       `,
      [
        secondary.clinicId,
        sender,
        secondary.clinicId,
        providerMessageId,
        primary.clinicId,
        providerMessageId,
      ],
    );
    assert.equal(Number(secondaryCounts[0].secondaryContactCount), 1);
    assert.equal(Number(secondaryCounts[0].secondaryEmailCount), 1);
    assert.equal(Number(secondaryCounts[0].primaryEmailCount), 1);

    console.log("[email-lead-ingestion] inbound email lead creation, attribution, idempotency and tenant isolation passed");
  } finally {
    Object.assign(config.email as any, originalEmailConfig);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end();
  }
});
