import type {
  ContactImportRow,
  ContactMutationDTO,
  NormalizedContactData,
  NormalizedImportContactData,
} from "./contacts.types.js";

export function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function normalizeEmail(value: unknown) {
  return cleanString(value)?.toLowerCase() || null;
}

export function normalizePhone(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;
  return cleaned.replace(/\D/g, "");
}

export function hasOwn(data: object, key: string) {
  return Object.prototype.hasOwnProperty.call(data, key);
}

// Keep date-only fields in MySQL DATE format
function normalizeDate(value: unknown) {
  return cleanString(value)?.slice(0, 10) || null;
}

// Store client-provided timestamps as MySQL DATETIME values
function normalizeDateTime(value: unknown) {
  const cleaned = cleanString(value);
  if (!cleaned) return null;

  const parsed = new Date(cleaned);
  if (Number.isNaN(parsed.getTime())) return cleaned;

  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeMoney(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : null;
}

function normalizeStringList(values: unknown): string[] {
  return Array.isArray(values)
    ? values.map((value) => cleanString(value)).filter(Boolean) as string[]
    : [];
}

// Normalize manual create/update payloads before database writes and duplicate checks
export function normalizeContactData(data: Partial<ContactMutationDTO>): NormalizedContactData {
  return {
    externalId: cleanString(data.externalId),
    firstName: cleanString(data.firstName),
    lastName: cleanString(data.lastName),
    email: normalizeEmail(data.email),
    phone: normalizePhone(data.phone),
    dateOfBirth: normalizeDate(data.dateOfBirth),
    gender: cleanString(data.gender),
    address: cleanString(data.address),
    city: cleanString(data.city),
    state: cleanString(data.state),
    postalCode: cleanString(data.postalCode),
    country: cleanString(data.country),
    tags: normalizeStringList(data.tags),
    status: cleanString(data.status),
    source: cleanString(data.source),
    value: normalizeMoney(data.value),
    treatmentInterests: normalizeStringList(data.treatmentInterests),
    notes: cleanString(data.notes),
    lastContactAt: normalizeDateTime(data.lastContactAt),
  };
}

// Import rows share contact normalization but keep import-safe defaults
export function normalizeImportRow(row: ContactImportRow): NormalizedImportContactData {
  const normalized = normalizeContactData({
    ...row,
    status: row.status || "lead",
    source: row.source || "import",
  });

  return {
    ...normalized,
    status: normalized.status || "lead",
    source: normalized.source || "import",
  };
}
