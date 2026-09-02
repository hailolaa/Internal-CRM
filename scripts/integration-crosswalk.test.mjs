import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const crosswalk = readFileSync(
  new URL("../docs/mission-control-integration-requirement-crosswalk.md", import.meta.url),
  "utf8",
);

const governedTaskIds = [
  "869er9bne",
  "869efapy1",
  "869egfgtp",
  "869efatbn",
  "869emyqnp",
  "869emyqnw",
  "869eeeq2b",
  "869eeeq2j",
  "869eamkyc",
  "869ehypp3",
];

const retainedLifecycleRequirements = [
  "OAuth or secure authentication flow",
  "Server-side encrypted credential storage",
  "Token refresh mechanism",
  "Reauthorisation after token expiry/revocation",
  "Scheduled data ingestion pipeline",
  "Historical backfill",
  "Data freshness monitoring",
  "Account and client matching",
  "API failures, rate limits and partial data",
  "Connection-health dashboard indicator",
  "Missing-data warnings",
  "Real client account testing",
  "Synthetic/placeholder data removal before pilot",
  "End-to-end test and rollback requirement per integration",
];

const sources = [
  "GA4",
  "Google Ads",
  "Google Search Console",
  "Google Business Profile",
  "Meta Ads / Lead Forms",
  "Clinic CRM / booking",
  "Twilio / call tracking",
  "QuickBooks",
];

function extractRows(sectionStart, sectionEnd) {
  const section = crosswalk.split(sectionStart)[1].split(sectionEnd)[0];
  return section
    .split(/\r?\n/)
    .filter((line) => line.startsWith("| "))
    .filter((line) => !line.includes("---"))
    .slice(1)
    .map((line) =>
      line
        .slice(1, -1)
        .split("|")
        .map((cell) => cell.trim()),
    );
}

test("integration crosswalk lists governed tasks and rejects legacy build authority", () => {
  for (const taskId of governedTaskIds) {
    assert.match(crosswalk, new RegExp(`\`${taskId}\``), `${taskId} must be traceable`);
  }

  assert.match(crosswalk, /Legacy task `869efyy2r` is not ongoing build authority/);
  assert.match(crosswalk, /does not approve provider activation/);
  assert.match(crosswalk, /Credentials, tokens, recovery codes, raw provider payloads and secrets must\s+not be stored/);
});

test("every retained integration lifecycle requirement has a mapped destination or data gap", () => {
  const rows = extractRows("## Retained Lifecycle Requirement Mapping", "## Source Coverage");
  const requirements = rows.map(([requirement]) => requirement);

  assert.equal(rows.length, retainedLifecycleRequirements.length);
  assert.deepEqual(requirements, retainedLifecycleRequirements);
  assert.equal(new Set(requirements).size, requirements.length, "requirements must not be duplicated");

  for (const row of rows) {
    const [requirement, destination, implementation, status, dependency] = row;

    assert.ok(destination, `${requirement} must have a governed destination`);
    assert.ok(implementation, `${requirement} must name implementation or evidence`);
    assert.ok(status, `${requirement} must define status`);
    assert.ok(dependency, `${requirement} must name remaining dependency or none`);
    assert.doesNotMatch(destination, /869efyy2r/, `${requirement} must not map back to the legacy wrapper`);
  }
});

test("every required source has a governed route and acceptance state", () => {
  const rows = extractRows("## Source Coverage", "## DATA GAP Register");
  const sourceNames = rows.map(([source]) => source);

  assert.deepEqual(sourceNames, sources);
  assert.equal(new Set(sourceNames).size, sourceNames.length, "sources must not be duplicated");

  for (const row of rows) {
    const [source, destination, owner, evidence, state] = row;

    assert.ok(destination, `${source} must have a governed destination`);
    assert.ok(owner, `${source} must define system/provider owner`);
    assert.ok(evidence, `${source} must name current evidence`);
    assert.ok(state, `${source} must define acceptance state`);
    assert.doesNotMatch(destination, /869efyy2r/, `${source} must not use the legacy wrapper as destination`);
  }
});

test("data gaps, closure gates and review controls are explicit", () => {
  for (const expected of [
    "Source-specific OAuth, scope and refresh acceptance tasks",
    "90-day historical backfill proof from real pilot accounts",
    "Real-account freshness and missing-data warning evidence",
    "E2E failure, retry and rollback proof per provider",
    "Provider credential owner and approved storage evidence",
    "Synthetic/placeholder removal proof before pilot",
  ]) {
    assert.match(crosswalk, new RegExp(expected));
  }

  assert.match(crosswalk, /The legacy wrapper can be closed only after/);
  assert.match(crosswalk, /No active requirement still uses `869efyy2r` as build authority/);
  assert.match(crosswalk, /Max approves any paid provider, production credential or system-of-record\s+change/);
});

test("crosswalk does not contain secret-looking material", () => {
  assert.doesNotMatch(crosswalk, /sk_live|sk_test|xox[baprs]-|ghp_|AIza|-----BEGIN PRIVATE KEY-----/);
  assert.doesNotMatch(crosswalk, /password\s*[:=]\s*[^`\s]/i);
  assert.doesNotMatch(crosswalk, /token\s*[:=]\s*[^`\s]/i);
});
