import assert from "node:assert/strict";
import test from "node:test";
import { hasUsableLeadIdentity } from "../modules/contacts/contacts.normalizers.js";

test("manual leads require a name and contact method", () => {
  assert.equal(hasUsableLeadIdentity({ accountName: "Smile Clinic", email: "hello@example.com" }), true);
  assert.equal(hasUsableLeadIdentity({ firstName: "Alex", phone: "07700 900123" }), true);
  assert.equal(hasUsableLeadIdentity({ accountName: "Smile Clinic" }), false);
  assert.equal(hasUsableLeadIdentity({ accountName: "Smile Clinic", website: "smile.example" }), false);
  assert.equal(hasUsableLeadIdentity({ email: "hello@example.com" }), false);
  assert.equal(hasUsableLeadIdentity({}), false);
});
