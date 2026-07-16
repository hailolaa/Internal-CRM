import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import app from "../app.js";
import { config } from "../config/index.js";
import pool, { testConnection } from "../config/database.js";
import { whatsappAiService } from "../modules/comms/whatsapp-ai.service.js";
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

  return {
    clinicId,
    userId,
    token: generateToken({
      userId,
      clinicId,
      role: "SUPER_ADMIN",
      email,
    }),
  };
}

function metaPayload({
  id,
  from,
  text,
  phoneNumberId,
}: {
  id: string;
  from: string;
  text: string;
  phoneNumberId: string;
}) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba-test",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "447700900000",
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  wa_id: from,
                  profile: { name: "WhatsApp Lead" },
                },
              ],
              messages: [
                {
                  id,
                  from,
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: text },
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

function signBody(rawBody: string, appSecret: string) {
  return `sha256=${crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex")}`;
}

async function postJson(url: string, body: unknown, options: { appSecret?: string; signature?: string | null } = {}) {
  const rawBody = JSON.stringify(body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (options.signature !== null && options.appSecret) {
    headers["X-Hub-Signature-256"] = options.signature || signBody(rawBody, options.appSecret);
  } else if (options.signature) {
    headers["X-Hub-Signature-256"] = options.signature;
  }

  const response = await fetch(url, {
    method: "POST",
    headers,
    body: rawBody,
  });
  const payload: any = await response.json();
  return { response, payload };
}

async function countRows(sql: string, values: any[]) {
  const [rows]: any = await pool.execute(sql, values);
  return Number(rows[0]?.count || 0);
}

test("WhatsApp AI webhooks are authenticated, tenant-routed, guarded, idempotent, and auditable", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("WhatsAppAiPrimary");
  const secondary = await createClinicAndAdmin("WhatsAppAiSecondary");

  const originalWhatsApp = { ...config.whatsapp };
  const originalFetch = globalThis.fetch;
  const appSecret = "test-meta-app-secret";
  Object.assign(config.whatsapp as any, {
    provider: "log",
    phoneNumberId: "meta-phone-primary",
    webhookSecret: "test-whatsapp-secret",
    appSecret,
    verifyToken: "test-whatsapp-verify",
    defaultWorkspaceId: primary.clinicId,
    webhookWorkspaceMap: {
      "meta-phone-primary": primary.clinicId,
    },
  });

  await whatsappAiService.updateSettings(primary.clinicId, primary.userId, {
    autoSendEnabled: true,
    businessHoursEnabled: false,
    confidenceThreshold: 0.5,
    maxAutoSendRetries: 2,
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start WhatsApp AI test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const unsigned = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-unsigned",
        from: "447700900111",
        text: "Hi, I need help with SEO",
        phoneNumberId: "meta-phone-primary",
      }),
      { signature: null },
    );
    assert.equal(unsigned.response.status, 401);

    const invalidSignature = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-invalid-signature",
        from: "447700900111",
        text: "Hi, I need help with SEO",
        phoneNumberId: "meta-phone-primary",
      }),
      { signature: "sha256=invalid" },
    );
    assert.equal(invalidSignature.response.status, 401);

    const unmappedPhone = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-unmapped-phone",
        from: "447700900112",
        text: "Hi, I need help with SEO",
        phoneNumberId: "meta-phone-unknown",
      }),
      { appSecret },
    );
    assert.equal(unmappedPhone.response.status, 403);

    const optOut = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-opt-out",
        from: "447700900113",
        text: "Stop contacting me please",
        phoneNumberId: "meta-phone-primary",
      }),
      { appSecret },
    );
    assert.equal(optOut.response.status, 200);
    assert.equal(optOut.payload.status, "success");
    assert.equal(optOut.payload.data.aiReply.status, "human_required");
    assert.equal(optOut.payload.data.aiReply.guardrailReason, "opt_out");
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND direction = 'outbound' AND contact_id = ? AND deleted_at IS NULL",
        [primary.clinicId, optOut.payload.data.message.contactId],
      ),
      0,
    );

    const normal = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-normal-message",
        from: "447700900114",
        text: "Hi, I want help with SEO and ads",
        phoneNumberId: "meta-phone-primary",
      }),
      { appSecret },
    );
    assert.equal(normal.response.status, 200);
    assert.equal(normal.payload.status, "success");
    assert.equal(normal.payload.data.aiReply.status, "auto_sent");
    const replyId = normal.payload.data.aiReply.id;
    const contactId = normal.payload.data.message.contactId;

    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND direction = 'outbound' AND idempotency_key = ? AND deleted_at IS NULL",
        [primary.clinicId, `whatsapp-ai-reply:${replyId}`],
      ),
      1,
    );
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND provider_message_id = ? AND direction = 'inbound' AND deleted_at IS NULL",
        [primary.clinicId, "wa-normal-message"],
      ),
      1,
    );

    const duplicateInbound = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-normal-message",
        from: "447700900114",
        text: "Hi, I want help with SEO and ads",
        phoneNumberId: "meta-phone-primary",
      }),
      { appSecret },
    );
    assert.equal(duplicateInbound.response.status, 200);
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND provider_message_id = ? AND direction = 'inbound' AND deleted_at IS NULL",
        [primary.clinicId, "wa-normal-message"],
      ),
      1,
    );

    const concurrentDuplicatePayload = metaPayload({
      id: "wa-concurrent-duplicate",
      from: "447700900117",
      text: "Hi, I want help with tracking and reports",
      phoneNumberId: "meta-phone-primary",
    });
    const [firstConcurrentInbound, secondConcurrentInbound] = await Promise.all([
      postJson(`${baseUrl}/api/webhooks/whatsapp/inbound`, concurrentDuplicatePayload, { appSecret }),
      postJson(`${baseUrl}/api/webhooks/whatsapp/inbound`, concurrentDuplicatePayload, { appSecret }),
    ]);
    assert.equal(firstConcurrentInbound.response.status, 200);
    assert.equal(secondConcurrentInbound.response.status, 200);
    assert.equal(
      firstConcurrentInbound.payload.data.message.id,
      secondConcurrentInbound.payload.data.message.id,
    );
    assert.equal(
      firstConcurrentInbound.payload.data.aiReply.id,
      secondConcurrentInbound.payload.data.aiReply.id,
    );
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND provider_message_id = ? AND direction = 'inbound' AND deleted_at IS NULL",
        [primary.clinicId, "wa-concurrent-duplicate"],
      ),
      1,
    );
    assert.equal(
      await countRows(
        `SELECT COUNT(*) as count
         FROM whatsapp_ai_reply war
         JOIN whatsapp_message wm ON wm.id = war.inbound_message_id
         WHERE war.clinic_id = ? AND wm.provider_message_id = ? AND war.deleted_at IS NULL`,
        [primary.clinicId, "wa-concurrent-duplicate"],
      ),
      1,
    );
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND direction = 'outbound' AND idempotency_key = ? AND deleted_at IS NULL",
        [
          primary.clinicId,
          `whatsapp-ai-reply:${firstConcurrentInbound.payload.data.aiReply.id}`,
        ],
      ),
      1,
    );

    await whatsappAiService.updateSettings(primary.clinicId, primary.userId, {
      autoSendEnabled: false,
      businessHoursEnabled: false,
      confidenceThreshold: 0.5,
    });

    const approvalInbound = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-approval-concurrency",
        from: "447700900115",
        text: "Can you send over the package options?",
        phoneNumberId: "meta-phone-primary",
      }),
      { appSecret },
    );
    assert.equal(approvalInbound.response.status, 200);
    assert.equal(approvalInbound.payload.data.aiReply.status, "needs_approval");

    let providerSendCount = 0;
    Object.assign(config.whatsapp as any, {
      provider: "meta",
      accessToken: "test-meta-access-token",
      phoneNumberId: "meta-phone-primary",
    });
    globalThis.fetch = (async () => {
      providerSendCount += 1;
      await new Promise((resolve) => setTimeout(resolve, 80));
      return new Response(JSON.stringify({ messages: [{ id: `meta-message-${providerSendCount}` }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as typeof fetch;

    const concurrentReplyId = approvalInbound.payload.data.aiReply.id;
    const approveUrl = `${baseUrl}/api/comms/whatsapp/ai-replies/${concurrentReplyId}/approve`;
    const [firstApproval, secondApproval] = await Promise.all([
      originalFetch(approveUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${primary.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ sendNow: true }),
      }),
      originalFetch(approveUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${primary.token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ sendNow: true }),
      }),
    ]);
    assert.equal(firstApproval.ok, true);
    assert.equal(secondApproval.ok, true);
    assert.equal(providerSendCount, 1);
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND direction = 'outbound' AND idempotency_key = ? AND deleted_at IS NULL",
        [primary.clinicId, `whatsapp-ai-reply:${concurrentReplyId}`],
      ),
      1,
    );

    globalThis.fetch = originalFetch;
    Object.assign(config.whatsapp as any, { provider: "log" });
    const timeoutInbound = await postJson(
      `${baseUrl}/api/webhooks/whatsapp/inbound`,
      metaPayload({
        id: "wa-timeout-retry",
        from: "447700900116",
        text: "Can I book a call?",
        phoneNumberId: "meta-phone-primary",
      }),
      { appSecret },
    );
    assert.equal(timeoutInbound.response.status, 200);
    assert.equal(timeoutInbound.payload.data.aiReply.status, "needs_approval");

    Object.assign(config.whatsapp as any, { provider: "meta" });
    let timeoutProviderSendCount = 0;
    globalThis.fetch = (async () => {
      timeoutProviderSendCount += 1;
      throw new Error("network timeout after provider attempt");
    }) as typeof fetch;

    const timeoutReplyId = timeoutInbound.payload.data.aiReply.id;
    const failedApproval = await originalFetch(`${baseUrl}/api/comms/whatsapp/ai-replies/${timeoutReplyId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${primary.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ sendNow: true }),
    });
    const failedApprovalBody: any = await failedApproval.json();
    assert.equal(failedApproval.status, 200);
    assert.equal(failedApprovalBody.data.status, "failed");

    const rejectedRetry = await originalFetch(`${baseUrl}/api/comms/whatsapp/ai-replies/${timeoutReplyId}/retry`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${primary.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    });
    assert.equal(rejectedRetry.status, 400);
    assert.equal(timeoutProviderSendCount, 1);
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND direction = 'outbound' AND idempotency_key = ? AND deleted_at IS NULL",
        [primary.clinicId, `whatsapp-ai-reply:${timeoutReplyId}`],
      ),
      1,
    );

    const approvalAgain = await originalFetch(`${baseUrl}/api/comms/whatsapp/ai-replies/${replyId}/approve`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${primary.token}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ sendNow: true }),
    });
    const approvalBody: any = await approvalAgain.json();
    assert.equal(approvalAgain.status, 200);
    assert.equal(approvalBody.data.status, "auto_sent");
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND direction = 'outbound' AND idempotency_key = ? AND deleted_at IS NULL",
        [primary.clinicId, `whatsapp-ai-reply:${replyId}`],
      ),
      1,
    );

    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM whatsapp_message WHERE clinic_id = ? AND contact_id = ? AND deleted_at IS NULL",
        [secondary.clinicId, contactId],
      ),
      0,
    );
    assert.equal(
      await countRows(
        "SELECT COUNT(*) as count FROM audit_log WHERE clinic_id = ? AND action IN ('WHATSAPP_INBOUND_RECEIVED', 'WHATSAPP_AI_REPLY_DRAFTED', 'WHATSAPP_AI_REPLY_AUTO_SENT')",
        [primary.clinicId],
      ) >= 3,
      true,
    );

    console.log("[whatsapp-ai] webhook auth, tenant routing, guardrails, idempotency, and audit coverage passed");
  } finally {
    globalThis.fetch = originalFetch;
    Object.assign(config.whatsapp as any, originalWhatsApp);
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
    await pool.end();
  }
});
