import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const routes = read("src/modules/contacts/contacts.routes.ts");
const controller = read("src/modules/contacts/contacts.controller.ts");
const service = read("src/modules/contacts/contacts.service.ts");
const types = read("src/modules/contacts/contacts.types.ts");

assert.match(routes, /\/:id\/activity/);
assert.match(routes, /authorizePermission\("contacts:read"\)/);
assert.match(routes, /contactsController\.getContactLinkedActivity/);

assert.match(controller, /getContactLinkedActivity/);
assert.match(service, /getContactLinkedActivity/);
assert.match(service, /listLinkedCalls/);
assert.match(service, /listLinkedAppointments/);
assert.match(service, /listLinkedForms/);
assert.match(service, /listLinkedMessages/);
assert.match(service, /FROM \\` call \\`/);
assert.match(service, /FROM appointment/);
assert.match(service, /FROM form_submission/);
assert.match(service, /FROM email/);
assert.match(service, /FROM sms/);
assert.match(service, /clinic_id = \?/);
assert.match(service, /contact_id = \?/);

assert.match(types, /ContactLinkedActivityResponse/);
assert.match(types, /calls: ContactLinkedCall\[\]/);
assert.match(types, /appointments: ContactLinkedAppointment\[\]/);
assert.match(types, /forms: ContactLinkedFormSubmission\[\]/);
assert.match(types, /messages: ContactLinkedMessage\[\]/);

console.log("[contact-linked-activity] route and grouped activity contract smoke test passed");
