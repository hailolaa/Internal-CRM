import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { apiKeysService } from "../modules/api-keys/api-keys.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function postLead(baseUrl: string, apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/public/landing-page-leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body: any = await response.json().catch(() => ({}));
  return { response, body };
}

async function postWebsiteLead(baseUrl: string, apiKey: string, payload: Record<string, unknown>) {
  const response = await fetch(`${baseUrl}/api/public/website-leads`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const body: any = await response.json().catch(() => ({}));
  return { response, body };
}

test("landing-page lead intake is source-scoped, idempotent and workspace-safe", async () => {
  await testConnection();

  const primary = await createTestClinicAndAdmin("LandingLeadPrimary");
  const secondary = await createTestClinicAndAdmin("LandingLeadSecondary");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start landing-page lead intake test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    await assert.rejects(
      () => apiKeysService.createApiKey(primary.clinicId, primary.userId, {
        name: "Cross workspace owner",
        purpose: "landing_page_lead_capture",
        sourceKey: "cross_workspace",
        ownerUserId: secondary.userId,
      }),
      /Owner user must belong to this workspace/,
    );

    const createdKey = await apiKeysService.createApiKey(primary.clinicId, primary.userId, {
      name: "ClinicGrower website lead capture",
      purpose: "landing_page_lead_capture",
      sourceKey: "clinicgrower_website",
      sourceLabel: "ClinicGrower website",
      defaultSource: "clinicgrower_website",
      initialStageName: "New Lead",
      ownerUserId: primary.userId,
      followUpEnabled: true,
    });
    assert.ok(createdKey.key, "new API key should be returned once");

    const invalidKeyResult = await postLead(baseUrl, "not-a-real-key", {
      fullName: "Invalid Lead",
      email: "invalid@example.com",
    });
    assert.equal(invalidKeyResult.response.status, 401);

    const malformedResult = await postLead(baseUrl, createdKey.key!, {
      message: "No identity or contact method",
    });
    assert.equal(malformedResult.response.status, 400);
    assert.match(malformedResult.body.message, /account name or contact name/i);

    const payload = {
      idempotencyKey: `landing-test-${Date.now()}`,
      accountName: "BristolDent Harbourside",
      fullName: "Sarah Thompson",
      email: `sarah.${Date.now()}@example.com`,
      phone: "+447700900123",
      website: "https://bristoldent.example",
      message: "I want help with SEO and paid ads.",
      packageInterest: "Clinic Growth",
      landingPage: "https://clinicgrower.co.uk/clinic-growth",
      referrer: "https://google.com",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "clinic-growth-test",
      gclid: "test-gclid",
      consent: {
        email: true,
        phone: true,
        whatsapp: true,
        permissionSource: "Landing page form checkbox",
      },
    };

    const firstResult = await postLead(baseUrl, createdKey.key!, payload);
    assert.equal(firstResult.response.status, 201);
    assert.equal(firstResult.body.status, "success");
    assert.equal(firstResult.body.data.duplicateEvent, false);
    assert.ok(firstResult.body.data.contactId);
    assert.ok(firstResult.body.data.dealId);
    assert.ok(firstResult.body.data.nextActionTaskId);

    const [contactRows]: any = await pool.execute(
      `SELECT id,
              clinic_id as clinicId,
              email,
              source,
              latest_source as latestSource,
              landing_page as landingPage,
              utm_source as utmSource,
              gclid,
              package_interest as packageInterest,
              email_permission as canEmail,
              phone_permission as canCall,
              whatsapp_permission as canWhatsAppMessage,
              permission_source as permissionSource
       FROM contact
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [firstResult.body.data.contactId, primary.clinicId],
    );
    assert.equal(contactRows.length, 1);
    assert.equal(contactRows[0].source, "clinicgrower_website");
    assert.equal(contactRows[0].latestSource, "clinicgrower_website");
    assert.equal(contactRows[0].landingPage, payload.landingPage);
    assert.equal(contactRows[0].utmSource, "google");
    assert.equal(contactRows[0].gclid, "test-gclid");
    assert.equal(contactRows[0].packageInterest, "Clinic Growth");
    assert.equal(Boolean(contactRows[0].canEmail), true);
    assert.equal(Boolean(contactRows[0].canCall), true);
    assert.equal(Boolean(contactRows[0].canWhatsAppMessage), true);
    assert.equal(contactRows[0].permissionSource, "Landing page form checkbox");

    const [dealRows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, contact_id as contactId, stage, owner_id as ownerId, source
       FROM deal
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [firstResult.body.data.dealId, primary.clinicId],
    );
    assert.equal(dealRows.length, 1);
    assert.equal(dealRows[0].contactId, firstResult.body.data.contactId);
    assert.equal(dealRows[0].stage, "New Lead");
    assert.equal(dealRows[0].ownerId, primary.userId);
    assert.equal(dealRows[0].source, "clinicgrower_website");

    const [taskRows]: any = await pool.execute(
      `SELECT id, clinic_id as clinicId, contact_id as contactId, assigned_user_id as assignedUserId, status
       FROM task
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [firstResult.body.data.nextActionTaskId, primary.clinicId],
    );
    assert.equal(taskRows.length, 1);
    assert.equal(taskRows[0].contactId, firstResult.body.data.contactId);
    assert.equal(taskRows[0].assignedUserId, primary.userId);
    assert.equal(taskRows[0].status, "pending");

    const retryResult = await postLead(baseUrl, createdKey.key!, payload);
    assert.equal(retryResult.response.status, 200);
    assert.equal(retryResult.body.data.duplicateEvent, true);
    assert.equal(retryResult.body.data.contactId, firstResult.body.data.contactId);

    const [rawRows]: any = await pool.execute(
      `SELECT id, source, source_event_id as sourceEventId, status, linked_entity_id as linkedEntityId
       FROM integration_raw_payload
       WHERE clinic_id = ? AND source_event_id = ?
       ORDER BY created_at DESC`,
      [primary.clinicId, payload.idempotencyKey],
    );
    assert.equal(rawRows.length, 1);
    assert.equal(rawRows[0].source, `landing_page_lead_capture:${createdKey.id}`);
    assert.equal(rawRows[0].linkedEntityId, firstResult.body.data.contactId);
    assert.equal(rawRows[0].status, "processed");

    const upsertResult = await postLead(baseUrl, createdKey.key!, {
      ...payload,
      idempotencyKey: `${payload.idempotencyKey}-second`,
      message: "Second submit from the same person.",
      utmCampaign: "clinic-growth-second-submit",
    });
    assert.equal(upsertResult.response.status, 201);
    assert.equal(upsertResult.body.data.contactId, firstResult.body.data.contactId);

    const [contactCountRows]: any = await pool.execute(
      `SELECT COUNT(*) as count
       FROM contact
       WHERE clinic_id = ? AND email = ? AND deleted_at IS NULL`,
      [primary.clinicId, payload.email],
    );
    assert.equal(Number(contactCountRows[0].count), 1);

    const chatbotKey = await apiKeysService.createApiKey(primary.clinicId, primary.userId, {
      name: "Website chatbot lead capture",
      purpose: "general",
    });
    assert.ok(chatbotKey.key, "chatbot API key should be returned once");

    const chatbotPayload = {
      accountName: "Bath Skin Studio",
      fullName: "Priya Patel",
      email: `priya.${Date.now()}@example.com`,
      phone: "+447700900456",
      source: "website",
      chatbotConversationId: `chatbot-${Date.now()}`,
      conversationTranscript: "Visitor asked whether Clinic Growth can help with paid search and booking follow-up.",
      packageInterest: "Clinic Growth",
      landingPage: "https://clinicgrower.co.uk/chatbot",
      utmSource: "chatbot",
      utmMedium: "website_widget",
      utmCampaign: "chatbot-intake-test",
      consent: {
        email: true,
        phone: true,
        permissionSource: "Chatbot consent step",
      },
    };

    const chatbotResult = await postWebsiteLead(baseUrl, chatbotKey.key!, chatbotPayload);
    assert.equal(chatbotResult.response.status, 201);
    assert.equal(chatbotResult.body.status, "success");
    assert.equal(chatbotResult.body.data.duplicateEvent, false);
    assert.ok(chatbotResult.body.data.contactId);
    assert.ok(chatbotResult.body.data.dealId);
    assert.ok(chatbotResult.body.data.nextActionTaskId);
    assert.equal(chatbotResult.body.data.chatbotActivityId, chatbotResult.body.data.rawPayloadId);

    const [chatbotContactRows]: any = await pool.execute(
      `SELECT id,
              source,
              latest_source as latestSource,
              landing_page as landingPage,
              utm_source as utmSource,
              package_interest as packageInterest,
              notes
       FROM contact
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [chatbotResult.body.data.contactId, primary.clinicId],
    );
    assert.equal(chatbotContactRows.length, 1);
    assert.equal(chatbotContactRows[0].source, "website_chatbot");
    assert.equal(chatbotContactRows[0].latestSource, "website_chatbot");
    assert.equal(chatbotContactRows[0].landingPage, chatbotPayload.landingPage);
    assert.equal(chatbotContactRows[0].utmSource, "chatbot");
    assert.equal(chatbotContactRows[0].packageInterest, "Clinic Growth");
    assert.match(chatbotContactRows[0].notes, /Chatbot conversation ID:/);
    assert.match(chatbotContactRows[0].notes, /Chatbot transcript:/);

    const [chatbotDealRows]: any = await pool.execute(
      `SELECT id, stage, source, treatment
       FROM deal
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [chatbotResult.body.data.dealId, primary.clinicId],
    );
    assert.equal(chatbotDealRows.length, 1);
    assert.equal(chatbotDealRows[0].stage, "New Lead");
    assert.equal(chatbotDealRows[0].source, "website_chatbot");
    assert.equal(chatbotDealRows[0].treatment, "Clinic Growth");

    const [chatbotTaskRows]: any = await pool.execute(
      `SELECT id, title, priority, status, due_label as dueLabel
       FROM task
       WHERE id = ? AND clinic_id = ?
       LIMIT 1`,
      [chatbotResult.body.data.nextActionTaskId, primary.clinicId],
    );
    assert.equal(chatbotTaskRows.length, 1);
    assert.equal(chatbotTaskRows[0].title, "Review chatbot conversation and follow up");
    assert.equal(chatbotTaskRows[0].priority, "high");
    assert.equal(chatbotTaskRows[0].status, "pending");
    assert.equal(chatbotTaskRows[0].dueLabel, "Review today");

    const [chatbotRawRows]: any = await pool.execute(
      `SELECT id, source, source_event_id as sourceEventId, status, linked_entity_id as linkedEntityId
       FROM integration_raw_payload
       WHERE clinic_id = ? AND source_event_id = ?
       ORDER BY created_at DESC`,
      [primary.clinicId, chatbotPayload.chatbotConversationId],
    );
    assert.equal(chatbotRawRows.length, 1);
    assert.equal(chatbotRawRows[0].source, "website_lead_capture");
    assert.equal(chatbotRawRows[0].linkedEntityId, chatbotResult.body.data.contactId);
    assert.equal(chatbotRawRows[0].status, "processed");

    const chatbotRetryResult = await postWebsiteLead(baseUrl, chatbotKey.key!, chatbotPayload);
    assert.equal(chatbotRetryResult.response.status, 200);
    assert.equal(chatbotRetryResult.body.data.duplicateEvent, true);
    assert.equal(chatbotRetryResult.body.data.contactId, chatbotResult.body.data.contactId);

    const [chatbotRetryCounts]: any = await pool.execute(
      `SELECT
         (SELECT COUNT(*) FROM contact WHERE clinic_id = ? AND email = ? AND deleted_at IS NULL) as contactCount,
         (SELECT COUNT(*) FROM integration_raw_payload WHERE clinic_id = ? AND source_event_id = ?) as rawCount,
         (SELECT COUNT(*) FROM task WHERE clinic_id = ? AND contact_id = ? AND title = 'Review chatbot conversation and follow up' AND deleted_at IS NULL) as taskCount
       `,
      [
        primary.clinicId,
        chatbotPayload.email,
        primary.clinicId,
        chatbotPayload.chatbotConversationId,
        primary.clinicId,
        chatbotResult.body.data.contactId,
      ],
    );
    assert.equal(Number(chatbotRetryCounts[0].contactCount), 1);
    assert.equal(Number(chatbotRetryCounts[0].rawCount), 1);
    assert.equal(Number(chatbotRetryCounts[0].taskCount), 1);

    await apiKeysService.revokeApiKey(primary.clinicId, primary.userId, createdKey.id);
    const revokedResult = await postLead(baseUrl, createdKey.key!, {
      ...payload,
      idempotencyKey: `${payload.idempotencyKey}-revoked`,
      email: "revoked@example.com",
    });
    assert.equal(revokedResult.response.status, 401);
  } finally {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  }
});
