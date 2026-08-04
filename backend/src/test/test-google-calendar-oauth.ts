import assert from "node:assert/strict";
import test from "node:test";
import jwt from "jsonwebtoken";
import { config } from "../config/index.js";
import { calendarService } from "../modules/calendar/calendar.service.js";

test("Google Calendar OAuth uses the registered callback and read-only Calendar scope", () => {
  const original = {
    clientId: config.oauth.google.clientId,
    clientSecret: config.oauth.google.clientSecret,
    allowedDomains: [...config.oauth.google.allowedDomains],
    enabled: config.googleCalendar.oauthEnabled,
    scopes: [...config.googleCalendar.scopes],
  };

  try {
    (config as any).oauth.google.clientId = "test-client.apps.googleusercontent.com";
    (config as any).oauth.google.clientSecret = "test-secret";
    (config as any).oauth.google.allowedDomains = ["leapdigital.online"];
    (config as any).googleCalendar.oauthEnabled = true;
    (config as any).googleCalendar.scopes = ["https://www.googleapis.com/auth/calendar.readonly"];

    const authorizationUrl = new URL(
      calendarService.getAuthorizationUrl("clinic-id", "user-id"),
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
    assert.ok(scopes.includes("https://www.googleapis.com/auth/calendar.readonly"));

    const state = authorizationUrl.searchParams.get("state") || "";
    assert.equal(calendarService.isCalendarOAuthState(state), true);
    const payload = jwt.verify(state, config.jwt.secret) as any;
    assert.equal(payload.purpose, "google_calendar");
    assert.equal(payload.clinicId, "clinic-id");
    assert.equal(payload.userId, "user-id");
    assert.equal(calendarService.isCalendarOAuthState("not-a-token"), false);
  } finally {
    (config as any).oauth.google.clientId = original.clientId;
    (config as any).oauth.google.clientSecret = original.clientSecret;
    (config as any).oauth.google.allowedDomains = original.allowedDomains;
    (config as any).googleCalendar.oauthEnabled = original.enabled;
    (config as any).googleCalendar.scopes = original.scopes;
  }
});
