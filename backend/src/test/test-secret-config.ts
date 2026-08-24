import assert from "node:assert/strict";
import test from "node:test";
import {
  getConfiguredJwtSecret,
  getMissionControlDomainIssues,
  getSecretConfigurationIssues,
} from "../config/index.js";

const strong = "strong-secret-material-with-more-than-32-characters";

test("secret config fails closed for missing non-local required secrets", () => {
  const issues = getSecretConfigurationIssues({
    NODE_ENV: "production",
  });

  assert.ok(issues.some((issue) => issue.includes("JWT_SECRET")));
  assert.ok(issues.some((issue) => issue.includes("DB_PASSWORD")));
  assert.ok(issues.some((issue) => issue.includes("CREDENTIAL_ENCRYPTION_KEY")));
  assert.ok(issues.some((issue) => issue.includes("CLINICGROWER_EVENT_SIGNING_SECRET")));
});

test("secret config rejects placeholder and reused secrets without printing values", () => {
  const issues = getSecretConfigurationIssues({
    NODE_ENV: "production",
    JWT_SECRET: "changeme",
    DB_PASSWORD: "password",
    BACKUP_ENCRYPTION_KEY: strong,
    CREDENTIAL_ENCRYPTION_KEY: "changeme",
    CLINICGROWER_EVENT_SIGNING_SECRET: strong,
    OBSERVABILITY_ALERT_WEBHOOK_URL: "https://alerts.example.test/webhook",
    OBSERVABILITY_ALERT_WEBHOOK_TOKEN: "placeholder",
  });

  const serialized = JSON.stringify(issues);
  assert.match(serialized, /JWT_SECRET/);
  assert.match(serialized, /DB_PASSWORD/);
  assert.match(serialized, /CREDENTIAL_ENCRYPTION_KEY/);
  assert.match(serialized, /OBSERVABILITY_ALERT_WEBHOOK_TOKEN/);
  assert.equal(serialized.includes("changeme"), false);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("placeholder"), false);
});

test("secret config permits explicit test-only JWT fixture only in test environment", () => {
  assert.equal(getConfiguredJwtSecret({ NODE_ENV: "development" }), "");
  assert.ok(getConfiguredJwtSecret({ NODE_ENV: "test" }).length >= 32);

  const issues = getSecretConfigurationIssues({
    NODE_ENV: "test",
  });
  assert.equal(issues.some((issue) => issue.includes("JWT_SECRET")), false);
});

test("secret config accepts strong non-local configuration", () => {
  const issues = getSecretConfigurationIssues({
    NODE_ENV: "production",
    JWT_SECRET: `${strong}-jwt`,
    DB_PASSWORD: `${strong}-db`,
    BACKUP_ENCRYPTION_KEY: `${strong}-backup`,
    CREDENTIAL_ENCRYPTION_KEY: `${strong}-credentials`,
    CLINICGROWER_EVENT_SIGNING_SECRET: `${strong}-event-signing`,
  });

  assert.deepEqual(issues, []);
});

test("mission control domain config rejects clinic-facing production hosts", () => {
  const issues = getMissionControlDomainIssues({
    frontendUrl: "https://clinicgrower.ai",
    apiPublicUrl: "https://crm.clinicgrower.co.uk/api",
    oauthCallbackBaseUrl: "https://clinicgrower.co.uk/api/auth",
    corsOrigins: ["https://www.clinicgrower.ai"],
  });

  assert.ok(issues.some((issue) => issue.includes("FRONTEND_URL")));
  assert.ok(issues.some((issue) => issue.includes("API_PUBLIC_URL")));
  assert.ok(issues.some((issue) => issue.includes("OAUTH_CALLBACK_BASE_URL")));
  assert.ok(issues.some((issue) => issue.includes("CORS_ORIGINS")));
});

test("mission control domain config accepts mission-control hosts", () => {
  const issues = getMissionControlDomainIssues({
    frontendUrl: "https://mission-control.thegrowthgroup.com",
    apiPublicUrl: "https://api-mission-control.thegrowthgroup.com/api",
    oauthCallbackBaseUrl: "https://api-mission-control.thegrowthgroup.com/api/auth",
    corsOrigins: ["https://mission-control.thegrowthgroup.com"],
  });

  assert.deepEqual(issues, []);
});
