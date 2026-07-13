import type { ContactListQuery } from "./contacts.types.js";
import { cleanString, normalizePhone } from "./contacts.normalizers.js";

export const contactSelectFields = `c.id,
              c.account_name as accountName,
              c.first_name as firstName,
              c.last_name as lastName,
              c.email,
              c.phone,
              c.role_title as roleTitle,
              c.email_permission as emailPermission,
              c.phone_permission as phonePermission,
              c.sms_permission as smsPermission,
              c.whatsapp_permission as whatsappPermission,
              c.website,
              c.date_of_birth as dateOfBirth,
              c.gender,
              c.address,
              c.city,
              c.state,
              c.postal_code as postalCode,
              c.country,
              c.tags,
              c.status,
              c.lead_status as leadStatus,
              c.source,
              c.value,
              c.treatment_interests as treatmentInterests,
              c.package_interest as packageInterest,
              c.recommended_package as recommendedPackage,
              c.notes,
              c.external_id as externalId,
              c.import_batch_id as importBatchId,
              c.last_contact_at as lastContactAt,
              la.last_activity_at as lastActivityAt,
              c.created_at as createdAt,
              c.updated_at as updatedAt`;

export const lastActivityJoin = `LEFT JOIN (
         SELECT clinic_id, contact_id, MAX(timestamp) as last_activity_at
         FROM activity
         WHERE deleted_at IS NULL
         GROUP BY clinic_id, contact_id
       ) la ON la.clinic_id = c.clinic_id AND la.contact_id = c.id`;

// Keep phone comparisons aligned across list search and duplicate matching
export function phoneSqlExpression(column: string) {
  return `REGEXP_REPLACE(COALESCE(${column}, ''), '[^0-9]', '')`;
}

// Build clinic-scoped filters for the lead/contact inbox
export function buildListFilters(clinicId: string, query: ContactListQuery) {
  const clauses = ["c.clinic_id = ?", "c.deleted_at IS NULL"];
  const values: any[] = [clinicId];
  const search = cleanString(query.search)?.toLowerCase();
  const status = cleanString(query.status);
  const leadStatus = cleanString(query.leadStatus);
  const source = cleanString(query.source);
  const tag = cleanString(query.tag);
  const campaign = cleanString(query.campaign || query.utmCampaign)?.toLowerCase();
  const utmSource = cleanString(query.utmSource)?.toLowerCase();
  const utmMedium = cleanString(query.utmMedium)?.toLowerCase();
  const createdFrom = cleanString(query.createdFrom);
  const createdTo = cleanString(query.createdTo);

  if (status) {
    clauses.push("c.status = ?");
    values.push(status);
  }

  if (leadStatus) {
    clauses.push("c.lead_status = ?");
    values.push(leadStatus);
  }

  if (source) {
    clauses.push("c.source = ?");
    values.push(source);
  }

  if (tag) {
    clauses.push("JSON_CONTAINS(COALESCE(c.tags, JSON_ARRAY()), JSON_QUOTE(?))");
    values.push(tag);
  }

  if (campaign) {
    clauses.push(`(
      LOWER(COALESCE(c.source, '')) LIKE ?
      OR LOWER(COALESCE(c.notes, '')) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM campaign_contact cc
        INNER JOIN campaign ca ON ca.id = cc.campaign_id AND ca.clinic_id = c.clinic_id
        WHERE cc.contact_id = c.id
          AND cc.clinic_id = c.clinic_id
          AND LOWER(ca.name) LIKE ?
      )
    )`);
    values.push(`%${campaign}%`, `%${campaign}%`, `%${campaign}%`);
  }

  if (utmSource) {
    clauses.push("(LOWER(COALESCE(c.source, '')) = ? OR LOWER(COALESCE(c.notes, '')) LIKE ?)");
    values.push(utmSource, `%utm_source=${utmSource}%`);
  }

  if (utmMedium) {
    clauses.push("LOWER(COALESCE(c.notes, '')) LIKE ?");
    values.push(`%utm_medium=${utmMedium}%`);
  }

  if (createdFrom) {
    clauses.push("c.created_at >= ?");
    values.push(createdFrom);
  }

  if (createdTo) {
    clauses.push("c.created_at < DATE_ADD(?, INTERVAL 1 DAY)");
    values.push(createdTo);
  }

  if (search) {
    const like = `%${search}%`;
    const phoneSearch = normalizePhone(search) || search;
    clauses.push(
      `(LOWER(CONCAT_WS(' ', c.first_name, c.last_name)) LIKE ?
        OR LOWER(COALESCE(c.account_name, '')) LIKE ?
        OR LOWER(COALESCE(c.role_title, '')) LIKE ?
        OR LOWER(COALESCE(c.email, '')) LIKE ?
        OR LOWER(COALESCE(c.website, '')) LIKE ?
        OR ${phoneSqlExpression("c.phone")} LIKE ?
        OR LOWER(COALESCE(c.source, '')) LIKE ?
        OR LOWER(COALESCE(c.status, '')) LIKE ?
        OR LOWER(COALESCE(c.lead_status, '')) LIKE ?
        OR LOWER(COALESCE(c.package_interest, '')) LIKE ?
        OR LOWER(COALESCE(c.recommended_package, '')) LIKE ?
        OR LOWER(COALESCE(c.notes, '')) LIKE ?
        OR CAST(COALESCE(c.tags, JSON_ARRAY()) AS CHAR) LIKE ?
        OR CAST(COALESCE(c.treatment_interests, JSON_ARRAY()) AS CHAR) LIKE ?)`,
    );
    values.push(like, like, like, like, like, `%${phoneSearch}%`, like, like, like, like, like, like, like, like);
  }

  return {
    whereSql: clauses.join(" AND "),
    values,
  };
}

// Whitelist sort fields so request query values cannot become raw SQL
export function getListSort(
  sortBy: ContactListQuery["sortBy"],
  sortOrder: ContactListQuery["sortOrder"],
) {
  const direction = sortOrder === "asc" ? "ASC" : "DESC";
  const mapping: Record<string, string> = {
    name: "LOWER(CONCAT_WS(' ', c.first_name, c.last_name))",
    source: "c.source",
    status: "c.status",
    value: "c.value",
    lastContact: "COALESCE(c.last_contact_at, la.last_activity_at, c.updated_at)",
    createdAt: "c.created_at",
    updatedAt: "c.updated_at",
  };

  return `${mapping[sortBy || "updatedAt"] || mapping.updatedAt} ${direction}, c.created_at DESC`;
}
