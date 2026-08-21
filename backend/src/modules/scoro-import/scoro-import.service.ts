import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildScoroIdentity,
  getScoroContract,
  SCORO_ENTITY_ORDER,
  SCORO_SOURCE_SYSTEM,
  type ScoroEntity,
  type ScoroQuarantineReason,
  type ScoroWarningReason,
} from "./scoro-import.contract.js";
import type {
  ScoroApplyPlan,
  ScoroCandidateMatch,
  ScoroCleanupPlan,
  ScoroCleanupRecord,
  ScoroDryRunRecord,
  ScoroEntitySummary,
  ScoroExistingSourceRecord,
  ScoroExistingTarget,
  ScoroImportDryRunInput,
  ScoroImportDryRunResult,
  ScoroImportIdentity,
  ScoroReconciliationReport,
} from "./scoro-import.types.js";

interface ParsedSourceRow {
  entity: ScoroEntity;
  filename: string;
  rowNumber: number;
  rawRow: Record<string, string>;
}

interface SourceIndexes {
  emailCounts: Map<string, number>;
  phoneCounts: Map<string, number>;
  domainCounts: Map<string, number>;
  sourceIdsByEntity: Map<ScoroEntity, Set<string>>;
  sourceIdCounts: Map<string, number>;
  sourceRowsByRelatedKey: Map<string, ParsedSourceRow>;
}

export function runScoroImportDryRun(input: ScoroImportDryRunInput): ScoroImportDryRunResult {
  const rows = loadScoroRows(input.inputDirectory);
  const indexes = buildSourceIndexes(rows);
  const existingSourceIndex = buildExistingSourceIndex(input.existingSourceRecords || []);
  const ownerMap = normalizeOwnerMap(input.ownerEmailToUserId || {});
  const records = rows.map((row) => analyseRow(row, input.clinicId, indexes, existingSourceIndex, ownerMap, input.existingTargets || []));
  const entities = buildEntitySummaries(records);
  const reconciliation = buildReconciliation(records, { importedRows: 0, skippedDuplicates: 0 });
  const sourceHash = sha256(JSON.stringify(records.map((record) => ({
    entity: record.entity,
    sourceRecordId: record.sourceRecordId,
    rowHash: record.identity?.rowHash || sha256(JSON.stringify(record.rawRow)),
  }))));

  return {
    sourceSystem: SCORO_SOURCE_SYSTEM,
    clinicId: input.clinicId,
    sourceHash,
    entities,
    records,
    reconciliation,
  };
}

export function buildScoroApplyPlan(dryRun: ScoroImportDryRunResult, existingIdentityKeys: Iterable<string> = []): ScoroApplyPlan {
  const existing = new Set(existingIdentityKeys);
  const readyRecords = dryRun.records.filter((record) => record.validationStatus !== "quarantined" && record.identity);
  const skippedDuplicateRecords = readyRecords.filter((record) => existing.has(record.identity?.identityKey || ""));
  const newReadyRecords = readyRecords.filter((record) => !existing.has(record.identity?.identityKey || ""));
  const quarantinedRecords = dryRun.records.filter((record) => record.validationStatus === "quarantined");

  return {
    mode: "apply",
    sourceSystem: dryRun.sourceSystem,
    clinicId: dryRun.clinicId,
    sourceHash: dryRun.sourceHash,
    readyRecords: newReadyRecords,
    skippedDuplicateRecords,
    quarantinedRecords,
    reconciliation: buildReconciliation(dryRun.records, {
      importedRows: newReadyRecords.length,
      skippedDuplicates: skippedDuplicateRecords.length,
    }),
  };
}

export function buildScoroCleanupPlan(batchId: string, records: ScoroCleanupRecord[]): ScoroCleanupPlan {
  return {
    batchId,
    removableTargets: records.filter((record) => Boolean(record.targetType && record.targetId)),
    orphanedImportRecords: records.filter((record) => !record.targetType || !record.targetId),
  };
}

