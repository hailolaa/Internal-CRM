import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { cleanString, normalizeEmail, normalizePhone } from "./contacts.normalizers.js";
import { phoneSqlExpression } from "./contacts.queries.js";
import type {
  DuplicateCandidateResponse,
  DuplicateContactMatch,
  NormalizedContactData,
  NormalizedImportContactData,
} from "./contacts.types.js";

// Insert one manually created lead/contact record
export async function insertContact(
  clinicId: string,
  contactId: string,
  contact: NormalizedContactData,
) {
  await pool.execute(
    `INSERT INTO contact
      (id, clinic_id, first_name, last_name, email, phone, date_of_birth, gender,
       address, city, state, postal_code, country, tags, status, source, value,
       treatment_interests, notes, last_contact_at, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contactId,
      clinicId,
      contact.firstName,
      contact.lastName,
      contact.email,
      contact.phone,
      contact.dateOfBirth,
      contact.gender,
      contact.address,
      contact.city,
      contact.state,
      contact.postalCode,
      contact.country,
      JSON.stringify(contact.tags),
      contact.status || "lead",
      contact.source,
      contact.value || 0,
      JSON.stringify(contact.treatmentInterests),
      contact.notes,
      contact.lastContactAt,
      contact.externalId,
    ],
  );
}

// Find likely manual-create duplicates inside the same clinic
export async function findDuplicateContacts(
  clinicId: string,
  contact: NormalizedContactData,
): Promise<DuplicateContactMatch[]> {
  const clauses: string[] = [];
  const values: any[] = [clinicId];

  if (contact.email) {
    clauses.push("LOWER(TRIM(c.email)) = ?");
    values.push(contact.email);
  }

  if (contact.phone) {
    clauses.push(`${phoneSqlExpression("c.phone")} = ?`);
    values.push(contact.phone);
  }

  if (contact.firstName && contact.lastName) {
    clauses.push("(LOWER(TRIM(c.first_name)) = ? AND LOWER(TRIM(c.last_name)) = ?)");
    values.push(contact.firstName.toLowerCase(), contact.lastName.toLowerCase());
  }

  if (clauses.length === 0) return [];

  const [rows]: any = await pool.execute(
    `SELECT c.id,
            c.email,
            c.phone,
            c.first_name as firstName,
            c.last_name as lastName
     FROM contact c
     WHERE c.clinic_id = ?
       AND c.deleted_at IS NULL
       AND (${clauses.join(" OR ")})
     ORDER BY c.updated_at DESC
     LIMIT 5`,
    values,
  );

  return rows.map((row: any) => {
    const emailMatches = contact.email && normalizeEmail(row.email) === contact.email;
    const phoneMatches = contact.phone && normalizePhone(row.phone) === contact.phone;
    const nameMatches = contact.firstName
      && contact.lastName
      && cleanString(row.firstName)?.toLowerCase() === contact.firstName.toLowerCase()
      && cleanString(row.lastName)?.toLowerCase() === contact.lastName.toLowerCase();

    if (emailMatches) return { existingContactId: row.id, matchType: "email", score: 100 };
    if (phoneMatches) return { existingContactId: row.id, matchType: "phone", score: 90 };
    if (nameMatches) return { existingContactId: row.id, matchType: "name", score: 70 };
    return { existingContactId: row.id, matchType: "unknown", score: 50 };
  });
}

// Import upsert uses the strongest deterministic email/phone match
export async function findExistingContact(
  clinicId: string,
  email: string | null,
  phone: string | null,
) {
  if (!email && !phone) return null;

  const [rows]: any = await pool.execute(
    `SELECT id,
            CASE
              WHEN ? IS NOT NULL AND LOWER(TRIM(email)) = ? THEN 'email'
              WHEN ? IS NOT NULL AND ${phoneSqlExpression("phone")} = ? THEN 'phone'
              ELSE 'unknown'
            END as matchType
     FROM contact
     WHERE clinic_id = ?
       AND deleted_at IS NULL
       AND (
         (? IS NOT NULL AND LOWER(TRIM(email)) = ?)
         OR
         (? IS NOT NULL AND ${phoneSqlExpression("phone")} = ?)
       )
     ORDER BY updated_at DESC
     LIMIT 1`,
    [email, email, phone, phone, clinicId, email, email, phone, phone],
  );

  return rows.length > 0 ? rows[0] : null;
}

// Insert a row from the spreadsheet import path
export async function insertImportedContact(
  clinicId: string,
  row: NormalizedImportContactData,
  batchId: string,
) {
  const contactId = uuidv4();

  await pool.execute(
    `INSERT INTO contact
      (id, clinic_id, first_name, last_name, email, phone, date_of_birth, gender,
       address, city, state, postal_code, country, tags, status, source, value,
       treatment_interests, notes, last_contact_at, import_batch_id, external_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      contactId,
      clinicId,
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.dateOfBirth,
      row.gender,
      row.address,
      row.city,
      row.state,
      row.postalCode,
      row.country,
      JSON.stringify(row.tags),
      row.status,
      row.source,
      row.value || 0,
      JSON.stringify(row.treatmentInterests),
      row.notes,
      row.lastContactAt,
      batchId,
      row.externalId,
    ],
  );

  return contactId;
}

