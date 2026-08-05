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
      packageInterest: "Growth Engine",
      landingPage: "https://clinicgrower.co.uk/growth-engine",
      referrer: "https://google.com",
      utmSource: "google",
      utmMedium: "cpc",
      utmCampaign: "growth-engine-test",
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
    assert.equal(contactRows[0].packageInterest, "Growth Engine");
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
      utmCampaign: "growth-engine-second-submit",
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
