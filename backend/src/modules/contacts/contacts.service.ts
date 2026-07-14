import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { phase1TimelineActions } from "../events/phase1-events.js";
import { appointmentsService } from "../appointments/appointments.service.js";
import { callsService } from "../calls/calls.service.js";
import { depositsService } from "../deposits/deposits.service.js";
import { messageTemplatesService } from "../message-templates/message-templates.service.js";
import { tasksService } from "../tasks/tasks.service.js";
import {
  mapContact,
  mapDuplicateCandidate,
  mapImportBatch,
  mapTimelineActivity,
  parseJsonObject,
} from "./contacts.mappers.js";
import {
  hasOwn,
  hasUsableLeadIdentity,
  normalizeContactData,
  normalizeImportRow,
} from "./contacts.normalizers.js";
import {
  createDuplicateCandidate,
  findDuplicateContacts,
  findExistingContact,
  insertContact,
  insertImportedContact,
  updateImportedContact,
} from "./contacts.persistence.js";
import {
  buildListFilters,
  contactSelectFields,
  getListSort,
  lastActivityJoin,
} from "./contacts.queries.js";
import { slaService } from "../sla/sla.service.js";
import type {
  ContactTimelineActivity,
  ContactDrawerActionContext,
  ContactDrawerActionResult,
  ContactLinkedActivityResponse,
  ContactImportBatchResponse,
  ContactImportPreviewRequest,
  ContactImportPreviewResponse,
  ContactImportRequest,
  ContactImportResponse,
  ContactImportRow,
  ContactListQuery,
  ContactListResponse,
  ContactMutationDTO,
  ContactMutationResponse,
  ContactResponse,
  CreateContactDTO,
  DuplicateCandidateResponse,
  SendContactMessageTemplateDTO,
  UpdateContactDTO,
} from "./contacts.types.js";

interface RequestMeta {
  ipAddress?: string | null;
  userAgent?: string | null;
}

const CALL_TABLE = "`\u00A0call\u00A0`";
const maxImportRows = 1000;

const importHeaderAliases: Record<string, keyof ContactImportRow | "tags"> = {
  firstname: "firstName",
  first: "firstName",
  givenname: "firstName",
  lastname: "lastName",
  last: "lastName",
  surname: "lastName",
  familyname: "lastName",
  fullname: "firstName",
  name: "firstName",
  account: "accountName",
  accountname: "accountName",
  clinic: "accountName",
  clinicname: "accountName",
  company: "accountName",
  companyname: "accountName",
  role: "roleTitle",
  title: "roleTitle",
  jobtitle: "roleTitle",
  contactrole: "roleTitle",
  emailpermission: "emailPermission",
  emailoptin: "emailPermission",
  phonepermission: "phonePermission",
  phoneoptin: "phonePermission",
  smspermission: "smsPermission",
  smsoptin: "smsPermission",
  whatsapppermission: "whatsappPermission",
  whatsappoptin: "whatsappPermission",
  email: "email",
  emailaddress: "email",
  phone: "phone",
  mobile: "phone",
  mobilenumber: "phone",
  phonenumber: "phone",
  website: "website",
  url: "website",
  domain: "website",
  tags: "tags",
  tag: "tags",
  source: "source",
  leadsource: "source",
  status: "status",
  leadstatus: "leadStatus",
  leadstage: "leadStatus",
  notes: "notes",
  note: "notes",
  treatment: "treatmentInterests",
  treatmentinterest: "treatmentInterests",
  treatmentinterests: "treatmentInterests",
  package: "packageInterest",
  packageinterest: "packageInterest",
  recommendedpackage: "recommendedPackage",
  recommendedservice: "recommendedPackage",
};

