import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";
import { messageTemplatesService } from "../modules/message-templates/message-templates.service.js";

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
