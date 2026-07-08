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

test("compliance files and data access requests stay tenant scoped and audited", async () => {
  await testConnection();

  const primary = await createClinicAndAdmin("CompliancePrimary");
  const secondary = await createClinicAndAdmin("ComplianceSecondary");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start compliance test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  let documentId = "";
  let requestId = "";

  try {
    const createdDocument = await fetchJson(baseUrl, "/api/compliance/documents", primary.token, {
      method: "POST",
      body: JSON.stringify({
        title: "GDPR Policy",
        status: "action_required",
        category: "gdpr",
      }),
    });
    assert.equal(createdDocument.response.status, 201);
    documentId = createdDocument.body.data.id;

    const invalidFile = await fetchJson(baseUrl, `/api/compliance/documents/${documentId}/file`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        fileName: "policy.exe",
        mimeType: "application/x-msdownload",
        sizeBytes: 4,
        dataUrl: "data:application/x-msdownload;base64,dGVzdA==",
      }),
    });
    assert.equal(invalidFile.response.status, 400);

    const textDataUrl = "data:text/plain;base64,R0RQUiBwb2xpY3kgY29udGVudA==";
    const uploaded = await fetchJson(baseUrl, `/api/compliance/documents/${documentId}/file`, primary.token, {
      method: "POST",
      body: JSON.stringify({
        fileName: "gdpr-policy.txt",
        mimeType: "text/plain",
        sizeBytes: 19,
        dataUrl: textDataUrl,
      }),
    });
    assert.equal(uploaded.response.status, 201);
    assert.equal(uploaded.body.data.fileName, "gdpr-policy.txt");
    assert.match(uploaded.body.data.dataUrl, /^data:text\/plain;base64,/);

    const documents = await fetchJson(baseUrl, "/api/compliance/documents", primary.token);
    assert.equal(documents.response.status, 200);
    const document = documents.body.data.find((item: any) => item.id === documentId);
    assert.ok(document);
    assert.equal(document.hasFile, true);
    assert.equal(document.status, "complete");

    const crossTenantFile = await fetchJson(baseUrl, `/api/compliance/documents/${documentId}/file`, secondary.token);
    assert.equal(crossTenantFile.response.status, 404);

    const downloaded = await fetchJson(baseUrl, `/api/compliance/documents/${documentId}/file`, primary.token);
    assert.equal(downloaded.response.status, 200);
    assert.equal(downloaded.body.data.fileName, "gdpr-policy.txt");

    const deletedFile = await fetchJson(baseUrl, `/api/compliance/documents/${documentId}/file`, primary.token, {
      method: "DELETE",
    });
    assert.equal(deletedFile.response.status, 200);

    const createdRequest = await fetchJson(baseUrl, "/api/compliance/data-access-requests", primary.token, {
      method: "POST",
      body: JSON.stringify({
        requesterName: "Jane Patient",
        requesterEmail: uniqueEmail("dar_patient"),
        requestType: "access",
        notes: "Patient requested a copy of personal data.",
      }),
    });
    assert.equal(createdRequest.response.status, 201);
    requestId = createdRequest.body.data.id;
    assert.equal(createdRequest.body.data.status, "received");
    assert.equal(createdRequest.body.data.dueDate.length, 10);

    const crossTenantUpdate = await fetchJson(baseUrl, `/api/compliance/data-access-requests/${requestId}`, secondary.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed" }),
    });
    assert.equal(crossTenantUpdate.response.status, 404);

    const updatedRequest = await fetchJson(baseUrl, `/api/compliance/data-access-requests/${requestId}`, primary.token, {
      method: "PATCH",
      body: JSON.stringify({ status: "completed", notes: "Export delivered." }),
    });
    assert.equal(updatedRequest.response.status, 200);
    assert.equal(updatedRequest.body.data.status, "completed");
    assert.ok(updatedRequest.body.data.completedAt);

    const listRequests = await fetchJson(baseUrl, "/api/compliance/data-access-requests", primary.token);
    assert.equal(listRequests.response.status, 200);
    assert.equal(listRequests.body.data.some((item: any) => item.id === requestId), true);

    const archivedRequest = await fetchJson(baseUrl, `/api/compliance/data-access-requests/${requestId}`, primary.token, {
      method: "DELETE",
    });
    assert.equal(archivedRequest.response.status, 200);
    console.log("[compliance-files-requests] file storage, DAR lifecycle, and tenant guards passed");
  } finally {
    if (requestId) {
      await pool.execute(
        "UPDATE compliance_data_access_request SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
        [requestId],
      );
    }
    if (documentId) {
      await pool.execute(
        "UPDATE compliance_document SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?",
        [documentId],
      );
    }
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    await pool.end();
  }
});
