import assert from "node:assert/strict";
import test from "node:test";
import {
  hasUsableLeadIdentity,
  normalizeAccountNameForMatch,
  normalizeContactData,
  normalizeWebsiteDomain,
} from "../modules/contacts/contacts.normalizers.js";

test("manual leads require a name and contact method", () => {
  assert.equal(hasUsableLeadIdentity({ accountName: "Smile Clinic", email: "hello@example.com" }), true);
  assert.equal(hasUsableLeadIdentity({ firstName: "Alex", phone: "07700 900123" }), true);
  assert.equal(hasUsableLeadIdentity({ accountName: "Smile Clinic" }), false);
  assert.equal(hasUsableLeadIdentity({ accountName: "Smile Clinic", website: "smile.example" }), false);
  assert.equal(hasUsableLeadIdentity({ email: "hello@example.com" }), false);
  assert.equal(hasUsableLeadIdentity({}), false);
});

test("contact role and communication permissions are normalized", () => {
  const contact = normalizeContactData({
    role: "  Practice Owner  ",
    communicationPermissions: { email: true, whatsapp: true },
  });

  assert.equal(contact.role, "Practice Owner");
  assert.deepEqual(contact.communicationPermissions, {
    email: true,
    sms: false,
    whatsapp: true,
    phone: false,
  });
  assert.equal(contact.unsubscribed, false);
  assert.equal(contact.doNotContact, false);
});

test("duplicate matching normalizes website domains and account names", () => {
  assert.equal(normalizeWebsiteDomain("https://www.example.com/pricing?utm=1"), "example.com");
  assert.equal(normalizeWebsiteDomain("example.com/contact"), "example.com");
  assert.equal(normalizeWebsiteDomain("WWW.EXAMPLE.CO.UK"), "example.co.uk");

  assert.equal(normalizeAccountNameForMatch("The Growth Clinic Ltd."), "the growth");
  assert.equal(normalizeAccountNameForMatch("Growth & Partners Practice"), "growth and partners");
});
