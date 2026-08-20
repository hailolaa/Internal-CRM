const REDACTED = "[redacted]";

const SENSITIVE_KEY_PATTERN =
  /(^|_|-)(password|passcode|token|access.?token|refresh.?token|authorization|cookie|api.?key|secret|client.?secret|oauth|stripe|card|payment|cvv|cvc|email|phone|name|first.?name|last.?name|patient|contact)(_|-|$)/i;

const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/gi;
const TOKEN_PATTERN = /\b(?:sk|pk|rk|whsec|xox[baprs]|gh[pousr])_[A-Za-z0-9_=-]{8,}\b/g;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object") return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function sanitizeString(value: string) {
  return value
    .replace(BEARER_PATTERN, `Bearer ${REDACTED}`)
    .replace(TOKEN_PATTERN, REDACTED)
    .replace(EMAIL_PATTERN, REDACTED)
    .replace(PHONE_PATTERN, REDACTED);
}

export function redactSensitiveValue(value: unknown, depth = 0): unknown {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeString(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Error) {
    return {
      name: sanitizeString(value.name),
      message: sanitizeString(value.message),
      stack: value.stack ? sanitizeString(value.stack) : undefined,
    };
  }
  if (depth >= 5) return "[truncated]";
  if (Array.isArray(value)) {
    return value.slice(0, 25).map((item) => redactSensitiveValue(item, depth + 1));
  }
  if (!isPlainObject(value)) return sanitizeString(String(value));

  const safe: Record<string, unknown> = {};
  for (const [key, nested] of Object.entries(value)) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe[key] = REDACTED;
      continue;
    }
    safe[key] = redactSensitiveValue(nested, depth + 1);
  }
  return safe;
}

export function redactTelemetryPath(path: string | null | undefined) {
  if (!path) return path || null;
  const [pathname, query] = path.split("?", 2);
  if (!query) return sanitizeString(pathname || path);

  const params = new URLSearchParams(query);
  for (const key of Array.from(params.keys())) {
    params.set(key, SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : sanitizeString(params.get(key) || ""));
  }
  const serialized = params.toString();
  return serialized ? `${pathname}?${serialized}` : pathname || path;
}

export function observabilityFingerprint(value: unknown) {
  return JSON.stringify(redactSensitiveValue(value));
}