function csvCell(value: unknown) {
  if (value == null) return "";
  const text = Array.isArray(value) ? value.join("; ") : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toContactsCsv(contacts: ContactResponse[]) {
  const headers = [
    "id",
    "accountName",
    "role",
    "firstName",
    "lastName",
    "email",
    "phone",
    "roleTitle",
    "emailPermission",
    "phonePermission",
    "smsPermission",
    "whatsappPermission",
    "website",
    "status",
    "leadStatus",
    "source",
    "value",
    "treatmentInterests",
    "packageInterest",
    "recommendedPackage",
    "tags",
    "lastContactAt",
    "createdAt",
    "updatedAt",
  ];
  const rows = contacts.map((contact) => [
    contact.id,
    contact.accountName,
    contact.role,
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.roleTitle,
    contact.emailPermission,
    contact.phonePermission,
    contact.smsPermission,
    contact.whatsappPermission,
    contact.website,
    contact.status,
    contact.leadStatus,
    contact.source,
    contact.value,
    contact.treatmentInterests,
    contact.packageInterest,
    contact.recommendedPackage,
    contact.tags,
    contact.lastContactAt,
    contact.createdAt,
    contact.updatedAt,
  ]);

  return [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n") + "\n";
}

function normalizeImportHeader(header: string) {
  return header.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseDelimitedLine(line: string, delimiter: "," | "\t") {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

function detectImportDelimiter(text: string) {
  const firstLine = text.split(/\r?\n/).find((line) => line.trim()) || "";
  return firstLine.includes("\t") ? "\t" : ",";
}

function splitListCell(value: string | undefined) {
  return (value || "")
    .split(/[;,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseImportBoolean(value: string | undefined) {
  const cleaned = value?.trim().toLowerCase();
  if (!cleaned) return undefined;
  if (["true", "1", "yes", "y", "on", "allowed"].includes(cleaned)) return true;
  if (["false", "0", "no", "n", "off", "blocked"].includes(cleaned)) return false;
  return undefined;
}

function parseImportText(text: string): ContactImportRow[] {
  const delimiter = detectImportDelimiter(text);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) throw ApiError.badRequest("Sheet must include a header row and at least one contact row");

  const headerLine = lines[0];
  if (!headerLine) throw ApiError.badRequest("Sheet must include a header row");

  const headers = parseDelimitedLine(headerLine, delimiter).map((header) => (
    importHeaderAliases[normalizeImportHeader(header)] || normalizeImportHeader(header)
  ));

  const rows = lines.slice(1, maxImportRows + 1).map((line) => {
    const values = parseDelimitedLine(line, delimiter);
    const raw: Record<string, string> = {};
    headers.forEach((header, valueIndex) => {
      raw[header] = values[valueIndex] || "";
    });

    const row: ContactImportRow = {
      accountName: raw.accountName || raw.account || raw.clinic || raw.company || "",
      firstName: raw.firstName || raw.firstname || raw.first || "",
      lastName: raw.lastName || raw.lastname || raw.last || "",
      email: raw.email || "",
      phone: raw.phone || raw.mobile || "",
      roleTitle: raw.roleTitle || raw.role || raw.title || raw.jobtitle || "",
      website: raw.website || raw.url || raw.domain || "",
      tags: splitListCell(raw.tags),
      source: raw.source || "Google Sheets",
      status: raw.status || "lead",
      leadStatus: raw.leadStatus || raw.leadstage || raw.status || "new",
      treatmentInterests: splitListCell(raw.treatmentInterests || raw.treatment),
      packageInterest: raw.packageInterest || raw.package || "",
      recommendedPackage: raw.recommendedPackage || raw.recommendedservice || "",
    };
    const emailPermission = parseImportBoolean(raw.emailPermission);
    const phonePermission = parseImportBoolean(raw.phonePermission);
    const smsPermission = parseImportBoolean(raw.smsPermission);
    const whatsappPermission = parseImportBoolean(raw.whatsappPermission);
    if (emailPermission !== undefined) row.emailPermission = emailPermission;
    if (phonePermission !== undefined) row.phonePermission = phonePermission;
    if (smsPermission !== undefined) row.smsPermission = smsPermission;
    if (whatsappPermission !== undefined) row.whatsappPermission = whatsappPermission;
    if (raw.notes) row.notes = raw.notes;
    return row;
  });

  if (rows.length === 0) throw ApiError.badRequest("No contact rows found in sheet");
  return rows;
}

function getGoogleSheetCsvUrl(sourceUrl: string) {
  let url: URL;
  try {
    url = new URL(sourceUrl);
  } catch {
    throw ApiError.badRequest("Valid Google Sheets URL is required");
  }

  if (url.protocol !== "https:" || url.hostname !== "docs.google.com") {
    throw ApiError.badRequest("Only published Google Sheets URLs are supported");
  }

  const sheetId = url.pathname.match(/\/spreadsheets\/d\/([^/]+)/)?.[1];
  if (!sheetId) throw ApiError.badRequest("Google Sheets URL must include a spreadsheet ID");

  const gid = url.searchParams.get("gid") || "0";
  return {
    filename: `google-sheet-${sheetId.slice(0, 10)}.csv`,
    url: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${encodeURIComponent(gid)}`,
  };
}

async function fetchGoogleSheetRows(sourceUrl: string) {
  const csv = getGoogleSheetCsvUrl(sourceUrl);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(csv.url, {
      signal: controller.signal,
      headers: { Accept: "text/csv,text/plain,*/*" },
    });

    if (!response.ok) {
      throw ApiError.badRequest("Google Sheet could not be read. Publish it or use a CSV export link.");
    }

    const text = await response.text();
    return {
      filename: csv.filename,
      rows: parseImportText(text),
    };
  } finally {
    clearTimeout(timeout);
  }
}

export class ContactsService {
  // List active clinic contacts with the search and facets used by the lead inbox
  async listContacts(clinicId: string, query: ContactListQuery): Promise<ContactListResponse> {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(250, Math.max(1, Number(query.limit || query.pageSize) || 25));
    const offset = (page - 1) * limit;
    const filters = buildListFilters(clinicId, query);
    const sort = getListSort(query.sortBy, query.sortOrder || query.sortDir);

    const [countRows]: any = await pool.execute(
      `SELECT COUNT(*) as total
       FROM contact c
       WHERE ${filters.whereSql}`,
      filters.values,
    );

    const total = Number(countRows[0]?.total || 0);
    const [rows]: any = await pool.execute(
      `SELECT ${contactSelectFields}
       FROM contact c
       ${lastActivityJoin}
       WHERE ${filters.whereSql}
       ORDER BY ${sort}
       LIMIT ${limit} OFFSET ${offset}`,
      filters.values,
    );

    return {
      contacts: rows.map(mapContact),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async exportContactsCsv(clinicId: string, query: ContactListQuery): Promise<string> {
    const result = await this.listContacts(clinicId, {
      ...query,
      page: 1,
      limit: Math.min(5000, Math.max(1, Number(query.limit || query.pageSize) || 5000)),
    });

    return toContactsCsv(result.contacts);
  }

  // Read a single contact profile inside the authenticated clinic
  async getContact(clinicId: string, contactId: string): Promise<ContactResponse> {
    const [rows]: any = await pool.execute(
      `SELECT ${contactSelectFields}
       FROM contact c
       ${lastActivityJoin}
       WHERE c.id = ?
         AND c.clinic_id = ?
         AND c.deleted_at IS NULL
       LIMIT 1`,
      [contactId, clinicId],
    );

    if (rows.length === 0) {
      throw ApiError.notFound("Contact not found");
    }

    return mapContact(rows[0]);
  }

  // Read user-facing contact history from the activity table
  async getContactTimeline(clinicId: string, contactId: string): Promise<ContactTimelineActivity[]> {
    await this.getContact(clinicId, contactId);

    const [rows]: any = await pool.execute(
      `SELECT id,
              type,
              timestamp,
              user_id as userId,
              metadata,
              created_at as createdAt
       FROM activity
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL
       ORDER BY timestamp DESC, created_at DESC
       LIMIT 200`,
      [clinicId, contactId],
    );

    return rows.map(mapTimelineActivity);
  }

  async getContactLinkedActivity(
    clinicId: string,
    contactId: string,
    actionContext: ContactDrawerActionContext = { userId: "" },
  ): Promise<ContactLinkedActivityResponse> {
    const contact = await this.getContact(clinicId, contactId);
    const timeline = await this.getContactTimeline(clinicId, contactId);
    const [calls, appointments, forms, messages, deposits, tasks] = await Promise.all([
      this.listLinkedCalls(clinicId, contactId),
      this.listLinkedAppointments(clinicId, contactId),
      this.listLinkedForms(clinicId, contact),
      this.listLinkedMessages(clinicId, contactId),
      this.listLinkedDeposits(clinicId, contact),
      this.listLinkedTasks(clinicId, contact),
    ]);

    return {
      timeline,
      calls,
      appointments,
      forms,
      messages,
      deposits,
      tasks,
      counts: {
        timeline: timeline.length,
        calls: calls.length,
        appointments: appointments.length,
        forms: forms.length,
        messages: messages.length,
        deposits: deposits.length,
        tasks: tasks.length,
      },
      actions: this.getLeadDrawerActions(contactId, actionContext),
    };
  }

  getLeadDrawerActions(contactId: string, context: ContactDrawerActionContext) {
    const permissions = context.permissions || {};
    const actionDefinitions = [
      {
        key: "log_call_outcome",
        label: "Log call outcome",
        recordType: "call" as const,
        method: "POST" as const,
        path: `/api/contacts/${contactId}/actions/call-outcome`,
        requiredPermission: "calls:write",
      },
      {
        key: "send_message_template",
        label: "Send or queue message template",
        recordType: "message" as const,
        method: "POST" as const,
        path: `/api/contacts/${contactId}/actions/message-template`,
        requiredPermission: "marketing:read",
      },
      {
        key: "create_booking",
        label: "Create booking",
        recordType: "booking" as const,
        method: "POST" as const,
        path: `/api/contacts/${contactId}/actions/booking`,
        requiredPermission: "appointments:write",
      },
      {
        key: "record_deposit",
        label: "Record deposit",
        recordType: "deposit" as const,
        method: "POST" as const,
        path: `/api/contacts/${contactId}/actions/deposit`,
        requiredPermission: "reports:write",
      },
      {
        key: "create_task",
        label: "Create follow-up task",
        recordType: "task" as const,
        method: "POST" as const,
        path: `/api/contacts/${contactId}/actions/task`,
        requiredPermission: "events:write",
      },
    ];

    return actionDefinitions.map((action) => ({
      ...action,
      enabled: permissions[action.requiredPermission] === true,
      reason: permissions[action.requiredPermission] === true ? null : `Missing ${action.requiredPermission}`,
    }));
  }

  // Create a lead/contact and flag likely duplicates without overwriting existing records
  async createContact(
    clinicId: string,
    userId: string,
    data: CreateContactDTO,
    meta: RequestMeta = {},
  ): Promise<ContactMutationResponse> {
    const normalized = normalizeContactData(data);
    if (!hasUsableLeadIdentity(normalized)) {
      throw ApiError.badRequest("Lead must include an account or contact name and an email or phone number");
    }

    const duplicateMatches = await findDuplicateContacts(clinicId, normalized);
    const blockingMatches = duplicateMatches.filter((match) =>
      match.matchType === "email" || match.matchType === "phone",
    );

    if (blockingMatches.length > 0) {
      const duplicateCandidates: DuplicateCandidateResponse[] = [];
      for (const match of blockingMatches) {
        duplicateCandidates.push(await createDuplicateCandidate({
          clinicId,
          batchId: null,
          existingContactId: match.existingContactId,
          candidateContactId: null,
          matchType: match.matchType,
          score: match.score,
          candidateData: { ...normalized },
        }));
      }

      await logAuditEvent({
        clinicId,
        userId,
        action: "CONTACT_CREATE_BLOCKED_DUPLICATE",
        entityType: "contact",
        changes: {
          duplicateCandidates: duplicateCandidates.length,
          blockingMatchTypes: blockingMatches.map((item) => item.matchType),
          accountName: normalized.accountName,
          email: normalized.email,
          phone: normalized.phone,
          website: normalized.website,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      throw ApiError.conflict(
        "Potential duplicate contact found. Review duplicate candidates before creating.",
        {
          duplicateCandidates,
          duplicateDetected: true,
          blockingRules: ["email", "phone"],
        },
      );
    }

    const contactId = uuidv4();
    await insertContact(clinicId, contactId, normalized);
    await slaService.initialiseContactSla(clinicId, contactId);

    const duplicateCandidates: DuplicateCandidateResponse[] = [];
    for (const match of duplicateMatches) {
      duplicateCandidates.push(await createDuplicateCandidate({
        clinicId,
        batchId: null,
        existingContactId: match.existingContactId,
        candidateContactId: contactId,
        matchType: match.matchType,
        score: match.score,
        candidateData: { ...normalized },
      }));
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONTACT_CREATED",
      entityType: "contact",
      entityId: contactId,
      changes: { ...normalized, duplicateCandidates: duplicateCandidates.length },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: phase1TimelineActions.leadCreated,
        source: "contact",
        recordId: contactId,
        changes: {
          source: normalized.source,
          duplicateCandidates: duplicateCandidates.length,
        },
      }),
    });

    return {
      contact: await this.getContact(clinicId, contactId),
      duplicateCandidates,
    };
  }

  // Patch profile fields without moving the contact outside its clinic scope
  async updateContactProfile(
    clinicId: string,
    userId: string,
    contactId: string,
    data: UpdateContactDTO,
    meta: RequestMeta = {},
  ): Promise<ContactResponse> {
    const normalized = normalizeContactData(data);
    const fields: string[] = [];
    const values: any[] = [];
    const addField = (key: keyof ContactMutationDTO, column: string, value: unknown) => {
      if (!hasOwn(data, key)) return;
      fields.push(`${column} = ?`);
      values.push(value);
    };

    addField("externalId", "external_id", normalized.externalId);
    addField("accountName", "account_name", normalized.accountName);
    addField("role", "contact_role", normalized.role);
    addField("communicationPermissions", "communication_permissions", JSON.stringify(normalized.communicationPermissions));
    addField("firstName", "first_name", normalized.firstName);
    addField("lastName", "last_name", normalized.lastName);
    addField("email", "email", normalized.email);
    addField("phone", "phone", normalized.phone);
    addField("roleTitle", "role_title", normalized.roleTitle);
    addField("emailPermission", "email_permission", normalized.emailPermission);
    addField("phonePermission", "phone_permission", normalized.phonePermission);
    addField("smsPermission", "sms_permission", normalized.smsPermission);
    addField("whatsappPermission", "whatsapp_permission", normalized.whatsappPermission);
    addField("website", "website", normalized.website);
    addField("dateOfBirth", "date_of_birth", normalized.dateOfBirth);
    addField("gender", "gender", normalized.gender);
    addField("address", "address", normalized.address);
    addField("city", "city", normalized.city);
    addField("state", "state", normalized.state);
    addField("postalCode", "postal_code", normalized.postalCode);
    addField("country", "country", normalized.country);
    addField("tags", "tags", JSON.stringify(normalized.tags));
    addField("status", "status", normalized.status);
    addField("leadStatus", "lead_status", normalized.leadStatus);
    addField("source", "source", normalized.source);
    addField("value", "value", normalized.value || 0);
    addField("treatmentInterests", "treatment_interests", JSON.stringify(normalized.treatmentInterests));
    addField("packageInterest", "package_interest", normalized.packageInterest);
    addField("recommendedPackage", "recommended_package", normalized.recommendedPackage);
    addField("notes", "notes", normalized.notes);
    addField("lastContactAt", "last_contact_at", normalized.lastContactAt);

    if (fields.length === 0) {
      return this.getContact(clinicId, contactId);
    }

    const existingContact = await this.getContact(clinicId, contactId);

    values.push(contactId, clinicId);
    const [result]: any = await pool.execute(
      `UPDATE contact
       SET ${fields.join(", ")}, updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      values,
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Contact not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONTACT_UPDATED",
      entityType: "contact",
      entityId: contactId,
      changes: { ...data },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const statusChanged = hasOwn(data, "status") && data.status !== existingContact.status;
    const leadStatusChanged = hasOwn(data, "leadStatus") && data.leadStatus !== existingContact.leadStatus;

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: statusChanged || leadStatusChanged ? "StatusChange" : "Note",
      metadata: buildTimelineMetadata({
        action: statusChanged || leadStatusChanged
          ? phase1TimelineActions.leadStageChanged
          : phase1TimelineActions.noteAdded,
        source: "contact",
        recordId: contactId,
        previousStatus: existingContact.status,
        status: hasOwn(data, "status") ? normalized.status : existingContact.status,
        changes: {
          changedFields: Object.keys(data),
          previousLeadStatus: existingContact.leadStatus,
          leadStatus: hasOwn(data, "leadStatus") ? normalized.leadStatus : existingContact.leadStatus,
        },
      }),
    });

    return this.getContact(clinicId, contactId);
  }

  // Soft delete contacts so related activity, audits, and duplicate history remain intact
  async deleteContact(
    clinicId: string,
    userId: string,
    contactId: string,
    meta: RequestMeta = {},
  ): Promise<void> {
    const [result]: any = await pool.execute(
      `UPDATE contact
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL`,
      [contactId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Contact not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONTACT_DELETED",
      entityType: "contact",
      entityId: contactId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "contact.deleted",
        source: "contact",
        recordId: contactId,
      }),
    });
  }

  async importContacts(
    clinicId: string,
    userId: string,
    data: ContactImportRequest,
    meta: RequestMeta = {},
  ): Promise<ContactImportResponse> {
    const source = data.rows?.length
      ? { filename: data.filename || null, rows: data.rows }
      : data.sourceUrl
        ? await fetchGoogleSheetRows(data.sourceUrl)
        : { filename: data.filename || null, rows: [] };
    if (source.rows.length === 0) throw ApiError.badRequest("No contact rows supplied for import");

    const batchId = uuidv4();
    const mode = data.mode || "create_only";
    const errors: ContactImportResponse["errors"] = [];
    let insertedRows = 0;
    let updatedRows = 0;
    let duplicateRows = 0;

    await pool.execute(
      `INSERT INTO contact_import_batch
        (id, clinic_id, created_by, filename, status, total_rows)
       VALUES (?, ?, ?, ?, 'processing', ?)`,
      [batchId, clinicId, userId, source.filename || data.filename || null, source.rows.length],
    );

    for (const [index, row] of source.rows.entries()) {
      const rowNumber = index + 1;

      try {
        const normalized = normalizeImportRow(row);
        if (!normalized.email && !normalized.phone && !normalized.firstName && !normalized.lastName) {
          throw ApiError.badRequest("Row must include an email, phone, or name");
        }

        const existing = await findExistingContact(clinicId, normalized.email, normalized.phone);

        if (existing && mode === "create_only") {
          duplicateRows += 1;
          await createDuplicateCandidate({
            clinicId,
            batchId,
            existingContactId: existing.id,
            candidateContactId: null,
            matchType: existing.matchType,
            score: existing.matchType === "email" ? 100 : 90,
            candidateData: { ...normalized },
          });
          continue;
        }

        if (existing && mode === "upsert") {
          await updateImportedContact(existing.id, clinicId, normalized, batchId);
          updatedRows += 1;
          continue;
        }

        const importedContactId = await insertImportedContact(clinicId, normalized, batchId);
        await slaService.initialiseContactSla(clinicId, importedContactId);
        insertedRows += 1;
      } catch (error) {
        errors.push({
          rowNumber,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const status = errors.length > 0 ? "completed_with_errors" : "completed";
    await pool.execute(
      `UPDATE contact_import_batch
       SET status = ?,
           inserted_rows = ?,
           updated_rows = ?,
           duplicate_rows = ?,
           error_rows = ?,
           errors = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [
        status,
        insertedRows,
        updatedRows,
        duplicateRows,
        errors.length,
        errors.length > 0 ? JSON.stringify(errors) : null,
        batchId,
        clinicId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONTACT_IMPORT_COMPLETED",
      entityType: "contact_import_batch",
      entityId: batchId,
      changes: {
        filename: data.filename || null,
        sourceUrl: data.sourceUrl ? "google_sheets" : null,
        mode,
        totalRows: source.rows.length,
        insertedRows,
        updatedRows,
        duplicateRows,
        errorRows: errors.length,
      },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      batchId,
      status,
      totalRows: source.rows.length,
      insertedRows,
      updatedRows,
      duplicateRows,
      errorRows: errors.length,
      errors,
    };
  }

  async previewImportContacts(
    data: ContactImportPreviewRequest,
  ): Promise<ContactImportPreviewResponse> {
    return fetchGoogleSheetRows(data.sourceUrl);
  }

  async listDuplicateCandidates(clinicId: string): Promise<DuplicateCandidateResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT d.id,
              d.existing_contact_id as existingContactId,
              d.candidate_contact_id as candidateContactId,
              d.match_type as matchType,
              d.score,
              d.status,
              d.candidate_data as candidateData,
              d.created_at as createdAt,
              existing.id as existingId,
              existing.first_name as existingFirstName,
              existing.last_name as existingLastName,
              existing.email as existingEmail,
              existing.phone as existingPhone,
              existing.source as existingSource,
              existing.status as existingStatus,
              existing.created_at as existingCreatedAt,
              candidate.id as candidateId,
              candidate.first_name as candidateFirstName,
              candidate.last_name as candidateLastName,
              candidate.email as candidateEmail,
              candidate.phone as candidatePhone,
              candidate.source as candidateSource,
              candidate.status as candidateStatus,
              candidate.created_at as candidateCreatedAt
       FROM contact_duplicate_candidate d
       LEFT JOIN contact existing
         ON existing.id = d.existing_contact_id
        AND existing.clinic_id = d.clinic_id
        AND existing.deleted_at IS NULL
       LEFT JOIN contact candidate
         ON candidate.id = d.candidate_contact_id
        AND candidate.clinic_id = d.clinic_id
        AND candidate.deleted_at IS NULL
       WHERE d.clinic_id = ?
         AND d.status = 'open'
       ORDER BY d.created_at DESC
       LIMIT 100`,
      [clinicId],
    );

    return rows.map(mapDuplicateCandidate);
  }

  async listImportBatches(clinicId: string): Promise<ContactImportBatchResponse[]> {
    const [rows]: any = await pool.execute(
      `SELECT id,
              filename,
              status,
              total_rows as totalRows,
              inserted_rows as insertedRows,
              updated_rows as updatedRows,
              duplicate_rows as duplicateRows,
              error_rows as errorRows,
              created_at as createdAt,
              updated_at as updatedAt
       FROM contact_import_batch
       WHERE clinic_id = ?
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 25`,
      [clinicId],
    );

    return rows.map(mapImportBatch);
  }

  async getImportBatch(clinicId: string, batchId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              filename,
              status,
              total_rows as totalRows,
              inserted_rows as insertedRows,
              updated_rows as updatedRows,
              duplicate_rows as duplicateRows,
              error_rows as errorRows,
              errors,
              created_at as createdAt,
              updated_at as updatedAt
       FROM contact_import_batch
       WHERE clinic_id = ? AND id = ? AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, batchId],
    );

    if (!rows[0]) throw ApiError.notFound("Import batch not found");

    const row = rows[0];
    return {
      id: row.id,
      filename: row.filename || null,
      status: row.status,
      totalRows: Number(row.totalRows),
      insertedRows: Number(row.insertedRows),
      updatedRows: Number(row.updatedRows),
      duplicateRows: Number(row.duplicateRows),
      errorRows: Number(row.errorRows),
      errors: row.errors ? JSON.parse(row.errors) : [],
      createdAt: new Date(row.createdAt).toISOString(),
      updatedAt: new Date(row.updatedAt).toISOString(),
    };
  }

  async resolveDuplicateCandidate(
    clinicId: string,
    userId: string,
    candidateId: string,
    status: string,
    meta: RequestMeta = {},
  ) {
    const [result]: any = await pool.execute(
      `UPDATE contact_duplicate_candidate
       SET status = ?,
           resolved_by = ?,
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?
         AND clinic_id = ?`,
      [status, userId, candidateId, clinicId],
    );

    if (result.affectedRows === 0) {
      throw ApiError.notFound("Duplicate candidate not found");
    }

    await logAuditEvent({
      clinicId,
      userId,
      action: "CONTACT_DUPLICATE_RESOLVED",
      entityType: "contact_duplicate_candidate",
      entityId: candidateId,
      changes: { status },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  async markContacted(
    clinicId: string,
    userId: string,
    contactId: string,
    meta: RequestMeta = {},
  ) {
    return slaService.markContacted(clinicId, userId, contactId, meta);
  }

  async logLeadCallOutcome(
    clinicId: string,
    userId: string,
    contactId: string,
    data: Record<string, unknown>,
    context: ContactDrawerActionContext,
  ): Promise<ContactDrawerActionResult> {
    this.requireDrawerPermission(context, "calls:write");
    await this.getContact(clinicId, contactId);
    await this.assertCallLinkedToContact(clinicId, contactId, String(data.callId || ""));

    const callUpdate: Record<string, unknown> = {};
    if (data.commercialOutcome !== undefined) callUpdate.commercialOutcome = data.commercialOutcome;
    if (data.bookingIntent !== undefined) callUpdate.bookingIntent = data.bookingIntent;
    if (data.notes !== undefined) callUpdate.notes = data.notes;
    if (data.qualityScore !== undefined) callUpdate.qualityScore = data.qualityScore === null ? null : Number(data.qualityScore);
    if (data.sentiment !== undefined) callUpdate.sentiment = data.sentiment;
    if (data.treatmentMentioned !== undefined) callUpdate.treatmentMentioned = data.treatmentMentioned;
    if (data.missedRecoveryStatus !== undefined) callUpdate.missedRecoveryStatus = data.missedRecoveryStatus;

    const call = await callsService.updateCall(clinicId, userId, String(data.callId), callUpdate as any);

    return {
      action: "log_call_outcome",
      record: call,
      activity: await this.getContactLinkedActivity(clinicId, contactId, context),
    };
  }

  async sendLeadMessageTemplate(
    clinicId: string,
    userId: string,
    contactId: string,
    data: SendContactMessageTemplateDTO,
    context: ContactDrawerActionContext,
  ): Promise<ContactDrawerActionResult> {
    this.requireDrawerPermission(context, "marketing:read");
    const contact = await this.getContact(clinicId, contactId);
    const rendered = await messageTemplatesService.renderTemplate(clinicId, data.templateId, {
      patient_name: contact.name,
      first_name: contact.firstName || "",
      last_name: contact.lastName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      lead_source: contact.source || "",
      status: contact.status || "",
      treatment: contact.treatmentInterests[0] || "",
      ...(data.variables || {}),
    });
    const channel = data.channel || rendered.template.channel;
    const status = data.sendNow ? "sent" : "queued";
    const messageId = uuidv4();

    if (channel === "sms") {
      await pool.execute(
        `INSERT INTO sms (id, clinic_id, contact_id, user_id, message, direction, status, provider_response)
         VALUES (?, ?, ?, ?, ?, 'outbound', ?, ?)`,
        [
          messageId,
          clinicId,
          contactId,
          userId,
          rendered.body,
          status,
          JSON.stringify({ source: "lead_drawer", templateId: data.templateId }),
        ],
      );
    } else {
      await pool.execute(
        `INSERT INTO email (id, clinic_id, contact_id, user_id, subject, body, direction, status)
         VALUES (?, ?, ?, ?, ?, ?, 'outbound', ?)`,
        [
          messageId,
          clinicId,
          contactId,
          userId,
          rendered.subject || rendered.template.name,
          rendered.body,
          status,
        ],
      );
    }

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: channel === "sms" ? "SMS" : "Email",
      metadata: buildTimelineMetadata({
        action: "lead_drawer.message_template",
        source: "contact",
        recordId: messageId,
        changes: { templateId: data.templateId, channel, status },
      }),
    });
    await logAuditEvent({
      clinicId,
      userId,
      action: "LEAD_DRAWER_MESSAGE_TEMPLATE_QUEUED",
      entityType: channel,
      entityId: messageId,
      changes: { contactId, templateId: data.templateId, channel, status },
    });

    return {
      action: "send_message_template",
      record: { id: messageId, channel, status, subject: rendered.subject || null },
      activity: await this.getContactLinkedActivity(clinicId, contactId, context),
    };
  }

  async createLeadBooking(
    clinicId: string,
    userId: string,
    contactId: string,
    data: Record<string, unknown>,
    context: ContactDrawerActionContext,
  ): Promise<ContactDrawerActionResult> {
    this.requireDrawerPermission(context, "appointments:write");
    await this.getContact(clinicId, contactId);

    const appointment = await appointmentsService.createAppointment(clinicId, userId, {
      contactId,
      dateTime: String(data.dateTime),
      clinicianId: data.clinicianId as any,
      status: data.status as any,
      treatment: data.treatment as any,
      valueCents: data.valueCents as any,
      durationMinutes: data.durationMinutes as any,
      noShowReason: data.noShowReason as any,
      consultNotes: data.consultNotes as any,
    });

    return {
      action: "create_booking",
      record: appointment as unknown as Record<string, unknown>,
      activity: await this.getContactLinkedActivity(clinicId, contactId, context),
    };
  }

  async recordLeadDeposit(
    clinicId: string,
    userId: string,
    contactId: string,
    data: Record<string, unknown>,
    context: ContactDrawerActionContext,
  ): Promise<ContactDrawerActionResult> {
    this.requireDrawerPermission(context, "reports:write");
    const contact = await this.getContact(clinicId, contactId);

    if (data.appointmentId) {
      await this.assertAppointmentLinkedToContact(clinicId, contactId, String(data.appointmentId));
    }

    if (data.depositId) {
      await this.assertDepositLinkedToContact(clinicId, contactId, String(data.depositId));
      await depositsService.updateDeposit(clinicId, userId, String(data.depositId), data as any);

      return {
        action: "record_deposit",
        record: { id: String(data.depositId), updated: true },
        activity: await this.getContactLinkedActivity(clinicId, contactId, context),
      };
    }

    const depositId = await depositsService.createDeposit(clinicId, userId, {
      contact: String(data.contact || contact.name),
      contactId,
      appointmentId: data.appointmentId as any,
      treatment: String(data.treatment || contact.treatmentInterests[0] || "Consultation"),
      appointmentDate: data.appointmentDate as any,
      depositAmount: data.depositAmount as any,
      depositPaid: data.depositPaid as any,
      paidDate: data.paidDate as any,
      method: data.method as any,
      showedUp: data.showedUp as any,
      practitioner: data.practitioner as any,
      status: data.status as any,
    });

    return {
      action: "record_deposit",
      record: { id: depositId, created: true },
      activity: await this.getContactLinkedActivity(clinicId, contactId, context),
    };
  }

  async createLeadTask(
    clinicId: string,
    userId: string,
    contactId: string,
    data: Record<string, unknown>,
    context: ContactDrawerActionContext,
  ): Promise<ContactDrawerActionResult> {
    this.requireDrawerPermission(context, "events:write");
    const contact = await this.getContact(clinicId, contactId);
    const taskId = await tasksService.createTask(clinicId, userId, {
      title: String(data.title),
      description: data.description as any,
      priority: data.priority as any,
      status: data.status as any,
      category: data.category as any,
      contact: contact.name,
      due: data.due as any,
      dueDate: data.dueDate as any,
      assignedTo: data.assignedTo as any,
    });

    await logTimelineActivity({
      clinicId,
      contactId,
      userId,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "lead_drawer.task_created",
        source: "contact",
        recordId: taskId,
        changes: { title: data.title },
      }),
    });

    return {
      action: "create_task",
      record: { id: taskId, created: true },
      activity: await this.getContactLinkedActivity(clinicId, contactId, context),
    };
  }

  private async listLinkedCalls(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              direction,
              call_status as status,
              outcome,
              disposition,
              missed_call as missedCall,
              duration,
              source,
              recording_url as recordingUrl,
              notes,
              started_at as startedAt,
              created_at as createdAt
       FROM ${CALL_TABLE}
       WHERE clinic_id = ?
         AND contact_id = ?
         AND deleted_at IS NULL
       ORDER BY COALESCE(started_at, created_at) DESC
       LIMIT 20`,
      [clinicId, contactId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      direction: row.direction || null,
      status: row.status || null,
      outcome: row.outcome || null,
      disposition: row.disposition || null,
      missedCall: Boolean(row.missedCall),
      duration: Number(row.duration || 0),
      source: row.source || null,
      recordingUrl: row.recordingUrl || null,
      notes: row.notes || null,
      startedAt: row.startedAt ? new Date(row.startedAt).toISOString() : null,
      createdAt: new Date(row.createdAt).toISOString(),
      href: `/app/calls?id=${encodeURIComponent(row.id)}`,
      actions: ["log_call_outcome"],
    }));
  }

  private async listLinkedAppointments(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT a.id,
              a.date_time as dateTime,
              a.status,
              a.treatment,
              a.value,
              a.no_show_reason as noShowReason,
              a.consult_notes as consultNotes,
              a.created_at as createdAt,
              TRIM(CONCAT_WS(' ', u.first_name, u.last_name)) as clinicianName
       FROM appointment a
       LEFT JOIN user u ON u.id = a.clinician_id AND u.deleted_at IS NULL
       WHERE a.clinic_id = ?
         AND a.contact_id = ?
         AND a.deleted_at IS NULL
       ORDER BY a.date_time DESC
       LIMIT 20`,
      [clinicId, contactId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      dateTime: new Date(row.dateTime).toISOString(),
      status: row.status || "Scheduled",
      treatment: row.treatment || null,
      value: Number(row.value || 0),
      clinicianName: row.clinicianName || null,
      noShowReason: row.noShowReason || null,
      consultNotes: row.consultNotes || null,
      createdAt: new Date(row.createdAt).toISOString(),
      href: `/app/appointments?id=${encodeURIComponent(row.id)}`,
      actions: ["update_booking", "record_deposit"],
    }));
  }

  private async listLinkedForms(clinicId: string, contact: ContactResponse) {
    const values: any[] = [contact.id, clinicId];
    const matches = ["c.external_id = fs.id"];

    if (contact.email) {
      matches.push("LOWER(JSON_UNQUOTE(JSON_EXTRACT(fs.submitted_data, '$.email'))) = LOWER(?)");
      values.push(contact.email);
    }

    if (contact.phone) {
      matches.push("JSON_UNQUOTE(JSON_EXTRACT(fs.submitted_data, '$.phone')) = ?");
      values.push(contact.phone);
    }

    const [rows]: any = await pool.execute(
      `SELECT fs.id,
              fs.form_id as formId,
              fd.name as formName,
              fs.submitted_data as submittedData,
              fs.submitted_at as submittedAt
       FROM form_submission fs
       JOIN form_definition fd ON fd.id = fs.form_id AND fd.deleted_at IS NULL
       LEFT JOIN contact c ON c.id = ? AND c.clinic_id = fs.clinic_id AND c.deleted_at IS NULL
       WHERE fs.clinic_id = ?
         AND fs.deleted_at IS NULL
         AND (${matches.join(" OR ")})
       ORDER BY fs.submitted_at DESC
       LIMIT 20`,
      values,
    );

    return rows.map((row: any) => {
      const submittedData = parseJsonObject(row.submittedData) || {};
      const source = stringValue(submittedData.source || submittedData.utm_source);
      const treatment = stringValue(submittedData.treatment || submittedData.treatmentInterest);
      const status = stringValue(submittedData.status) || "new";
      const summary = stringValue(
        submittedData.message ||
          submittedData.notes ||
          submittedData.enquiry ||
          submittedData.fullName ||
          submittedData.name,
      );

      return {
        id: row.id,
        formId: row.formId,
        formName: row.formName,
        submittedAt: new Date(row.submittedAt).toISOString(),
        source,
        treatment,
        status,
        summary: summary || "Form submission received",
        href: `/app/forms/submissions?id=${encodeURIComponent(row.id)}`,
        actions: ["open_form_submission"],
      };
    });
  }

  private async listLinkedMessages(clinicId: string, contactId: string) {
    const [rows]: any = await pool.execute(
      `SELECT *
       FROM (
         SELECT e.id,
                'email' as channel,
                e.direction,
                e.status,
                e.subject,
                COALESCE(e.body, e.subject, '') as preview,
                e.created_at as timestamp
         FROM email e
         WHERE e.clinic_id = ?
           AND e.contact_id = ?
           AND e.deleted_at IS NULL
         UNION ALL
         SELECT s.id,
                'sms' as channel,
                s.direction,
                s.status,
                NULL as subject,
                s.message as preview,
                s.created_at as timestamp
         FROM sms s
         WHERE s.clinic_id = ?
           AND s.contact_id = ?
           AND s.deleted_at IS NULL
       ) messages
       ORDER BY timestamp DESC
       LIMIT 30`,
      [clinicId, contactId, clinicId, contactId],
    );

    return rows.map((row: any) => ({
      id: row.id,
      channel: row.channel,
      direction: row.direction || null,
      status: row.status || null,
      subject: row.subject || null,
      preview: String(row.preview || "").slice(0, 180),
      timestamp: new Date(row.timestamp).toISOString(),
      href: `/app/comms?contactId=${encodeURIComponent(contactId)}&messageId=${encodeURIComponent(row.id)}`,
      actions: ["open_message_thread"],
    }));
  }

  private async listLinkedDeposits(clinicId: string, contact: ContactResponse) {
    const values: any[] = [clinicId, contact.id];
    let matchSql = "contact_id = ?";

    if (contact.name) {
      matchSql += " OR contact_name = ?";
      values.push(contact.name);
    }

    const [rows]: any = await pool.execute(
      `SELECT id,
              contact_name as contact,
              appointment_id as appointmentId,
              treatment,
              appointment_date as appointmentDate,
              deposit_amount as depositAmount,
              deposit_paid as depositPaid,
              paid_date as paidDate,
              method,
              status,
              payment_status as paymentStatus
       FROM deposit_record
       WHERE clinic_id = ?
         AND deleted_at IS NULL
         AND (${matchSql})
       ORDER BY COALESCE(paid_date, appointment_date, created_at) DESC
       LIMIT 20`,
      values,
    );

    return rows.map((row: any) => ({
      id: row.id,
      contact: row.contact,
      appointmentId: row.appointmentId || null,
      treatment: row.treatment,
      appointmentDate: row.appointmentDate ? new Date(row.appointmentDate).toISOString() : null,
      depositAmount: Number(row.depositAmount || 0),
      depositPaid: Boolean(row.depositPaid),
      paidDate: row.paidDate ? new Date(row.paidDate).toISOString() : null,
      method: row.method || null,
      status: row.status || "unpaid",
      paymentStatus: row.paymentStatus || null,
      href: `/app/deposits?id=${encodeURIComponent(row.id)}`,
      actions: ["record_deposit"],
    }));
  }

  private async listLinkedTasks(clinicId: string, contact: ContactResponse) {
    const [rows]: any = await pool.execute(
      `SELECT id,
              title,
              description,
              priority,
              status,
              category,
              due_label as due,
              DATE_FORMAT(due_date, '%Y-%m-%d') as dueDate,
              assigned_to as assignedTo
       FROM task
       WHERE clinic_id = ?
         AND is_internal = 0
         AND deleted_at IS NULL
         AND contact_name = ?
       ORDER BY status ASC, due_date IS NULL ASC, due_date ASC, created_at DESC
       LIMIT 20`,
      [clinicId, contact.name],
    );

    return rows.map((row: any) => ({  
      id: row.id,
      title: row.title,
      description: row.description || null,
      priority: row.priority || "medium",
      status: row.status || "pending",
      category: row.category || null,
      due: row.due || null,
      dueDate: row.dueDate || null,
      assignedTo: row.assignedTo || null,
      href: `/app/tasks?id=${encodeURIComponent(row.id)}`,
      actions: ["update_task"],
    }));
  }

  private requireDrawerPermission(context: ContactDrawerActionContext, permission: string) {
    if (context.permissions?.[permission] === true) return;
    throw ApiError.forbidden("You do not have permission to perform this action");
  }

  private async assertCallLinkedToContact(clinicId: string, contactId: string, callId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM ${CALL_TABLE}
       WHERE clinic_id = ?
         AND contact_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, contactId, callId],
    );

    if (!rows[0]) throw ApiError.notFound("Call not found");
  }

  private async assertAppointmentLinkedToContact(clinicId: string, contactId: string, appointmentId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM appointment
       WHERE clinic_id = ?
         AND contact_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, contactId, appointmentId],
    );

    if (!rows[0]) throw ApiError.notFound("Appointment not found");
  }

  private async assertDepositLinkedToContact(clinicId: string, contactId: string, depositId: string) {
    const [rows]: any = await pool.execute(
      `SELECT id
       FROM deposit_record
       WHERE clinic_id = ?
         AND contact_id = ?
         AND id = ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, contactId, depositId],
    );

    if (!rows[0]) throw ApiError.notFound("Deposit record not found");
  }
}

export const contactsService = new ContactsService();

function stringValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}
