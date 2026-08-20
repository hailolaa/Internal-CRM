#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const args = new Set(process.argv.slice(2));
const includeBuildOutput = args.has("--include-build-output");
const maxBytes = 2 * 1024 * 1024;

const root = process.cwd();

const ignoredPathParts = new Set([
  ".git",
  ".tmp",
  "tmp",
  "node_modules",
  "coverage",
]);
const buildPathParts = new Set([".next", "dist", "build", "out"]);

const ignoredFilenames = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
]);

const placeholderPattern =
  /(placeholder|example|sample|dummy|fake|changeme|change-me|replace-me|redacted|\.\.\.|your[_-]?|not-for-production|test-only|test[_-]?secret|[_-]test[_-]|access[-_]?token|refresh[-_]?token|client[-_]?secret|strong-secret-material|\$\{strong\}|sk_live_secret|sk_test_\.\.\.|pk_test_\.\.\.)/i;

const checks = [
  {
    name: "provider token",
    pattern: /\b(?:sk|rk|whsec|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{12,}\b/g,
  },
  {
    name: "ClickUp token",
    pattern: /\bpk_(?!test_|test\b)[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    name: "bearer token",
    pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]{24,}\b/gi,
  },
  {
    name: "private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----[\s\S]{20,}?-----END (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
  },
  {
    name: "secret assignment",
    pattern: /\b[A-Z0-9_]*(?:SECRET|TOKEN|PASSWORD|PRIVATE_KEY|CLIENT_SECRET|API_KEY)[A-Z0-9_]*\s*[:=]\s*["'`]([^"'`\r\n]{16,})["'`]/g,
  },
  {
    name: "JWT value",
    pattern: /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\b/g,
  },
];

function normalise(relativePath) {
  return relativePath.replace(/\\/g, "/");
}

function shouldSkip(relativePath, options = {}) {
  const normalized = normalise(relativePath);
  const parts = normalized.split("/");
  const name = parts[parts.length - 1] || "";
  if (ignoredFilenames.has(name)) return true;
  if (parts.some((part) => ignoredPathParts.has(part))) return true;
  if (!options.allowBuildOutput && parts.some((part) => buildPathParts.has(part))) return true;
  if (/^\.env($|\.)/.test(name) && !name.endsWith(".example")) return true;
  return false;
}

function isProbablyBinary(buffer) {
  if (buffer.includes(0)) return true;
  const sample = buffer.subarray(0, Math.min(buffer.length, 512));
  let control = 0;
  for (const byte of sample) {
    if (byte < 9 || (byte > 13 && byte < 32)) control += 1;
  }
  return control > sample.length * 0.1;
}

function walkDir(relativeDir, files = [], options = {}) {
  const absoluteDir = path.join(root, relativeDir);
  if (!existsSync(absoluteDir)) return files;
  for (const entry of readdirSync(absoluteDir)) {
    const relativeEntry = normalise(path.join(relativeDir, entry));
    if (shouldSkip(relativeEntry, options)) continue;
    const absoluteEntry = path.join(root, relativeEntry);
    const stat = statSync(absoluteEntry);
    if (stat.isDirectory()) walkDir(relativeEntry, files, options);
    else if (stat.isFile()) files.push(relativeEntry);
  }
  return files;
}

function filesToScan() {
  const files = new Set(walkDir("."));
  if (includeBuildOutput) {
    for (const dir of [".next/static", ".next/server", "dist", "build", "out"]) {
      for (const file of walkDir(dir, [], { allowBuildOutput: true })) files.add(file);
    }
  }
  return Array.from(files).sort();
}

function isBuildOutput(relativeFile) {
  return normalise(relativeFile).split("/").some((part) => buildPathParts.has(part));
}

function lineFor(content, index) {
  return content.slice(0, index).split(/\r?\n/).length;
}

function isAllowedMatch(matchText) {
  const value = String(matchText || "").trim();
  if (value.startsWith("/")) return true;
  return placeholderPattern.test(value);
}

const findings = [];

for (const relativeFile of filesToScan()) {
  const absoluteFile = path.join(root, relativeFile);
  const stat = statSync(absoluteFile);
  if (stat.size > maxBytes) continue;
  const buffer = readFileSync(absoluteFile);
  if (isProbablyBinary(buffer)) continue;
  const content = buffer.toString("utf8");
  const activeChecks = isBuildOutput(relativeFile)
    ? checks.filter((check) => check.name !== "secret assignment")
    : checks;

  for (const check of activeChecks) {
    for (const match of content.matchAll(check.pattern)) {
      const matchText = match[1] || match[0];
      if (isAllowedMatch(matchText)) continue;
      findings.push({
        file: normalise(relativeFile),
        line: lineFor(content, match.index || 0),
        check: check.name,
      });
    }
  }
}

if (findings.length > 0) {
  console.error("Secret scan failed. Values are intentionally not printed.");
  for (const finding of findings) {
    console.error(`- ${finding.file}:${finding.line} ${finding.check}`);
  }
  process.exit(1);
}

console.log("Secret scan passed.");
