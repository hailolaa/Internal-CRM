import "dotenv/config";
import crypto from "node:crypto";
import process from "node:process";
import mysql from "mysql2/promise";

const currentPrefix = "enc:cred";
const legacyPrefix = "enc:v1";
const currentKey = process.env.CREDENTIAL_ENCRYPTION_KEY || "";
const currentVersion = process.env.CREDENTIAL_ENCRYPTION_KEY_VERSION || "v1";
const previousKeys = parseJsonRecord(process.env.CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS || "");
const legacyJwtSecret = process.env.CREDENTIAL_ENCRYPTION_LEGACY_JWT_SECRET || "";
const jwtSecret = process.env.JWT_SECRET || "";
const apply = process.env.APPLY === "true";

const sensitiveFields = [
  "accessToken",
  "refreshToken",
  "idToken",
  "encryptedAccessToken",
  "encryptedRefreshToken",
  "encryptedIdToken",
];

if (currentKey.trim().length < 32) {
  throw new Error("CREDENTIAL_ENCRYPTION_KEY must be set to at least 32 characters.");
}

const pool = await mysql.createPool({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "growth_group_internal_crm",
  waitForConnections: true,
  connectionLimit: 2,
});

try {
  const [rows] = await pool.execute(
    "SELECT id, clinic_id, config FROM integration WHERE deleted_at IS NULL",
  );

  let scanned = 0;
  let changed = 0;

  for (const row of rows) {
    scanned += 1;
    const config = parseConfig(row.config);
    if (!config) continue;

    let rowChanged = false;
    for (const field of sensitiveFields) {
      const value = config[field];
      if (typeof value !== "string" || !value.trim()) continue;
      if (value.startsWith(`${currentPrefix}:${currentVersion}:`)) continue;

      const plaintext = decryptCredential(value);
      if (!plaintext) {
        throw new Error(`Could not decrypt ${field} for integration ${row.id}.`);
      }

      config[field] = encryptCredential(plaintext);
      rowChanged = true;
    }

    if (!rowChanged) continue;
    changed += 1;

    if (apply) {
      await pool.execute(
        "UPDATE integration SET config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND clinic_id = ?",
        [JSON.stringify(config), row.id, row.clinic_id],
      );
    }
  }

  console.log(JSON.stringify({
    mode: apply ? "apply" : "dry-run",
    scannedIntegrations: scanned,
    integrationsToRewrap: changed,
  }, null, 2));
} finally {
  await pool.end();
}

function parseJsonRecord(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed)
        .map(([key, item]) => [String(key).trim(), String(item || "").trim()])
        .filter(([key, item]) => key && item),
    );
  } catch {
    return {};
  }
}

function parseConfig(value) {
  if (!value) return null;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
}

function hashKey(raw) {
  const trimmed = String(raw || "").trim();
  if (trimmed.length < 32) throw new Error("Credential key material is too short.");
  return crypto.createHash("sha256").update(trimmed).digest();
}

function credentialKeys() {
  return new Map([
    [currentVersion, hashKey(currentKey)],
    ...Object.entries(previousKeys).map(([version, raw]) => [version, hashKey(raw)]),
  ]);
}

function encryptCredential(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", hashKey(currentKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [
    currentPrefix,
    currentVersion,
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

function decryptCredential(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (!raw.startsWith("enc:")) return raw;

  if (raw.startsWith(`${currentPrefix}:`)) {
    const [, , version, iv, tag, ciphertext] = raw.split(":");
    const key = credentialKeys().get(version);
    return key && iv && tag && ciphertext ? tryDecrypt(key, iv, tag, ciphertext) : null;
  }

  if (raw.startsWith(`${legacyPrefix}:`)) {
    const [, , iv, tag, ciphertext] = raw.split(":");
    if (!iv || !tag || !ciphertext) return null;

    const candidates = [
      ...credentialKeys().values(),
      ...(legacyJwtSecret ? [hashKey(legacyJwtSecret)] : []),
      ...(jwtSecret ? [hashKey(jwtSecret)] : []),
    ];

    for (const key of candidates) {
      const plaintext = tryDecrypt(key, iv, tag, ciphertext);
      if (plaintext) return plaintext;
    }
  }

  return null;
}

function tryDecrypt(key, iv, tag, ciphertext) {
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}
