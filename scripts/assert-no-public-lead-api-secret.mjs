#!/usr/bin/env node
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const root = process.cwd();
const ignoredDirs = new Set([
  ".git",
  ".next",
  "dist",
  "node_modules",
  "tmp",
]);
const ignoredFiles = new Set([
  "package-lock.json",
]);

const forbiddenPatterns = [
  {
    pattern: /\bcg_live_[A-Za-z0-9_-]{20,}\b/g,
    message: "Raw Mission Control API key detected",
  },
  {
    pattern: /\bNEXT_PUBLIC_MISSION_CONTROL_LEAD_API_KEY\b/g,
    message: "Landing-page lead API key must not use a browser-public env var",
  },
];

const allowedMatches = new Map([
  ["backend/src/modules/api-keys/api-keys.service.ts", ["cg_live_"]],
  ["docs/landing-page-lead-capture-api.md", ["NEXT_PUBLIC_MISSION_CONTROL_LEAD_API_KEY"]],
  ["scripts/assert-no-public-lead-api-secret.mjs", ["NEXT_PUBLIC_MISSION_CONTROL_LEAD_API_KEY"]],
]);

function normalisePath(path) {
  return path.replace(/\\/g, "/");
}

function shouldSkip(path) {
  const name = path.split(/[\\/]/).pop();
  if (name?.startsWith(".env")) return true;
  if (name && ignoredFiles.has(name)) return true;
  return path.split(/[\\/]/).some((part) => ignoredDirs.has(part));
}

function walk(dir, files = []) {
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (shouldSkip(fullPath)) continue;
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      walk(fullPath, files);
    } else if (stat.isFile()) {
      files.push(fullPath);
    }
  }
  return files;
}

const failures = [];

for (const file of walk(root)) {
  const rel = normalisePath(relative(root, file));
  const allowed = allowedMatches.get(rel) || [];
  const content = readFileSync(file, "utf8");

  for (const check of forbiddenPatterns) {
    for (const match of content.matchAll(check.pattern)) {
      if (allowed.some((value) => match[0].includes(value))) continue;
      failures.push(`${rel}: ${check.message}`);
    }
  }
}

if (failures.length > 0) {
  console.error("Lead API secret exposure check failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Lead API secret exposure check passed.");
