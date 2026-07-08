import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { authService } from "../modules/auth/auth.service.js";

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

test("campaign media upload, replacement, deletion, and tenant scope stay live", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("CampaignMediaPrimary");
  const secondary = await createClinicAndAdmin("CampaignMediaSecondary");

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start campaign media test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const created = await fetchJson(baseUrl, "/api/campaigns", primary.token, {
      method: "POST",
      body: JSON.stringify({
        name: `Media Campaign ${Date.now()}`,
        status: "draft",
        channel: "meta",
      }),
    });
    assert.equal(created.response.status, 201);
    const campaignId = created.body.data.id;

    const invalidUpload = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        fileName: "notes.txt",
        mimeType: "text/plain",
        sizeBytes: 5,
        dataUrl: "data:text/plain;base64,aGVsbG8=",
      }),
    });
    assert.equal(invalidUpload.response.status, 400);

    const pngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const uploaded = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        fileName: "launch.png",
        mimeType: "image/png",
        sizeBytes: 70,
        dataUrl: pngDataUrl,
      }),
    });
    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.body.data.fileName, "launch.png");
    assert.equal(uploaded.body.data.mimeType, "image/png");
    assert.match(uploaded.body.data.dataUrl, /^data:image\/png;base64,/);
    const mediaId = uploaded.body.data.id;

    const list = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media`, primary.token);
    assert.equal(list.response.status, 200);
    assert.equal(list.body.data.length, 1);
    assert.equal(list.body.data[0].id, mediaId);

    const campaigns = await fetchJson(baseUrl, "/api/campaigns", primary.token);
    assert.equal(campaigns.response.status, 200);
    const campaign = campaigns.body.data.find((item: any) => item.id === campaignId);
    assert.ok(campaign);
    assert.equal(campaign.media.length, 1);
    assert.equal(campaign.media[0].fileName, "launch.png");

    const crossTenantList = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media`, secondary.token);
    assert.equal(crossTenantList.response.status, 404);

    const replaced = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media/${mediaId}`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({
        fileName: "launch-replaced.png",
        mimeType: "image/png",
        sizeBytes: 70,
        dataUrl: pngDataUrl,
      }),
    });
    assert.equal(replaced.response.status, 200);
    assert.equal(replaced.body.data.fileName, "launch-replaced.png");

    const crossTenantDelete = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media/${mediaId}`, secondary.token, {
      method: "DELETE",
    });
    assert.equal(crossTenantDelete.response.status, 404);

    const deleted = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media/${mediaId}`, primary.token, {
      method: "DELETE",
    });
    assert.equal(deleted.response.status, 200);

    const afterDelete = await fetchJson(baseUrl, `/api/campaigns/${campaignId}/media`, primary.token);
    assert.equal(afterDelete.response.status, 200);
    assert.equal(afterDelete.body.data.length, 0);
    console.log("[campaign-media] upload, replacement, deletion, and tenant scope test passed");
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }
});
