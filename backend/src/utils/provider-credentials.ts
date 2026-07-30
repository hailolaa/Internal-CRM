import crypto from "node:crypto";
import { config } from "../config/index.js";
import { ApiError } from "./ApiError.js";

const CURRENT_ENVELOPE_PREFIX = "enc:cred";
const LEGACY_ENVELOPE_PREFIX = "enc:v1";

function hashKey(raw: string) {
  const trimmed = raw.trim();
  if (trimmed.length < 32) {
    throw ApiError.serviceUnavailable("Provider credential encryption is not configured");
  }
  return crypto.createHash("sha256").update(trimmed).digest();
}

function configuredKeys() {
  return new Map<string, Buffer>([
    [config.credentials.keyVersion, hashKey(config.credentials.encryptionKey)],
    ...Object.entries(config.credentials.previousKeys).map(([version, raw]) => [version, hashKey(raw)] as const),
  ]);
}

function decryptAesGcm(key: Buffer, iv: string, tag: string, ciphertext: string) {
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function decryptCurrentEnvelope(raw: string) {
  const [, , version, iv, tag, ciphertext] = raw.split(":");
  if (!version || !iv || !tag || !ciphertext) return null;

  const key = configuredKeys().get(version);
  if (!key) return null;
  return decryptAesGcm(key, iv, tag, ciphertext);
}

function decryptLegacyEnvelope(raw: string) {
  const [, , iv, tag, ciphertext] = raw.split(":");
  if (!iv || !tag || !ciphertext) return null;

  const candidates = [
    ...configuredKeys().values(),
    ...(config.credentials.legacyJwtSecret ? [hashKey(config.credentials.legacyJwtSecret)] : []),
    crypto.createHash("sha256").update(config.jwt.secret).digest(),
  ];

  for (const key of candidates) {
    try {
      return decryptAesGcm(key, iv, tag, ciphertext);
    } catch {
      // Try the next configured key. Legacy data may have been encrypted with
      // either the credential key or the old JWT secret depending on the module.
    }
  }
  return null;
}

export function encryptProviderCredential(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", hashKey(config.credentials.encryptionKey), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    CURRENT_ENVELOPE_PREFIX,
    config.credentials.keyVersion,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(":");
}

export function decryptProviderCredential(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  if (!raw.startsWith("enc:")) return raw;

  try {
    if (raw.startsWith(`${CURRENT_ENVELOPE_PREFIX}:`)) return decryptCurrentEnvelope(raw);
    if (raw.startsWith(`${LEGACY_ENVELOPE_PREFIX}:`)) return decryptLegacyEnvelope(raw);
  } catch {
    return null;
  }

  return null;
}

export function shouldRewrapProviderCredential(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  return Boolean(raw && !raw.startsWith(`${CURRENT_ENVELOPE_PREFIX}:${config.credentials.keyVersion}:`));
}
