import fs from "node:fs/promises";
import process from "node:process";

const args = parseArgs(process.argv.slice(2));
const manifestPath = args.manifest || "release/current-release.json";
const environment = args.environment;
const deployUrl = process.env.PROMOTION_DEPLOY_WEBHOOK_URL || "";
const deployToken = process.env.PROMOTION_DEPLOY_WEBHOOK_TOKEN || "";

if (!environment || !["staging", "production"].includes(environment)) {
  fail("--environment must be staging or production");
}

if (!deployUrl) {
  fail("External dependency missing: PROMOTION_DEPLOY_WEBHOOK_URL is required for release promotion");
}

const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
if (manifest.environment !== environment) {
  fail(`Manifest environment ${manifest.environment} does not match requested environment ${environment}`);
}
if (!manifest.signature?.value) {
  fail("Signed release manifest is required for promotion");
}

const response = await fetch(deployUrl, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(deployToken ? { authorization: `Bearer ${deployToken}` } : {}),
  },
  body: JSON.stringify({
    environment,
    releaseId: manifest.releaseId,
    missionControlRevision: manifest.repository?.revision,
    pairedRevisions: manifest.pairedRevisions,
    manifest,
  }),
});

const text = await response.text();
if (!response.ok) {
  fail(`Deployment webhook failed with ${response.status}: ${text}`);
}

console.log(`Release promotion accepted: ${manifest.releaseId}`);
if (text) console.log(text);

function parseArgs(items) {
  const parsed = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
    const next = items[index + 1];
    if (!next || next.startsWith("--")) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
