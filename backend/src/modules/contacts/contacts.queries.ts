import type { ContactListQuery } from "./contacts.types.js";
import { cleanString, normalizePhone } from "./contacts.normalizers.js";

export const contactSelectFields = `c.id,
              c.account_name as accountName,
              c.contact_role as role,
              c.communication_permissions as communicationPermissions,
              c.first_name as firstName,
              c.last_name as lastName,
              c.email,
              c.phone,
              c.role_title as roleTitle,
              c.email_permission as canEmail,
              c.phone_permission as canCall,
              c.whatsapp_permission as canWhatsAppMessage,
              c.email_permission as emailPermission,
              c.phone_permission as phonePermission,
              c.sms_permission as smsPermission,
              c.whatsapp_permission as whatsappPermission,
              c.unsubscribed,
              c.do_not_contact as doNotContact,
              c.permission_source as permissionSource,
              c.opt_in_at as optInAt,
              c.opt_out_at as optOutAt,
              c.consent_updated_at as consentUpdatedAt,
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
              c.first_source as firstSource,
              c.latest_source as latestSource,
              c.converting_source as convertingSource,
              c.utm_source as utmSource,
              c.utm_medium as utmMedium,
              c.utm_campaign as utmCampaign,
              c.utm_content as utmContent,
              c.utm_term as utmTerm,
              c.landing_page as landingPage,
              c.referrer,
              c.form_submitted as formSubmitted,
              c.page_submitted as pageSubmitted,
              c.cta_clicked as ctaClicked,
              c.gclid,
              c.fbclid,
              c.msclkid,
              c.ttclid,
              c.gbraid,
              c.wbraid,
              c.value,
              c.treatment_interests as treatmentInterests,
              c.package_interest as packageInterest,
              c.recommended_package as recommendedPackage,
              c.notes,
              c.external_id as externalId,
              c.import_batch_id as importBatchId,
              c.last_contact_at as lastContactAt,
              la.last_activity_at as lastActivityAt,
              COALESCE(ca.contact_attempt_count, 0) as contactAttemptCount,
              nf.next_follow_up_at as nextFollowUpAt,
              c.created_at as createdAt,
              c.updated_at as updatedAt`;

export const lastActivityJoin = `LEFT JOIN (
         SELECT clinic_id, contact_id, MAX(timestamp) as last_activity_at
         FROM activity
         WHERE deleted_at IS NULL
         GROUP BY clinic_id, contact_id
       ) la ON la.clinic_id = c.clinic_id AND la.contact_id = c.id
       LEFT JOIN (
         SELECT clinic_id,
                contact_id,
                COUNT(*) as contact_attempt_count
         FROM activity
         WHERE deleted_at IS NULL
           AND (
             JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'contact_attempt_recorded'
             OR JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.action')) = 'lead_contacted'
           )
         GROUP BY clinic_id, contact_id
       ) ca ON ca.clinic_id = c.clinic_id AND ca.contact_id = c.id
       LEFT JOIN (
         SELECT clinic_id,
                contact_id,
                MIN(due_date) as next_follow_up_at
         FROM task
         WHERE deleted_at IS NULL
           AND status <> 'completed'
           AND due_date IS NOT NULL
         GROUP BY clinic_id, contact_id
       ) nf ON nf.clinic_id = c.clinic_id AND nf.contact_id = c.id`;

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
      OR LOWER(COALESCE(c.utm_campaign, '')) LIKE ?
      OR LOWER(COALESCE(c.converting_source, '')) LIKE ?
      OR LOWER(COALESCE(c.cta_clicked, '')) LIKE ?
      OR EXISTS (
        SELECT 1
        FROM campaign_contact cc
        INNER JOIN campaign ca ON ca.id = cc.campaign_id AND ca.clinic_id = c.clinic_id
        WHERE cc.contact_id = c.id
          AND cc.clinic_id = c.clinic_id
          AND LOWER(ca.name) LIKE ?
      )
    )`);
    values.push(`%${campaign}%`, `%${campaign}%`, `%${campaign}%`, `%${campaign}%`, `%${campaign}%`);
  }

  if (utmSource) {
    clauses.push(`(
      LOWER(COALESCE(c.utm_source, '')) = ?
      OR LOWER(COALESCE(c.first_source, '')) = ?
      OR LOWER(COALESCE(c.latest_source, '')) = ?
      OR LOWER(COALESCE(c.converting_source, '')) = ?
    )`);
    values.push(utmSource, utmSource, utmSource, utmSource);
  }

  if (utmMedium) {
    clauses.push("LOWER(COALESCE(c.utm_medium, '')) = ?");
    values.push(utmMedium);
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
        OR LOWER(COALESCE(c.first_source, '')) LIKE ?
        OR LOWER(COALESCE(c.latest_source, '')) LIKE ?
        OR LOWER(COALESCE(c.converting_source, '')) LIKE ?
        OR LOWER(COALESCE(c.utm_source, '')) LIKE ?
        OR LOWER(COALESCE(c.utm_medium, '')) LIKE ?
        OR LOWER(COALESCE(c.utm_campaign, '')) LIKE ?
        OR LOWER(COALESCE(c.landing_page, '')) LIKE ?
        OR LOWER(COALESCE(c.referrer, '')) LIKE ?
        OR LOWER(COALESCE(c.form_submitted, '')) LIKE ?
        OR LOWER(COALESCE(c.page_submitted, '')) LIKE ?
        OR LOWER(COALESCE(c.cta_clicked, '')) LIKE ?
        OR LOWER(COALESCE(c.gclid, '')) LIKE ?
        OR LOWER(COALESCE(c.fbclid, '')) LIKE ?
        OR LOWER(COALESCE(c.msclkid, '')) LIKE ?
        OR LOWER(COALESCE(c.status, '')) LIKE ?
        OR LOWER(COALESCE(c.lead_status, '')) LIKE ?
        OR LOWER(COALESCE(c.package_interest, '')) LIKE ?
        OR LOWER(COALESCE(c.recommended_package, '')) LIKE ?
        OR LOWER(COALESCE(c.notes, '')) LIKE ?
        OR CAST(COALESCE(c.tags, JSON_ARRAY()) AS CHAR) LIKE ?
        OR CAST(COALESCE(c.treatment_interests, JSON_ARRAY()) AS CHAR) LIKE ?)`,
    );
    values.push(
      like,
      like,
      like,
      like,
      like,
      `%${phoneSearch}%`,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
      like,
    );
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
