import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import app from "../app.js";
import pool, { testConnection } from "../config/database.js";
import { analyticsStoreService } from "../modules/analytics-store/analytics-store.service.js";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { fleetIngestionService } from "../modules/fleet-ingestion/fleet-ingestion.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";

async function closeServer(server: ReturnType<typeof app.listen>) {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function fetchJson(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const body: any = await response.json();
  return { response, body };
}

async function fetchCsv(baseUrl: string, path: string, token: string) {
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "text/csv",
    },
  });
  return { response, body: await response.text() };
}

test("authenticated workspace cannot read another workspace contact through detail, list or export APIs", async () => {
  await testConnection();
  const primary = await createTestClinicAndAdmin("tenant-isolation-primary");
  const secondary = await createTestClinicAndAdmin("tenant-isolation-secondary");
  const source = `tenant_pen_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

  const primaryContact = await contactsService.createContact(primary.clinicId, primary.userId, {
    firstName: "Primary",
    lastName: "Visible",
    email: `${source}_primary@example.test`,
    phone: "+15550101010",
    source,
    status: "lead",
  });
  const secondaryContact = await contactsService.createContact(secondary.clinicId, secondary.userId, {
    firstName: "Secondary",
    lastName: "Blocked",
    email: `${source}_secondary@example.test`,
    phone: "+15550202020",
    source,
    status: "lead",
  });

  const server = app.listen(0);
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Failed to start tenant isolation test server.");
  }
  const baseUrl = `http://127.0.0.1:${(address as AddressInfo).port}`;

  try {
    const crossTenantDetail = await fetchJson(baseUrl, `/api/contacts/${secondaryContact.contact.id}`, primary.token);
    assert.equal(crossTenantDetail.response.status, 404);
    assert.match(String(crossTenantDetail.body.message || ""), /contact not found/i);

    const searchedList = await fetchJson(
      baseUrl,
      `/api/contacts?search=${encodeURIComponent(`${source}_secondary@example.test`)}`,
      primary.token,
    );
    assert.equal(searchedList.response.status, 200);
    assert.equal(searchedList.body.data.pagination.total, 0);

    const ownList = await fetchJson(baseUrl, `/api/contacts?source=${encodeURIComponent(source)}`, primary.token);
    assert.equal(ownList.response.status, 200);
    assert.equal(ownList.body.data.contacts.some((contact: any) => contact.id === primaryContact.contact.id), true);
    assert.equal(ownList.body.data.contacts.some((contact: any) => contact.id === secondaryContact.contact.id), false);

    const exported = await fetchCsv(baseUrl, `/api/contacts/export/csv?source=${encodeURIComponent(source)}`, primary.token);
    assert.equal(exported.response.status, 200);
    assert.match(exported.body, new RegExp(`${source}_primary@example\\.test`));
    assert.doesNotMatch(exported.body, new RegExp(`${source}_secondary@example\\.test`));
  } finally {
    await closeServer(server);
  }
});

test("new workspace provisioning keeps fleet and analytics records isolated while management scope labels all clients", async () => {
  const primary = await createTestClinicAndAdmin("tenant-provision-primary");
  const secondary = await createTestClinicAndAdmin("tenant-provision-secondary");

  const primarySource = await fleetIngestionService.configureSource({
    clinicId: primary.clinicId,
    tenantKey: `provision-primary-${primary.clinicId}`,
    displayName: "Provision Primary",
    dataState: "live",
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceLabel: "Primary lead feed",
    endpointKind: "webhook",
  });
  const secondarySource = await fleetIngestionService.configureSource({
    clinicId: secondary.clinicId,
    tenantKey: `provision-secondary-${secondary.clinicId}`,
    displayName: "Provision Secondary",
    dataState: "live",
    sourceSystem: "clinic_os",
    sourceKey: "lead_feed",
    sourceLabel: "Secondary lead feed",
    endpointKind: "webhook",
  });

  await analyticsStoreService.recordFact({
    clinicId: primary.clinicId,
    metricKey: "lead_ingestion",
    grain: "daily",
    grainDate: "2026-08-24",
    metricValue: 3,
    unit: "count",
    dimensions: { source: "primary" },
    provenance: "connector",
    sourceId: primarySource.id,
  });
  await analyticsStoreService.recordFact({
    clinicId: secondary.clinicId,
    metricKey: "lead_ingestion",
    grain: "daily",
    grainDate: "2026-08-24",
    metricValue: 7,
    unit: "count",
    dimensions: { source: "secondary" },
    provenance: "connector",
    sourceId: secondarySource.id,
  });

  const primarySources = await fleetIngestionService.listSources(primary.clinicId);
  const secondarySources = await fleetIngestionService.listSources(secondary.clinicId);
  const primaryFacts = await analyticsStoreService.listFacts(primary.clinicId, { metricKey: "lead_ingestion" });
  const secondaryFacts = await analyticsStoreService.listFacts(secondary.clinicId, { metricKey: "lead_ingestion" });
  const primaryManagementScope = await fleetIngestionService.getSyncAdministration(primary.clinicId, false);
  const allClientManagementScope = await fleetIngestionService.getSyncAdministration(primary.clinicId, true);

  assert.equal(primarySources.length, 1);
  assert.equal(primarySources[0]?.id, primarySource.id);
  assert.equal(secondarySources.length, 1);
  assert.equal(secondarySources[0]?.id, secondarySource.id);
  assert.equal(primaryFacts.length, 1);
  assert.equal(primaryFacts[0]?.metricValue, 3);
  assert.equal(secondaryFacts.length, 1);
  assert.equal(secondaryFacts[0]?.metricValue, 7);
  assert.equal(primaryManagementScope.scope, "current_clinic");
  assert.deepEqual([...new Set(primaryManagementScope.health.map((row) => row.clinicId))], [primary.clinicId]);
  assert.equal(allClientManagementScope.scope, "all_clients");
  assert.equal(allClientManagementScope.health.some((row) => row.clinicId === primary.clinicId && row.clinicName), true);
  assert.equal(allClientManagementScope.health.some((row) => row.clinicId === secondary.clinicId && row.clinicName), true);

  const [tenantRows]: any = await pool.execute(
    `SELECT clinic_id as clinicId, tenant_key as tenantKey
     FROM fleet_tenant_registry
     WHERE clinic_id IN (?, ?)
     ORDER BY clinic_id`,
    [primary.clinicId, secondary.clinicId],
  );
  assert.equal(tenantRows.length, 2);
  assert.notEqual(tenantRows[0].tenantKey, tenantRows[1].tenantKey);
});
