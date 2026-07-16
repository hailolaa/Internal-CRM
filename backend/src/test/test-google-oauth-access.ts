import assert from "node:assert/strict";
import test from "node:test";
import { decideGoogleOAuthAccess } from "../modules/auth/google-oauth-access.js";

test("auto-provisions an uninvited account from the allowed Google Workspace", () => {
  assert.equal(
    decideGoogleOAuthAccess("Accounts@LeapDigital.Online", false, ["leapdigital.online"]),
    "auto_provision",
  );
});

test("allows an existing account from the allowed Google Workspace", () => {
  assert.equal(
    decideGoogleOAuthAccess("accounts@leapdigital.online", true, ["leapdigital.online"]),
    "existing",
  );
});

test("rejects another domain even when a CRM account already exists", () => {
  assert.equal(
    decideGoogleOAuthAccess("admin@thegrowthgroup.com", true, ["leapdigital.online"]),
    "reject",
  );
});

test("rejects Gmail and subdomains of the allowed Workspace", () => {
  assert.equal(
    decideGoogleOAuthAccess("person@gmail.com", false, ["leapdigital.online"]),
    "reject",
  );
  assert.equal(
    decideGoogleOAuthAccess("person@team.leapdigital.online", false, ["leapdigital.online"]),
    "reject",
  );
});

test("preserves invitation-only behavior when no Workspace allowlist is configured", () => {
  assert.equal(decideGoogleOAuthAccess("invited@example.com", true, []), "existing");
  assert.equal(decideGoogleOAuthAccess("new@example.com", false, []), "reject");
});