export function parseScoroCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length === 0) return [];
  const [headerLine = "", ...dataLines] = lines;
  const headers = parseCsvLine(headerLine);

  return dataLines.map((line) => {
    const values = parseCsvLine(line);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] || ""]));
  });
}

export function normalizeScoroEmail(value: string | null | undefined): string | null {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized && normalized.includes("@") ? normalized : null;
}

export function normalizeScoroPhone(value: string | null | undefined): string | null {
  const digits = String(value || "").replace(/\D/g, "");
  return digits.length >= 7 ? digits : null;
}

export function normalizeScoroDomain(value: string | null | undefined): string | null {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;
  const withoutProtocol = raw.replace(/^https?:\/\//, "").replace(/^www\./, "");
  const domain = withoutProtocol.split(/[/?#]/)[0] || "";
  return domain.includes(".") ? domain : null;
}

function loadScoroRows(inputDirectory: string): ParsedSourceRow[] {
  const rows: ParsedSourceRow[] = [];

  for (const entity of SCORO_ENTITY_ORDER) {
    const contract = getScoroContract(entity);
    const filePath = resolve(inputDirectory, contract.filename);
    const parsedRows = parseScoroCsv(readFileSync(filePath, "utf8"));
    rows.push(...parsedRows.map((rawRow, index) => ({
      entity,
      filename: contract.filename,
      rowNumber: index + 2,
      rawRow,
    })));
  }

  return rows;
}

function analyseRow(
  row: ParsedSourceRow,
  clinicId: string,
  indexes: SourceIndexes,
  existingSourceIndex: Map<string, ScoroExistingSourceRecord>,
  ownerMap: Map<string, string>,
  existingTargets: ScoroExistingTarget[],
): ScoroDryRunRecord {
  const contract = getScoroContract(row.entity);
  const quarantineReasons: ScoroQuarantineReason[] = [];
  const warnings: ScoroWarningReason[] = [];
  const sourceRecordId = clean(row.rawRow.scoro_record_id);
  const normalizedEmail = normalizeScoroEmail(readEmail(row));
  const normalizedPhone = normalizeScoroPhone(row.rawRow.phone);
  const normalizedDomain = normalizeScoroDomain(row.rawRow.website);
  const rowHash = sha256(JSON.stringify(row.rawRow));
  const identity: ScoroImportIdentity | null = sourceRecordId
    ? {
        sourceSystem: SCORO_SOURCE_SYSTEM,
        sourceEntity: row.entity,
        sourceRecordId,
        identityKey: buildScoroIdentity(row.entity, sourceRecordId),
        rowHash,
        normalizedEmail,
        normalizedPhone,
        normalizedDomain,
      }
    : null;

  if (!sourceRecordId) quarantineReasons.push("missing_source_id");

  const missingRequired = contract.requiredValueHeaders.filter((header) => !clean(row.rawRow[header]));
  if (missingRequired.length > 0 && !missingRequired.every((header) => header === "scoro_record_id")) {
    quarantineReasons.push("invalid_required_fields");
  }

  if (sourceRecordId && (indexes.sourceIdsByEntity.get(row.entity)?.has(sourceRecordId) !== true || countSourceId(row.entity, sourceRecordId, indexes) > 1)) {
    quarantineReasons.push("duplicate_scoro_id");
  }

  for (const header of contract.dateHeaders) {
    const value = clean(row.rawRow[header]);
    if (value && !isValidDate(value)) quarantineReasons.push("invalid_date");
  }

  for (const header of contract.booleanHeaders) {
    const value = clean(row.rawRow[header]);
    if (value && !["true", "false"].includes(value.toLowerCase())) quarantineReasons.push("invalid_boolean");
  }

  for (const header of contract.moneyHeaders) {
    const value = clean(row.rawRow[header]);
    if (value && !isValidMoney(value)) quarantineReasons.push("invalid_money");
  }

  for (const [header, allowedValues] of Object.entries(contract.enumHeaders)) {
    const value = clean(row.rawRow[header]);
    if (value && !allowedValues.includes(value.toLowerCase())) quarantineReasons.push("invalid_enum");
  }

  const ownerEmail = firstClean(contract.ownerHeaders.map((header) => row.rawRow[header]))?.toLowerCase() || null;
  if (ownerEmail && !ownerMap.has(ownerEmail)) quarantineReasons.push("unsupported_owner_mapping");

  const relatedSourceIdentity = resolveRelatedSourceIdentity(row, indexes, existingSourceIndex, clinicId, quarantineReasons);

  if (normalizedEmail && (indexes.emailCounts.get(`${row.entity}:${normalizedEmail}`) || 0) > 1) warnings.push("source_duplicate_email");
  if (normalizedPhone && (indexes.phoneCounts.get(`${row.entity}:${normalizedPhone}`) || 0) > 1) warnings.push("source_duplicate_phone");
  if (normalizedDomain && (indexes.domainCounts.get(`${row.entity}:${normalizedDomain}`) || 0) > 1) warnings.push("source_duplicate_domain");

  const candidateMatches = findCandidateMatches(row, clinicId, existingTargets, normalizedEmail, normalizedPhone, normalizedDomain);
  const strongMatches = candidateMatches.filter((match) => match.type !== "name");
  const strongTargetIds = new Set(strongMatches.map((match) => `${match.targetType}:${match.targetId}`));
  if (strongTargetIds.size > 1) quarantineReasons.push("ambiguous_strong_match");
  if (strongMatches.length === 0 && candidateMatches.some((match) => match.type === "name")) warnings.push("name_similarity_only");

  const mappedStrongMatch = strongTargetIds.size === 1 ? strongMatches[0] || null : null;
  const uniqueQuarantineReasons = unique(quarantineReasons);
  const uniqueWarnings = unique(warnings);

  return {
    entity: row.entity,
    filename: row.filename,
    rowNumber: row.rowNumber,
    sourceRecordId: sourceRecordId || null,
    identity,
    validationStatus: uniqueQuarantineReasons.length > 0 ? "quarantined" : mappedStrongMatch ? "mapped" : "valid",
    quarantineReasons: uniqueQuarantineReasons,
    warnings: uniqueWarnings,
    ownerEmail,
    relatedSourceIdentity,
    mappedTargetType: mappedStrongMatch?.targetType || null,
    mappedTargetId: mappedStrongMatch?.targetId || null,
    candidateMatches,
    rawRow: row.rawRow,
  };
}

function buildSourceIndexes(rows: ParsedSourceRow[]): SourceIndexes {
  const emailCounts = new Map<string, number>();
  const phoneCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  const sourceIdsByEntity = new Map<ScoroEntity, Set<string>>();
  const sourceIdCounts = new Map<string, number>();
  const sourceRowsByRelatedKey = new Map<string, ParsedSourceRow>();

  for (const row of rows) {
    const sourceRecordId = clean(row.rawRow.scoro_record_id);
    if (sourceRecordId) {
      const set = sourceIdsByEntity.get(row.entity) || new Set<string>();
      set.add(sourceRecordId);
      sourceIdsByEntity.set(row.entity, set);
      sourceRowsByRelatedKey.set(`${row.entity}:${sourceRecordId}`, row);
      increment(sourceIdCounts, `${row.entity}:${sourceRecordId}`);
    }

    const normalizedEmail = normalizeScoroEmail(readEmail(row));
    const normalizedPhone = normalizeScoroPhone(row.rawRow.phone);
    const normalizedDomain = normalizeScoroDomain(row.rawRow.website);
    increment(emailCounts, normalizedEmail ? `${row.entity}:${normalizedEmail}` : null);
    increment(phoneCounts, normalizedPhone ? `${row.entity}:${normalizedPhone}` : null);
    increment(domainCounts, normalizedDomain ? `${row.entity}:${normalizedDomain}` : null);
  }

  return { emailCounts, phoneCounts, domainCounts, sourceIdsByEntity, sourceIdCounts, sourceRowsByRelatedKey };
}

function countSourceId(entity: ScoroEntity, sourceRecordId: string, indexes: SourceIndexes): number {
  return indexes.sourceIdCounts.get(`${entity}:${sourceRecordId}`) || 0;
}

function buildExistingSourceIndex(records: ScoroExistingSourceRecord[]): Map<string, ScoroExistingSourceRecord> {
  const index = new Map<string, ScoroExistingSourceRecord>();
  for (const record of records) {
    index.set(`${record.sourceEntity}:${record.sourceRecordId}`, record);
  }
  return index;
}

function resolveRelatedSourceIdentity(
  row: ParsedSourceRow,
  indexes: SourceIndexes,
  existingSourceIndex: Map<string, ScoroExistingSourceRecord>,
  clinicId: string,
  quarantineReasons: ScoroQuarantineReason[],
): string | null {
  if (row.entity !== "task_followup") return null;
  const relatedType = clean(row.rawRow.related_type).toLowerCase() as ScoroEntity;
  const relatedScoroId = clean(row.rawRow.related_scoro_id);
  if (!relatedType || !relatedScoroId) return null;

  const relatedKey = `${relatedType}:${relatedScoroId}`;
  if (indexes.sourceRowsByRelatedKey.has(relatedKey)) return buildScoroIdentity(relatedType, relatedScoroId);

  const existingSource = existingSourceIndex.get(relatedKey);
  if (!existingSource) {
    quarantineReasons.push("unresolved_related_scoro_id");
    return null;
  }
  if (existingSource.clinicId !== clinicId) {
    quarantineReasons.push("cross_tenant_relationship");
    return null;
  }
  return buildScoroIdentity(existingSource.sourceEntity, existingSource.sourceRecordId);
}

function findCandidateMatches(
  row: ParsedSourceRow,
  clinicId: string,
  existingTargets: ScoroExistingTarget[],
  normalizedEmail: string | null,
  normalizedPhone: string | null,
  normalizedDomain: string | null,
): ScoroCandidateMatch[] {
  const matches: ScoroCandidateMatch[] = [];
  const accountName = clean(row.rawRow.account_name || row.rawRow.related_account_name).toLowerCase();
  const firstName = clean(row.rawRow.first_name || row.rawRow.contact_first_name).toLowerCase();
  const lastName = clean(row.rawRow.last_name || row.rawRow.contact_last_name).toLowerCase();

  for (const target of existingTargets.filter((candidate) => candidate.clinicId === clinicId)) {
    if (normalizedEmail && normalizeScoroEmail(target.email) === normalizedEmail) {
      matches.push({ type: "email", targetType: target.targetType, targetId: target.targetId, score: 100 });
    }
    if (normalizedPhone && normalizeScoroPhone(target.phone) === normalizedPhone) {
      matches.push({ type: "phone", targetType: target.targetType, targetId: target.targetId, score: 95 });
    }
    if (normalizedDomain && normalizeScoroDomain(target.website) === normalizedDomain) {
      matches.push({ type: "domain", targetType: target.targetType, targetId: target.targetId, score: 90 });
    }
    const targetAccountName = clean(target.accountName).toLowerCase();
    const targetFullName = `${clean(target.firstName).toLowerCase()} ${clean(target.lastName).toLowerCase()}`.trim();
    const sourceFullName = `${firstName} ${lastName}`.trim();
    if ((accountName && targetAccountName && accountName === targetAccountName) || (sourceFullName && sourceFullName === targetFullName)) {
      matches.push({ type: "name", targetType: target.targetType, targetId: target.targetId, score: 60 });
    }
  }

  return dedupeMatches(matches);
}

function buildEntitySummaries(records: ScoroDryRunRecord[]): ScoroEntitySummary[] {
  return SCORO_ENTITY_ORDER.map((entity) => {
    const contract = getScoroContract(entity);
    const entityRecords = records.filter((record) => record.entity === entity);
    return {
      entity,
      filename: contract.filename,
      sourceRows: entityRecords.length,
      validRows: entityRecords.filter((record) => record.validationStatus === "valid").length,
      mappedRows: entityRecords.filter((record) => record.validationStatus === "mapped").length,
      quarantinedRows: entityRecords.filter((record) => record.validationStatus === "quarantined").length,
      duplicateCandidates: entityRecords.filter((record) => record.candidateMatches.length > 0 || record.warnings.some((warning) => warning.startsWith("source_duplicate_"))).length,
    };
  });
}

function buildReconciliation(
  records: ScoroDryRunRecord[],
  applied: { importedRows: number; skippedDuplicates: number },
): ScoroReconciliationReport {
  return {
    sourceRows: records.length,
    validRows: records.filter((record) => record.validationStatus === "valid").length,
    mappedRows: records.filter((record) => record.validationStatus === "mapped").length,
    importedRows: applied.importedRows,
    skippedDuplicates: applied.skippedDuplicates,
    quarantinedRows: records.filter((record) => record.validationStatus === "quarantined").length,
    unresolvedRelations: records.filter((record) => record.quarantineReasons.includes("unresolved_related_scoro_id") || record.quarantineReasons.includes("cross_tenant_relationship")).length,
    ownerMappingIssues: records.filter((record) => record.quarantineReasons.includes("unsupported_owner_mapping")).length,
    statusMismatches: 0,
    missingTargets: records.filter((record) => record.entity === "task_followup" && !record.relatedSourceIdentity && record.validationStatus !== "quarantined").length,
    duplicateTargets: countDuplicateTargets(records),
    duplicateCandidates: records.filter((record) => record.candidateMatches.length > 0 || record.warnings.some((warning) => warning.startsWith("source_duplicate_"))).length,
  };
}

function countDuplicateTargets(records: ScoroDryRunRecord[]): number {
  const targetCounts = new Map<string, number>();
  for (const record of records) {
    if (record.mappedTargetType && record.mappedTargetId) {
      increment(targetCounts, `${record.mappedTargetType}:${record.mappedTargetId}`);
    }
  }
  return Array.from(targetCounts.values()).filter((count) => count > 1).length;
}

function readEmail(row: ParsedSourceRow): string | null {
  return row.rawRow.email || row.rawRow.related_email || null;
}

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];
    if (char === "\"" && inQuotes && nextChar === "\"") {
      current += "\"";
      index += 1;
      continue;
    }
    if (char === "\"") {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }

  values.push(current.trim());
  return values;
}

function normalizeOwnerMap(ownerEmailToUserId: Record<string, string>): Map<string, string> {
  return new Map(Object.entries(ownerEmailToUserId).map(([email, userId]) => [email.trim().toLowerCase(), userId]));
}

function isValidDate(value: string): boolean {
  return !Number.isNaN(Date.parse(value));
}

function isValidMoney(value: string): boolean {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0;
}

function firstClean(values: Array<string | undefined>): string | null {
  for (const value of values) {
    const cleaned = clean(value);
    if (cleaned) return cleaned;
  }
  return null;
}

function clean(value: string | null | undefined): string {
  return String(value || "").trim();
}

function increment(map: Map<string, number>, key: string | null | undefined): void {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + 1);
}

function unique<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function dedupeMatches(matches: ScoroCandidateMatch[]): ScoroCandidateMatch[] {
  const byKey = new Map<string, ScoroCandidateMatch>();
  for (const match of matches) {
    const key = `${match.type}:${match.targetType}:${match.targetId}`;
    if (!byKey.has(key)) byKey.set(key, match);
  }
  return Array.from(byKey.values());
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