// Upsert imports fill missing contact fields without replacing useful existing data
export async function updateImportedContact(
  contactId: string,
  clinicId: string,
  row: NormalizedImportContactData,
  batchId: string,
) {
  await pool.execute(
    `UPDATE contact
     SET first_name = COALESCE(?, first_name),
         last_name = COALESCE(?, last_name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         date_of_birth = COALESCE(?, date_of_birth),
         gender = COALESCE(?, gender),
         address = COALESCE(?, address),
         city = COALESCE(?, city),
         state = COALESCE(?, state),
         postal_code = COALESCE(?, postal_code),
         country = COALESCE(?, country),
         tags = ?,
         status = COALESCE(?, status),
         source = COALESCE(?, source),
         value = COALESCE(?, value),
         treatment_interests = ?,
         notes = COALESCE(?, notes),
         last_contact_at = COALESCE(?, last_contact_at),
         import_batch_id = ?,
         external_id = COALESCE(?, external_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND clinic_id = ?`,
    [
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.dateOfBirth,
      row.gender,
      row.address,
      row.city,
      row.state,
      row.postalCode,
      row.country,
      JSON.stringify(row.tags),
      row.status,
      row.source,
      row.value,
      JSON.stringify(row.treatmentInterests),
      row.notes,
      row.lastContactAt,
      batchId,
      row.externalId,
      contactId,
      clinicId,
    ],
  );
}

// Store duplicate review records shared by manual create and import flows
export async function createDuplicateCandidate(input: {
  clinicId: string;
  batchId: string | null;
  existingContactId: string | null;
  candidateContactId: string | null;
  matchType: string;
  score: number;
  candidateData: Record<string, unknown>;
}): Promise<DuplicateCandidateResponse> {
  const id = uuidv4();
  const createdAt = new Date().toISOString();
  await pool.execute(
    `INSERT INTO contact_duplicate_candidate
      (id, clinic_id, import_batch_id, existing_contact_id, candidate_contact_id,
       match_type, score, status, candidate_data)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)`,
    [
      id,
      input.clinicId,
      input.batchId,
      input.existingContactId,
      input.candidateContactId,
      input.matchType,
      input.score,
      JSON.stringify(input.candidateData),
    ],
  );

  return {
    id,
    existingContactId: input.existingContactId,
    candidateContactId: input.candidateContactId,
    existingContact: null,
    candidateContact: null,
    matchType: input.matchType,
    score: input.score,
    status: "open",
    candidateData: input.candidateData,
    createdAt,
  };
}
