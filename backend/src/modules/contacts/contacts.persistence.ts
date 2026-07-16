import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import {
  cleanString,
  normalizeAccountNameForMatch,
  normalizeEmail,
  normalizePhone,
  normalizeWebsiteDomain,
} from "./contacts.normalizers.js";
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
  const columns = [
    "id", "clinic_id", "account_name", "contact_role", "communication_permissions", "first_name", "last_name", "email", "phone",
    "role_title", "email_permission", "phone_permission", "sms_permission", "whatsapp_permission",
    "unsubscribed", "do_not_contact", "permission_source", "opt_in_at", "opt_out_at", "consent_updated_at",
    "website", "date_of_birth", "gender", "address", "city", "state", "postal_code", "country", "tags", "status", "lead_status", "source", "value",
    "first_source", "latest_source", "converting_source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "landing_page", "referrer", "form_submitted", "page_submitted", "cta_clicked", "gclid", "fbclid", "msclkid", "ttclid", "gbraid", "wbraid",
    "treatment_interests", "package_interest", "recommended_package", "notes", "last_contact_at", "external_id",
  ];
  const values = [
    contactId,
    clinicId,
    contact.accountName,
    contact.role,
    JSON.stringify(contact.communicationPermissions),
    contact.firstName,
    contact.lastName,
    contact.email,
    contact.phone,
    contact.roleTitle,
    contact.emailPermission,
    contact.phonePermission,
    contact.smsPermission,
    contact.whatsappPermission,
    contact.unsubscribed,
    contact.doNotContact,
    contact.permissionSource,
    contact.optInAt,
    contact.optOutAt,
    contact.consentUpdatedAt,
    contact.website,
    contact.dateOfBirth,
    contact.gender,
    contact.address,
    contact.city,
    contact.state,
    contact.postalCode,
    contact.country,
    JSON.stringify(contact.tags),
    contact.status || "lead",
    contact.leadStatus || "new",
    contact.source,
    contact.value || 0,
    contact.firstSource,
    contact.latestSource,
    contact.convertingSource,
    contact.utmSource,
    contact.utmMedium,
    contact.utmCampaign,
    contact.utmContent,
    contact.utmTerm,
    contact.landingPage,
    contact.referrer,
    contact.formSubmitted,
    contact.pageSubmitted,
    contact.ctaClicked,
    contact.gclid,
    contact.fbclid,
    contact.msclkid,
    contact.ttclid,
    contact.gbraid,
    contact.wbraid,
    JSON.stringify(contact.treatmentInterests),
    contact.packageInterest,
    contact.recommendedPackage,
    contact.notes,
    contact.lastContactAt,
    contact.externalId,
  ];

  await pool.execute(
    `INSERT INTO contact (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );
}

// Find likely manual-create duplicates inside the same clinic
export async function findDuplicateContacts(
  clinicId: string,
  contact: NormalizedContactData,
): Promise<DuplicateContactMatch[]> {
  const clauses: string[] = [];
  const values: any[] = [clinicId];
  const websiteDomain = normalizeWebsiteDomain(contact.website);
  const accountMatchName = normalizeAccountNameForMatch(contact.accountName);

  if (contact.email) {
    clauses.push("LOWER(TRIM(c.email)) = ?");
    values.push(contact.email);
  }

  if (websiteDomain) {
    clauses.push(
      "LOWER(REGEXP_REPLACE(REGEXP_REPLACE(REGEXP_REPLACE(COALESCE(c.website, ''), '^https?://', ''), '^www[.]', ''), '[/?#].*$', '')) = ?",
    );
    values.push(websiteDomain);
  }

  if (contact.phone) {
    clauses.push(`${phoneSqlExpression("c.phone")} = ?`);
    values.push(contact.phone);
  }

  if (contact.firstName && contact.lastName) {
    clauses.push("(LOWER(TRIM(c.first_name)) = ? AND LOWER(TRIM(c.last_name)) = ?)");
    values.push(contact.firstName.toLowerCase(), contact.lastName.toLowerCase());
  }

  if (contact.accountName) {
    clauses.push("LOWER(TRIM(c.account_name)) = ?");
    values.push(contact.accountName.toLowerCase());
  }

  if (clauses.length === 0) return [];

  const [rows]: any = await pool.execute(
    `SELECT c.id,
            c.email,
            c.phone,
            c.website,
            c.account_name as accountName,
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

  const matches = rows.map((row: any) => {
    const emailMatches = contact.email && normalizeEmail(row.email) === contact.email;
    const websiteMatches = websiteDomain && normalizeWebsiteDomain(row.website) === websiteDomain;
    const phoneMatches = contact.phone && normalizePhone(row.phone) === contact.phone;
    const accountNameMatches = accountMatchName
      && normalizeAccountNameForMatch(row.accountName) === accountMatchName;
    const nameMatches = contact.firstName
      && contact.lastName
      && cleanString(row.firstName)?.toLowerCase() === contact.firstName.toLowerCase()
      && cleanString(row.lastName)?.toLowerCase() === contact.lastName.toLowerCase();

    if (emailMatches) return { existingContactId: row.id, matchType: "email", score: 100 };
    if (phoneMatches) return { existingContactId: row.id, matchType: "phone", score: 95 };
    if (websiteMatches) return { existingContactId: row.id, matchType: "website_domain", score: 90 };
    if (accountNameMatches) return { existingContactId: row.id, matchType: "account_name", score: 72 };
    if (nameMatches) return { existingContactId: row.id, matchType: "name", score: 70 };
    return { existingContactId: row.id, matchType: "unknown", score: 50 };
  });

  const strongestByContact = new Map<string, DuplicateContactMatch>();
  for (const match of matches) {
    const current = strongestByContact.get(match.existingContactId);
    if (!current || match.score > current.score) {
      strongestByContact.set(match.existingContactId, match);
    }
  }

  return [...strongestByContact.values()].sort((a, b) => b.score - a.score);
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
  const columns = [
    "id", "clinic_id", "account_name", "contact_role", "communication_permissions", "first_name", "last_name", "email", "phone",
    "role_title", "email_permission", "phone_permission", "sms_permission", "whatsapp_permission",
    "unsubscribed", "do_not_contact", "permission_source", "opt_in_at", "opt_out_at", "consent_updated_at",
    "website", "date_of_birth", "gender", "address", "city", "state", "postal_code", "country", "tags", "status", "lead_status", "source", "value",
    "first_source", "latest_source", "converting_source", "utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term",
    "landing_page", "referrer", "form_submitted", "page_submitted", "cta_clicked", "gclid", "fbclid", "msclkid", "ttclid", "gbraid", "wbraid",
    "treatment_interests", "package_interest", "recommended_package", "notes", "last_contact_at", "import_batch_id", "external_id",
  ];
  const values = [
    contactId,
    clinicId,
    row.accountName,
    row.role,
    JSON.stringify(row.communicationPermissions),
    row.firstName,
    row.lastName,
    row.email,
    row.phone,
    row.roleTitle,
    row.emailPermission,
    row.phonePermission,
    row.smsPermission,
    row.whatsappPermission,
    row.unsubscribed,
    row.doNotContact,
    row.permissionSource,
    row.optInAt,
    row.optOutAt,
    row.consentUpdatedAt,
    row.website,
    row.dateOfBirth,
    row.gender,
    row.address,
    row.city,
    row.state,
    row.postalCode,
    row.country,
    JSON.stringify(row.tags),
    row.status,
    row.leadStatus || "new",
    row.source,
    row.value || 0,
    row.firstSource,
    row.latestSource,
    row.convertingSource,
    row.utmSource,
    row.utmMedium,
    row.utmCampaign,
    row.utmContent,
    row.utmTerm,
    row.landingPage,
    row.referrer,
    row.formSubmitted,
    row.pageSubmitted,
    row.ctaClicked,
    row.gclid,
    row.fbclid,
    row.msclkid,
    row.ttclid,
    row.gbraid,
    row.wbraid,
    JSON.stringify(row.treatmentInterests),
    row.packageInterest,
    row.recommendedPackage,
    row.notes,
    row.lastContactAt,
    batchId,
    row.externalId,
  ];

  await pool.execute(
    `INSERT INTO contact (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
    values,
  );

  return contactId;
}

export async function mergeStrongDuplicateIntoContact(
  contactId: string,
  clinicId: string,
  row: NormalizedContactData,
) {
  const notePrefix = `[Duplicate submission ${new Date().toISOString().slice(0, 10)}]`;
  const appendedNote = row.notes ? `${notePrefix}\n${row.notes}` : null;

  await pool.execute(
    `UPDATE contact
     SET account_name = COALESCE(account_name, ?),
         contact_role = COALESCE(contact_role, ?),
         communication_permissions = CASE
           WHEN communication_permissions IS NULL THEN ?
           ELSE communication_permissions
         END,
         first_name = COALESCE(first_name, ?),
         last_name = COALESCE(last_name, ?),
         email = COALESCE(email, ?),
         phone = COALESCE(phone, ?),
         role_title = COALESCE(role_title, ?),
         email_permission = CASE WHEN ? = 0 THEN 0 ELSE COALESCE(email_permission, ?) END,
         phone_permission = CASE WHEN ? = 0 THEN 0 ELSE COALESCE(phone_permission, ?) END,
         sms_permission = CASE WHEN ? = 0 THEN 0 ELSE COALESCE(sms_permission, ?) END,
         whatsapp_permission = CASE WHEN ? = 0 THEN 0 ELSE COALESCE(whatsapp_permission, ?) END,
         unsubscribed = CASE WHEN ? IS NULL THEN unsubscribed ELSE GREATEST(COALESCE(unsubscribed, 0), ?) END,
         do_not_contact = CASE WHEN ? IS NULL THEN do_not_contact ELSE GREATEST(COALESCE(do_not_contact, 0), ?) END,
         permission_source = COALESCE(?, permission_source),
         opt_in_at = COALESCE(opt_in_at, ?),
         opt_out_at = COALESCE(?, opt_out_at),
         consent_updated_at = COALESCE(?, consent_updated_at),
         website = COALESCE(website, ?),
         date_of_birth = COALESCE(date_of_birth, ?),
         gender = COALESCE(gender, ?),
         address = COALESCE(address, ?),
         city = COALESCE(city, ?),
         state = COALESCE(state, ?),
         postal_code = COALESCE(postal_code, ?),
         country = COALESCE(country, ?),
         tags = CASE
           WHEN JSON_LENGTH(COALESCE(tags, JSON_ARRAY())) = 0 THEN ?
           ELSE tags
         END,
         status = COALESCE(status, ?),
         lead_status = COALESCE(lead_status, ?),
         source = COALESCE(source, ?),
         first_source = COALESCE(first_source, ?),
         latest_source = COALESCE(?, latest_source),
         converting_source = COALESCE(?, converting_source),
         utm_source = COALESCE(?, utm_source),
         utm_medium = COALESCE(?, utm_medium),
         utm_campaign = COALESCE(?, utm_campaign),
         utm_content = COALESCE(?, utm_content),
         utm_term = COALESCE(?, utm_term),
         landing_page = COALESCE(?, landing_page),
         referrer = COALESCE(?, referrer),
         form_submitted = COALESCE(?, form_submitted),
         page_submitted = COALESCE(?, page_submitted),
         cta_clicked = COALESCE(?, cta_clicked),
         gclid = COALESCE(?, gclid),
         fbclid = COALESCE(?, fbclid),
         msclkid = COALESCE(?, msclkid),
         ttclid = COALESCE(?, ttclid),
         gbraid = COALESCE(?, gbraid),
         wbraid = COALESCE(?, wbraid),
         value = CASE WHEN COALESCE(value, 0) = 0 THEN ? ELSE value END,
         treatment_interests = CASE
           WHEN JSON_LENGTH(COALESCE(treatment_interests, JSON_ARRAY())) = 0 THEN ?
           ELSE treatment_interests
         END,
         package_interest = COALESCE(package_interest, ?),
         recommended_package = COALESCE(recommended_package, ?),
         notes = CASE
           WHEN ? IS NULL THEN notes
           WHEN notes IS NULL OR notes = '' THEN ?
           WHEN LOCATE(?, notes) > 0 THEN notes
           ELSE CONCAT(notes, '\n\n', ?, '\n', ?)
         END,
         last_contact_at = COALESCE(?, last_contact_at),
         external_id = COALESCE(external_id, ?),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
    [
      row.accountName,
      row.role,
      JSON.stringify(row.communicationPermissions),
      row.firstName,
      row.lastName,
      row.email,
      row.phone,
      row.roleTitle,
      row.emailPermission,
      row.emailPermission,
      row.phonePermission,
      row.phonePermission,
      row.smsPermission,
      row.smsPermission,
      row.whatsappPermission,
      row.whatsappPermission,
      row.unsubscribed,
      row.unsubscribed,
      row.doNotContact,
      row.doNotContact,
      row.permissionSource,
      row.optInAt,
      row.optOutAt,
      row.consentUpdatedAt,
      row.website,
      row.dateOfBirth,
      row.gender,
      row.address,
      row.city,
      row.state,
      row.postalCode,
      row.country,
      JSON.stringify(row.tags),
      row.status || "lead",
      row.leadStatus || "new",
      row.source,
      row.firstSource,
      row.latestSource,
      row.convertingSource,
      row.utmSource,
      row.utmMedium,
      row.utmCampaign,
      row.utmContent,
      row.utmTerm,
      row.landingPage,
      row.referrer,
      row.formSubmitted,
      row.pageSubmitted,
      row.ctaClicked,
      row.gclid,
      row.fbclid,
      row.msclkid,
      row.ttclid,
      row.gbraid,
      row.wbraid,
      row.value || 0,
      row.firstSource,
      row.latestSource,
      row.convertingSource,
      row.utmSource,
      row.utmMedium,
      row.utmCampaign,
      row.utmContent,
      row.utmTerm,
      row.landingPage,
      row.referrer,
      row.formSubmitted,
      row.pageSubmitted,
      row.ctaClicked,
      row.gclid,
      row.fbclid,
      row.msclkid,
      row.ttclid,
      row.gbraid,
      row.wbraid,
      JSON.stringify(row.treatmentInterests),
      row.packageInterest,
      row.recommendedPackage,
      appendedNote,
      appendedNote,
      row.notes || "",
      notePrefix,
      row.notes,
      row.lastContactAt,
      row.externalId,
      contactId,
      clinicId,
    ],
  );
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
         account_name = COALESCE(?, account_name),
         contact_role = COALESCE(?, contact_role),
         last_name = COALESCE(?, last_name),
         email = COALESCE(?, email),
         phone = COALESCE(?, phone),
         role_title = COALESCE(?, role_title),
         email_permission = COALESCE(?, email_permission),
         phone_permission = COALESCE(?, phone_permission),
         sms_permission = COALESCE(?, sms_permission),
         whatsapp_permission = COALESCE(?, whatsapp_permission),
         unsubscribed = CASE WHEN ? IS NULL THEN unsubscribed ELSE GREATEST(COALESCE(unsubscribed, 0), ?) END,
         do_not_contact = CASE WHEN ? IS NULL THEN do_not_contact ELSE GREATEST(COALESCE(do_not_contact, 0), ?) END,
         permission_source = COALESCE(?, permission_source),
         opt_in_at = COALESCE(opt_in_at, ?),
         opt_out_at = COALESCE(?, opt_out_at),
         consent_updated_at = COALESCE(?, consent_updated_at),
         website = COALESCE(?, website),
         date_of_birth = COALESCE(?, date_of_birth),
         gender = COALESCE(?, gender),
         address = COALESCE(?, address),
         city = COALESCE(?, city),
         state = COALESCE(?, state),
         postal_code = COALESCE(?, postal_code),
         country = COALESCE(?, country),
         tags = ?,
         status = COALESCE(?, status),
         lead_status = COALESCE(?, lead_status),
         source = COALESCE(?, source),
         first_source = COALESCE(first_source, ?),
         latest_source = COALESCE(?, latest_source),
         converting_source = COALESCE(?, converting_source),
         utm_source = COALESCE(?, utm_source),
         utm_medium = COALESCE(?, utm_medium),
         utm_campaign = COALESCE(?, utm_campaign),
         utm_content = COALESCE(?, utm_content),
         utm_term = COALESCE(?, utm_term),
         landing_page = COALESCE(?, landing_page),
         referrer = COALESCE(?, referrer),
         form_submitted = COALESCE(?, form_submitted),
         page_submitted = COALESCE(?, page_submitted),
         cta_clicked = COALESCE(?, cta_clicked),
         gclid = COALESCE(?, gclid),
         fbclid = COALESCE(?, fbclid),
         msclkid = COALESCE(?, msclkid),
         ttclid = COALESCE(?, ttclid),
         gbraid = COALESCE(?, gbraid),
         wbraid = COALESCE(?, wbraid),
         value = COALESCE(?, value),
         treatment_interests = ?,
         package_interest = COALESCE(?, package_interest),
         recommended_package = COALESCE(?, recommended_package),
         notes = COALESCE(?, notes),
         last_contact_at = COALESCE(?, last_contact_at),
         import_batch_id = ?,
         external_id = COALESCE(?, external_id),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND clinic_id = ?`,
    [
      row.firstName,
      row.accountName,
      row.role,
      row.lastName,
      row.email,
      row.phone,
      row.roleTitle,
      row.emailPermission,
      row.phonePermission,
      row.smsPermission,
      row.whatsappPermission,
      row.unsubscribed,
      row.unsubscribed,
      row.doNotContact,
      row.doNotContact,
      row.permissionSource,
      row.optInAt,
      row.optOutAt,
      row.consentUpdatedAt,
      row.website,
      row.dateOfBirth,
      row.gender,
      row.address,
      row.city,
      row.state,
      row.postalCode,
      row.country,
      JSON.stringify(row.tags),
      row.status,
      row.leadStatus,
      row.source,
      row.firstSource,
      row.latestSource,
      row.convertingSource,
      row.utmSource,
      row.utmMedium,
      row.utmCampaign,
      row.utmContent,
      row.utmTerm,
      row.landingPage,
      row.referrer,
      row.formSubmitted,
      row.pageSubmitted,
      row.ctaClicked,
      row.gclid,
      row.fbclid,
      row.msclkid,
      row.ttclid,
      row.gbraid,
      row.wbraid,
      row.value,
      JSON.stringify(row.treatmentInterests),
      row.packageInterest,
      row.recommendedPackage,
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
