import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import twilio from "twilio";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import { config } from "../config/index.js";
import pool, { testConnection } from "../config/database.js";
import { hashPassword } from "../utils/helpers.js";

function uniqueEmail(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}@test.com`;
}

async function createWorkspace(prefix: string) {
  const clinicId = uuidv4();
  const userId = uuidv4();
  const email = uniqueEmail(`${prefix}_admin`);
  const passwordHash = await hashPassword("password123");

  await pool.execute(
    `INSERT INTO clinic
      (id, name, email, phone, address, city, state, postal_code, country, timezone,
       subscription_plan, subscription_status, max_users)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'professional', 'active', 20)`,
    [
      clinicId,
      `${prefix} Workspace`,
      email,
      "020 7946 0000",
      "18 Harley Street",
      "London",
      "England",
      "W1G 9QH",
      "UK",
      "Europe/London",
    ],
  );

  await pool.execute(
    `INSERT INTO user
      (id, clinic_id, email, password_hash, first_name, last_name, phone, role,
       email_verified_at, status, is_active)
     VALUES (?, ?, ?, ?, ?, 'Admin', '555-0100', 'SUPER_ADMIN',
       CURRENT_TIMESTAMP, 'active', 1)`,
    [userId, clinicId, email, passwordHash, prefix],
  );

  await pool.execute(
    `INSERT INTO clinic_membership (user_id, clinic_id, role, status, is_primary)
     VALUES (?, ?, 'SUPER_ADMIN', 'active', 1)`,
    [userId, clinicId],
  );

  return { clinicId, userId };
}

function signTwilioForm(authToken: string, url: string, params: Record<string, string>) {
  return twilio.getExpectedTwilioSignature(authToken, url, params);
}

async function postTwilioForm(url: string, authToken: string, params: Record<string, string>, signature?: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "X-Twilio-Signature": signature ?? signTwilioForm(authToken, url, params),
    },
    body: new URLSearchParams(params),
  });
  return {
    response,
    text: await response.text(),
  };
}

async function countInbound(providerMessageId: string, clinicId: string) {
  const [rows]: any = await pool.execute(
    `SELECT COUNT(*) as count
     FROM whatsapp_message
     WHERE clinic_id = ? AND provider_message_id = ? AND direction = 'inbound' AND deleted_at IS NULL`,
    [clinicId, providerMessageId],
  );
  return Number(rows[0]?.count || 0);
}

test("Twilio WhatsApp webhook validates signature, routes by sender, and stores inbound once", async () => {
  await testConnection();
  const workspace = await createWorkspace("TwilioWhatsApp");
  const originalWhatsApp = { ...config.whatsapp };
  const originalTwilio = { ...config.twilio };
  const server = app.listen(0);

  try {
    const address = server.address();
    if (!address || typeof address === "string") {
      throw new Error("Failed to start Twilio WhatsApp webhook test server");
    }
    const endpoint = `http://127.0.0.1:${(address as AddressInfo).port}/api/webhooks/whatsapp/inbound`;
    const accountSid = "AC11111111111111111111111111111111";
    const authToken = "test-auth-token";
    const sender = "whatsapp:+447700900456";
    const messageSid = `SM${uuidv4().replace(/-/g, "").slice(0, 32)}`;
    const params = {
      AccountSid: accountSid,
      MessageSid: messageSid,
      SmsMessageSid: messageSid,
      SmsSid: messageSid,
      MessagingServiceSid: "MG11111111111111111111111111111111",
      From: "whatsapp:+447700900123",
      To: sender,
      Body: "Hi, I need help with SEO and ads",
      ProfileName: "Twilio Lead",
      NumMedia: "0",
    };

    Object.assign(config.whatsapp as any, {
      provider: "twilio",
      defaultWorkspaceId: workspace.clinicId,
      webhookWorkspaceMap: {},
    });
    Object.assign(config.twilio as any, {
      accountSid,
      authToken,
      whatsappSender: sender,
      whatsappWebhookUrl: endpoint,
    });

    const first = await postTwilioForm(endpoint, authToken, params);
    assert.equal(first.response.status, 200);
    assert.match(first.text, /<Response><\/Response>/);
    assert.equal(await countInbound(messageSid, workspace.clinicId), 1);

    const duplicate = await postTwilioForm(endpoint, authToken, params);
    assert.equal(duplicate.response.status, 200);
    assert.equal(await countInbound(messageSid, workspace.clinicId), 1);

    const rejected = await postTwilioForm(endpoint, authToken, { ...params, MessageSid: `SM${uuidv4().replace(/-/g, "").slice(0, 32)}` }, "bad");
    assert.equal(rejected.response.status, 401);
  } finally {
    Object.assign(config.whatsapp as any, originalWhatsApp);
    Object.assign(config.twilio as any, originalTwilio);
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  }
});
