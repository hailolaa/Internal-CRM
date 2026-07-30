import assert from "node:assert/strict";
import test from "node:test";
import { validationResult } from "express-validator";
import {
  exportContactsValidator,
  listContactsValidator,
} from "../modules/contacts/contacts.validators.js";
import {
  exportProposalsValidator,
  listProposalsValidator,
} from "../modules/proposals/proposals.validators.js";

async function validationErrors(validators: any[], query: Record<string, string>) {
  const request = { query } as any;
  await Promise.all(validators.map((validator) => validator.run(request)));
  return validationResult(request).array();
}

test("CSV export validators accept the 5,000-row export limit", async () => {
  assert.deepEqual(await validationErrors(exportContactsValidator, { pageSize: "5000" }), []);
  assert.deepEqual(await validationErrors(exportProposalsValidator, { limit: "5000" }), []);
});

test("normal list validators retain the 250-row limit", async () => {
  assert.notDeepEqual(await validationErrors(listContactsValidator, { pageSize: "5000" }), []);
  assert.notDeepEqual(await validationErrors(listProposalsValidator, { limit: "5000" }), []);
});

test("CSV export validators reject limits above the export ceiling", async () => {
  assert.notDeepEqual(await validationErrors(exportContactsValidator, { pageSize: "5001" }), []);
  assert.notDeepEqual(await validationErrors(exportProposalsValidator, { limit: "5001" }), []);
});
