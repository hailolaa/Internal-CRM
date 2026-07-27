import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { messageTemplatesService } from "../modules/message-templates/message-templates.service.js";
import { generateToken, hashPassword } from "../utils/helpers.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createClinicAndAdmin(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = uniqueEmail(`${prefix}_admin`);
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    `INSERT INTO clinic (id, name, email, phone, subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, '555-0100', 'professional', 'active', 20)`,
    [clinicId, `${prefix} Clinic`, email],
  );
  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, phone, role, email_verified_at, status)
     VALUES (?, ?, ?, ?, ?, 'Admin', '555-0100', 'SUPER_ADMIN', CURRENT_TIMESTAMP, 'active')`,
    [userId, clinicId, email, passwordHash, prefix],
  );
  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return {
    clinicId,
    userId,
    token: generateToken({ userId, clinicId, role: "SUPER_ADMIN", email }),
  };
}

test("message templates support filters, archiving, and rendering", async () => {
  await testConnection();

  const clinic = await createClinicAndAdmin("MessageTemplates");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start templates test server");
  }

  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const templateName = `Follow up ${Date.now()}`;
  let templateId = "";

  try {
    const createResponse = await fetch(`${baseUrl}/api/message-templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: templateName,
        channel: "sms",
        body: "Hi {{patient_name}}, your {{treatment}} visit is on {{appointment_date}} at {{clinic_name}}.",
        status: "active",
      }),
    });

    const createBody: any = await createResponse.json();
    assert.equal(createResponse.status, 201);
    assert.equal(createBody.status, "success");
    assert.equal(createBody.data.channel, "sms");
    assert.equal(createBody.data.status, "active");
    assert.ok(Array.isArray(createBody.data.availablePlaceholders));
    templateId = createBody.data.id;

    const listResponse = await fetch(`${baseUrl}/api/message-templates?channel=sms&status=active`, {
      headers: { Authorization: `Bearer ${clinic.token}` },
    });
    const listBody: any = await listResponse.json();
    assert.equal(listResponse.ok, true);
    assert.equal(listBody.data.some((item: any) => item.id === templateId), true);
    assert.equal(listBody.meta.availablePlaceholders.length > 0, true);
    assert.equal(listBody.meta.availablePlaceholders.some((item: any) => item.key === "clinic_growth_score"), true);
    assert.equal(listBody.meta.availablePlaceholders.some((item: any) => item.key === "recommended_next_package"), true);

    const emailTemplates = await messageTemplatesService.listTemplates(clinic.clinicId, {
      channel: "email",
      status: "active",
    });
    const defaultTemplates = emailTemplates.filter((item: any) => item.name.startsWith("MC-046 "));
    assert.equal(defaultTemplates.length, 8);
    for (const expectedName of [
      "MC-046 Free guide follow-up",
      "MC-046 New lead follow-up",
      "MC-046 Audit completed",
      "MC-046 Dashboard access given",
      "MC-046 Proposal follow-up",
      "MC-046 No-show follow-up",
      "MC-046 Lost lead reactivation",
      "MC-046 Existing client upsell",
    ]) {
      const template = defaultTemplates.find((item: any) => item.name === expectedName);
      assert.ok(template, `Missing default template ${expectedName}`);
      assert.match(template.body, /Clinic Growth Score/);
      assert.match(template.body, /Recommended next package/);
    }

    const detailResponse = await fetch(`${baseUrl}/api/message-templates/${templateId}`, {
      headers: { Authorization: `Bearer ${clinic.token}` },
    });
    const detailBody: any = await detailResponse.json();
    assert.equal(detailResponse.ok, true);
    assert.equal(detailBody.data.name, templateName);

    const rendered = await messageTemplatesService.renderTemplate(clinic.clinicId, templateId, {
      patient_name: "Jordan",
      clinic_name: "Growth Clinic",
      appointment_date: "June 1, 2026",
      treatment: "Consultation",
    });
    assert.equal(rendered.body.includes("Jordan"), true);
    assert.equal(rendered.body.includes("Consultation"), true);

    const missingVariablesResponse = await fetch(`${baseUrl}/api/message-templates/${templateId}/test-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: "+15552100001",
        variables: { patient_name: "Jordan" },
      }),
    });
    const missingVariablesBody: any = await missingVariablesResponse.json();
    assert.equal(missingVariablesResponse.status, 400);
    assert.match(missingVariablesBody.message, /Missing template variables/);

    const smsTestResponse = await fetch(`${baseUrl}/api/message-templates/${templateId}/test-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: "+15552100001",
        variables: {
          patient_name: "Jordan",
          clinic_name: "Growth Clinic",
          appointment_date: "June 1, 2026",
          treatment: "Consultation",
        },
      }),
    });
    const smsTestBody: any = await smsTestResponse.json();
    assert.equal(smsTestResponse.ok, true);
    assert.equal(smsTestBody.data.channel, "sms");
    assert.equal(smsTestBody.data.deliveryStatus, "queued");
    assert.equal(smsTestBody.data.renderedBody.includes("Jordan"), true);

    const emailCreateResponse = await fetch(`${baseUrl}/api/message-templates`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: `Email follow up ${Date.now()}`,
        channel: "email",
        subject: "Hello {{patient_name}}",
        body: "Hi {{patient_name}}, welcome to {{clinic_name}}.",
        status: "draft",
      }),
    });
    const emailCreateBody: any = await emailCreateResponse.json();
    assert.equal(emailCreateResponse.status, 201);

    const emailTestResponse = await fetch(`${baseUrl}/api/message-templates/${emailCreateBody.data.id}/test-send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${clinic.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: "recipient@example.com",
        variables: {
          patient_name: "Jordan",
          clinic_name: "Growth Clinic",
        },
      }),
    });
    const emailTestBody: any = await emailTestResponse.json();
    assert.equal(emailTestResponse.ok, true);
    assert.equal(emailTestBody.data.channel, "email");
    assert.equal(emailTestBody.data.deliveryStatus, "sent");
    assert.equal(emailTestBody.data.subject, "Hello Jordan");

    const [auditRows]: any = await pool.execute(
      `SELECT action
       FROM audit_log
       WHERE clinic_id = ? AND entity_type = 'message_template' AND action = 'MESSAGE_TEMPLATE_TEST_SEND'`,
      [clinic.clinicId],
    );
    assert.equal(auditRows.length >= 2, true);

    const archiveResponse = await fetch(`${baseUrl}/api/message-templates/${templateId}/archive`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${clinic.token}` },
    });
    const archiveBody: any = await archiveResponse.json();
    assert.equal(archiveResponse.ok, true);
    assert.equal(archiveBody.data.status, "archived");

    const deleteResponse = await fetch(`${baseUrl}/api/message-templates/${templateId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${clinic.token}` },
    });
    assert.equal(deleteResponse.ok, true);

    console.log("[message-templates] API and rendering smoke test passed");
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
