#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const includeBuildOutput = args.has("--include-build-output");
const frontendRoot = process.cwd();
const repoRoot = resolveRoot();
const frontendPrefix = normalise(path.relative(repoRoot, frontendRoot));

const allowedPublicEnv = new Set([
  "NEXT_PUBLIC_API_BASE_URL",
  "NEXT_PUBLIC_APP_URL",
  "NEXT_PUBLIC_LOGO_URL",
  "NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY",
  "NEXT_PUBLIC_OBSERVABILITY_CLIENT_ENDPOINT",
  "NEXT_PUBLIC_OBSERVABILITY_SERVICE_NAME",
  "NEXT_PUBLIC_RELEASE_ID",
  "NEXT_PUBLIC_RELEASE_PRODUCT",
  "NEXT_PUBLIC_RELEASE_ENVIRONMENT",
  "NEXT_PUBLIC_RELEASE_CREATED_AT",
  "NEXT_PUBLIC_RELEASE_COMMIT_SHA",
  "NEXT_PUBLIC_RELEASE_BRANCH",
  "NEXT_PUBLIC_MISSION_CONTROL_REVISION",
  "NEXT_PUBLIC_CLINIC_OS_BACKEND_REVISION",
  "NEXT_PUBLIC_CLINIC_OS_FRONTEND_REVISION",
  "NEXT_PUBLIC_RELEASE_DEPLOYMENT_VERIFICATION_STATE",
  "NEXT_PUBLIC_RELEASE_DEPLOYED_REVISION",
  "NEXT_PUBLIC_RELEASE_DEPLOYMENT_VERIFIED_AT",
]);

const forbiddenPublicNamePattern =
  /^NEXT_PUBLIC_.*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CLIENT_SECRET|DATABASE|DB_|WEBHOOK_SECRET|SIGNING_KEY)$/;
const privateEnvReadPattern =
  /\bprocess\.env\.(?:DB_PASSWORD|JWT_SECRET|CREDENTIAL_ENCRYPTION_KEY|OPENAI_API_KEY|TWILIO_AUTH_TOKEN|CLICKUP_API_TOKEN|CLICKUP_CLIENT_SECRET|STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|RELEASE_MANIFEST_SIGNING_KEY|PROMOTION_DEPLOY_WEBHOOK_URL)\b/g;
const publicNamePattern = /\bNEXT_PUBLIC_[A-Z0-9_]+\b/g;
const tokenPattern = /\b(?:sk|rk|whsec|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{12,}\b|\bpk_(?!test_|test\b)[A-Za-z0-9_-]{20,}\b/g;
const placeholderPattern = /(placeholder|example|sample|dummy|fake|redacted|\.\.\.|sk_live_secret|pk_test_\.\.\.)/i;

function normalise(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function shouldSkip(relativePath) {
  const normalized = normalise(relativePath);
  const parts = normalized.split("/");
  const name = parts[parts.length - 1] || "";
  if (normalized === "scripts/scan-public-env.mjs") return true;
  if (parts.some((part) => [".git", ".tmp", "tmp", "node_modules", "coverage"].includes(part))) return true;
  if ([".github", "docs", "scripts"].includes(parts[0] || "")) return true;
  if (/\.(test|spec)\.[jt]sx?$/.test(name)) return true;
  if (["package-lock.json", "yarn.lock", "pnpm-lock.yaml"].includes(name)) return true;
  if (/^\.env($|\.)/.test(name) && !name.endsWith(".example")) return true;
  return false;
}

function resolveRoot() {
  try {
    return execFileSync("git", ["rev-parse", "--show-toplevel"], {
      cwd: frontendRoot,
      encoding: "utf8",
    }).trim();
  } catch {
    let current = frontendRoot;
    while (current && current !== path.dirname(current)) {
      if (existsSync(path.join(current, ".git"))) return current;
      current = path.dirname(current);
    }
    return frontendRoot;
  }
}

function trackedFiles() {
  const prefix = frontendPrefix ? `${frontendPrefix}/` : "";
  try {
    const output = execFileSync("git", ["ls-files", "-z"], {
      cwd: repoRoot,
      encoding: "buffer",
    });
    return output
      .toString("utf8")
      .split("\0")
      .filter(Boolean)
      .filter((file) => !prefix || file.startsWith(prefix))
      .map((file) => (prefix ? file.slice(prefix.length) : file))
      .filter((file) => !shouldSkip(file));
  } catch {
    return walkBuildDir(".", []);
  }
}

function walkBuildDir(relativeDir, files = []) {
  const absoluteDir = path.join(frontendRoot, relativeDir);
  if (!existsSync(absoluteDir)) return files;
  for (const entry of readdirSync(absoluteDir)) {
    const relativeEntry = normalise(path.join(relativeDir, entry));
    if (shouldSkip(relativeEntry)) continue;
    const absoluteEntry = path.join(frontendRoot, relativeEntry);
    const stat = statSync(absoluteEntry);
    if (stat.isDirectory()) walkBuildDir(relativeEntry, files);
    else if (stat.isFile() && stat.size <= 2 * 1024 * 1024) files.push(relativeEntry);
  }
  return files;
}

function filesToScan() {
  const files = new Set(trackedFiles());
  if (includeBuildOutput) {
    for (const file of walkBuildDir(".next/static")) files.add(file);
    for (const file of walkBuildDir(".next/dev/static")) files.add(file);
    for (const file of walkBuildDir("out")) files.add(file);
  }
  return Array.from(files).sort();
}

function lineFor(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function readTextFile(relativeFile) {
  const absoluteFile = path.join(frontendRoot, relativeFile);
  const buffer = readFileSync(absoluteFile);
  if (buffer.includes(0)) return null;
  return buffer.toString("utf8");
}

const failures = [];

for (const relativeFile of filesToScan()) {
  const content = readTextFile(relativeFile);
  if (!content) continue;

  for (const match of content.matchAll(publicNamePattern)) {
    const name = match[0];
    if (!allowedPublicEnv.has(name) || forbiddenPublicNamePattern.test(name)) {
      failures.push(`${normalise(relativeFile)}:${lineFor(content, match.index || 0)} unsupported public env ${name}`);
    }
  }

  for (const match of content.matchAll(privateEnvReadPattern)) {
    failures.push(`${normalise(relativeFile)}:${lineFor(content, match.index || 0)} private env read in frontend bundle`);
  }

  for (const match of content.matchAll(tokenPattern)) {
    if (placeholderPattern.test(match[0])) continue;
    failures.push(`${normalise(relativeFile)}:${lineFor(content, match.index || 0)} token-like value in frontend bundle`);
  }
}

if (failures.length > 0) {
  console.error("Public env guard failed. Values are intentionally not printed.");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log("Public env guard passed.");
