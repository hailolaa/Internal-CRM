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

test("contact import previews and imports published Google Sheets CSV", async () => {
  await testConnection();

  const originalFetch = globalThis.fetch;
  const sheetCsv = [
    "firstName,lastName,email,phone,tags,source,status,notes",
    `Sheet,Patient,${uniqueEmail("sheet_patient")},07700 900321,"sheets; phase1",Google Sheet,lead,Imported from sheet`,
  ].join("\n");

  globalThis.fetch = (async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
    const url = String(input);
    if (url.startsWith("https://docs.google.com/spreadsheets/")) {
      return new Response(sheetCsv, {
        status: 200,
        headers: { "Content-Type": "text/csv" },
      });
    }
    return originalFetch(input, init);
  }) as typeof fetch;

  const primary = await createClinicAndAdmin("ContactImportSheets");
  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start contact import test server");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;
  const sourceUrl = "https://docs.google.com/spreadsheets/d/test-sheet-id/edit#gid=0";

  try {
    const preview = await fetchJson(baseUrl, "/api/contacts/import/preview", primary.token, {
      method: "POST",
      body: JSON.stringify({ sourceUrl }),
    });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.body.data.rows.length, 1);
    assert.equal(preview.body.data.rows[0].firstName, "Sheet");

    const imported = await fetchJson(baseUrl, "/api/contacts/import", primary.token, {
      method: "POST",
      body: JSON.stringify({
        sourceUrl,
        filename: "google-sheets",
        mode: "create_only",
        rows: preview.body.data.rows,
      }),
    });
    assert.equal(imported.response.status, 201);
    assert.equal(imported.body.data.insertedRows, 1);
    assert.equal(imported.body.data.totalRows, 1);

    const [rows]: any = await pool.execute(
      `SELECT id, first_name as firstName, source, import_batch_id as importBatchId
       FROM contact
       WHERE clinic_id = ?
         AND email = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [primary.clinicId, preview.body.data.rows[0].email],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firstName, "Sheet");
    assert.equal(rows[0].source, "Google Sheet");
    assert.equal(rows[0].importBatchId, imported.body.data.batchId);

    await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE clinic_id = ? AND import_batch_id = ?`,
      [primary.clinicId, imported.body.data.batchId],
    );
    console.log("[contact-import-sheets] preview and import passed");
  } finally {
    server.close();
    globalThis.fetch = originalFetch;
    await pool.end();
  }
});
