import assert from "node:assert/strict";
import test from "node:test";
import { contactsService } from "../modules/contacts/contacts.service.js";
import { createTestClinicAndAdmin } from "./test-fixtures.js";
import { testConnection } from "../config/database.js";

function csvDataRows(csv: string) {
  return csv.trim().split(/\r?\n/).slice(1);
}

test("contacts list pagination reaches records beyond the first page and CSV export is not capped by normal page size", async () => {
  await testConnection();

  const primary = await createTestClinicAndAdmin("ContactPaginationPrimary");
  const secondary = await createTestClinicAndAdmin("ContactPaginationSecondary");
  const source = `pagination_export_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
  const totalContacts = 260;

  for (let index = 0; index < totalContacts; index += 1) {
    await contactsService.createContact(primary.clinicId, primary.userId, {
      firstName: "Pagination",
      lastName: `Contact ${String(index).padStart(3, "0")}`,
      email: `pagination_${source}_${index}@example.test`,
      phone: `+1555123${String(index).padStart(4, "0")}`,
      source,
      status: "lead",
      value: index,
      tags: ["pagination-regression"],
    });
  }

  await contactsService.createContact(secondary.clinicId, secondary.userId, {
    firstName: "Other",
    lastName: "Clinic",
    email: `pagination_${source}_other@example.test`,
    phone: "+15559990000",
    source,
    status: "lead",
  });

  const firstPage = await contactsService.listContacts(primary.clinicId, {
    source,
    page: 1,
    pageSize: 250,
    sortBy: "value",
    sortDir: "asc",
  });
  assert.equal(firstPage.pagination.total, totalContacts);
  assert.equal(firstPage.pagination.limit, 250);
  assert.equal(firstPage.pagination.totalPages, 2);
  assert.equal(firstPage.contacts.length, 250);

  const secondPage = await contactsService.listContacts(primary.clinicId, {
    source,
    page: 2,
    pageSize: 250,
    sortBy: "value",
    sortDir: "asc",
  });
  assert.equal(secondPage.pagination.page, 2);
  assert.equal(secondPage.contacts.length, 10);
  assert.equal(secondPage.contacts.some((contact) => contact.email === `pagination_${source}_259@example.test`), true);

  const exported = await contactsService.exportContactsCsv(primary.clinicId, {
    source,
    pageSize: 5000,
    sortBy: "value",
    sortDir: "asc",
  });
  const exportedRows = csvDataRows(exported);
  assert.equal(exportedRows.length, totalContacts);
  assert.equal(exported.includes(`pagination_${source}_259@example.test`), true);
  assert.equal(exported.includes(`pagination_${source}_other@example.test`), false);
});
