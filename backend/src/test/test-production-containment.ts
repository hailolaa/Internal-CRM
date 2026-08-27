import assert from "node:assert/strict";
import test from "node:test";
import { getContainedProductionAction } from "../middleware/productionContainment.js";

test("production containment covers Gate 2 unsafe actions", () => {
  for (const [method, path] of [
    ["POST", "/api/proposals/proposal-id/send"],
    ["POST", "/api/team/invite"],
    ["POST", "/api/billing/checkout"],
    ["POST", "/api/deposits/session"],
    ["POST", "/api/sequences/run-due"],
    ["PATCH", "/api/pipeline/stages/stage-id"],
    ["DELETE", "/api/pipeline/stages/stage-id"],
    ["POST", "/api/automations"],
    ["PATCH", "/api/forms/form-id"],
    ["POST", "/api/comms/inbox/contact-id/messages"],
    ["POST", "/api/comms/whatsapp/conversations/contact-id/messages"],
    ["POST", "/api/contacts/contact-id/actions/message-template"],
    ["POST", "/api/message-templates/template-id/test-send"],
  ] as const) {
    assert.ok(getContainedProductionAction(method, path), `${method} ${path} must be contained`);
  }
});

test("production containment leaves read and inbound webhook routes available", () => {
  for (const [method, path] of [
    ["GET", "/api/pipeline/stages"],
    ["GET", "/api/forms"],
    ["POST", "/api/billing/webhook"],
    ["POST", "/api/team/invite/accept"],
    ["POST", "/api/comms/whatsapp/inbound"],
  ] as const) {
    assert.equal(getContainedProductionAction(method, path), null, `${method} ${path} must remain available`);
  }
});
