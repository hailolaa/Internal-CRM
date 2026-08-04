import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";

process.env.JWT_SECRET = "quickbooks-test-jwt-secret-with-more-than-32-characters";
process.env.API_PUBLIC_URL = "https://mission-control.test/api";
process.env.QUICKBOOKS_OAUTH_ENABLED = "true";
process.env.QUICKBOOKS_CLIENT_ID = "quickbooks-client-id";
process.env.QUICKBOOKS_CLIENT_SECRET = "quickbooks-client-secret";
process.env.QUICKBOOKS_ENVIRONMENT = "sandbox";
process.env.QUICKBOOKS_SCOPES = "com.intuit.quickbooks.accounting";
process.env.CREDENTIAL_ENCRYPTION_KEY = "quickbooks-test-credential-key-32-chars-plus";

test("QuickBooks OAuth URL is tenant scoped and requests accounting access", async () => {
  const { quickBooksService } = await import("../modules/quickbooks/quickbooks.service.js");
  const authorizeUrl = quickBooksService.getAuthorizationUrl("clinic-001", "user-001");
  const parsed = new URL(authorizeUrl);

  assert.equal(parsed.origin + parsed.pathname, "https://appcenter.intuit.com/connect/oauth2");
  assert.equal(parsed.searchParams.get("client_id"), "quickbooks-client-id");
  assert.equal(parsed.searchParams.get("response_type"), "code");
  assert.equal(parsed.searchParams.get("scope"), "com.intuit.quickbooks.accounting");
  assert.equal(parsed.searchParams.get("redirect_uri"), "https://mission-control.test/api/quickbooks/oauth/callback");

  const state = parsed.searchParams.get("state");
  assert.ok(state);
  const decoded = jwt.verify(state, process.env.JWT_SECRET!) as any;
  assert.equal(decoded.purpose, "quickbooks");
  assert.equal(decoded.provider, "quickbooks");
  assert.equal(decoded.clinicId, "clinic-001");
  assert.equal(decoded.userId, "user-001");
});
