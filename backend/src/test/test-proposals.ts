import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(path: string) {
  return readFileSync(join(root, path), "utf8");
}

const migration = read("scripts/migrations/20260720_add_internal_proposal_statuses.sql");
const routes = read("src/modules/proposals/proposals.routes.ts");
const service = read("src/modules/proposals/proposals.service.ts");
const types = read("src/modules/proposals/proposals.types.ts");
const app = read("src/app.ts");
const activity = read("src/utils/activity.ts");
const commandPalette = read("src/modules/command-palette/command-palette.service.ts");

for (const status of ["draft", "ready", "sent", "viewed", "follow_up_due", "accepted", "won", "lost", "expired"]) {
  assert.match(types, new RegExp(`"${status}"`), `Proposal status ${status} must be in the TypeScript contract`);
  assert.match(migration, new RegExp(`'${status}'`), `Proposal status ${status} must be in the migration enum`);
}

assert.match(migration, /CREATE TABLE `proposal`/);
assert.match(migration, /`contact_id`/);
assert.match(migration, /`deal_id`/);
assert.match(migration, /`client_account_profile_id`/);
assert.match(migration, /`owner_id`/);
assert.match(migration, /`follow_up_at`/);
assert.match(migration, /proposals:read/);
assert.match(migration, /proposals:write/);

assert.match(routes, /router\.get\(/);
assert.match(routes, /router\.post\(/);
assert.match(routes, /router\.patch\(/);
assert.match(routes, /authorizeAnyPermission\("proposals:read"/);
assert.match(routes, /authorizeAnyPermission\("proposals:write"/);

assert.match(app, /proposalsRoutes/);
assert.match(app, /app\.use\("\/api\/proposals", proposalsRoutes\)/);

assert.match(service, /resolveProposalLinks/);
assert.match(service, /proposal_created/);
assert.match(service, /proposal_status_changed/);
assert.match(service, /logTimelineActivity/);
assert.match(service, /source: "proposal"/);
assert.match(service, /Client account is not available to this workspace/);
assert.match(service, /followUpAt is required when proposal status is follow_up_due/);

assert.match(activity, /"proposal"/);
assert.match(commandPalette, /FROM proposal p/);

console.log("[proposals] MC-031 proposal schema, routes, permissions, timeline and search contract passed");
