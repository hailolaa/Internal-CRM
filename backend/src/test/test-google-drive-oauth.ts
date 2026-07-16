import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { googleDriveOAuthService } from "../modules/client-accounts/google-drive-oauth.service.js";

test("Google Drive OAuth uses the registered callback and full Drive scope", () => {
  const original = {
    clientId: config.oauth.google.clientId,
    clientSecret: config.oauth.google.clientSecret,
    allowedDomains: [...config.oauth.google.allowedDomains],
    enabled: config.googleDrive.databaseOAuthEnabled,
  };

  try {
    (config as any).oauth.google.clientId = "test-client.apps.googleusercontent.com";
    (config as any).oauth.google.clientSecret = "test-secret";
    (config as any).oauth.google.allowedDomains = ["leapdigital.online"];
    (config as any).googleDrive.databaseOAuthEnabled = true;

    const authorizationUrl = new URL(
      googleDriveOAuthService.getAuthorizationUrl("clinic-id", "user-id"),
    );
    assert.equal(authorizationUrl.origin, "https://accounts.google.com");
    assert.equal(authorizationUrl.pathname, "/o/oauth2/v2/auth");
    assert.equal(
      authorizationUrl.searchParams.get("redirect_uri"),
      `${config.oauthCallbackBaseUrl.replace(/\/$/, "")}/oauth/google/callback`,
    );
    assert.equal(authorizationUrl.searchParams.get("access_type"), "offline");
    assert.equal(authorizationUrl.searchParams.get("prompt"), "consent");
    assert.equal(authorizationUrl.searchParams.get("hd"), "leapdigital.online");
    const scopes = authorizationUrl.searchParams.get("scope")?.split(" ") || [];
    assert.ok(scopes.includes("openid"));
    assert.ok(scopes.includes("email"));
    assert.ok(scopes.includes("https://www.googleapis.com/auth/drive"));

    const state = authorizationUrl.searchParams.get("state") || "";
    assert.equal(googleDriveOAuthService.isDriveOAuthState(state), true);
    const payload = jwt.verify(state, config.jwt.secret) as any;
    assert.equal(payload.purpose, "google_drive");
    assert.equal(payload.clinicId, "clinic-id");
    assert.equal(payload.userId, "user-id");
    const expiredDriveState = jwt.sign(
      { purpose: "google_drive", provider: "google", clinicId: "clinic-id", userId: "user-id" },
      config.jwt.secret,
      { expiresIn: -1 },
    );
    assert.equal(googleDriveOAuthService.isDriveOAuthState(expiredDriveState), true);
    assert.equal(googleDriveOAuthService.isDriveOAuthState("not-a-token"), false);
  } finally {
    (config as any).oauth.google.clientId = original.clientId;
    (config as any).oauth.google.clientSecret = original.clientSecret;
    (config as any).oauth.google.allowedDomains = original.allowedDomains;
    (config as any).googleDrive.databaseOAuthEnabled = original.enabled;
  }
});
