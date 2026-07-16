import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { logAuditEvent } from "../../utils/audit.js";
import { contactsService } from "../contacts/contacts.service.js";
import type { WebsiteLeadCapturePayload, WebsiteLeadCaptureResult } from "./website-leads.types.js";

const PAYLOAD_SOURCE = "website_lead_capture";

function cleanString(value: unknown) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}

function boolFromValue(value: unknown) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const cleaned = cleanString(value)?.toLowerCase();
  if (!cleaned) return false;
  return ["1", "true", "yes", "y", "on", "accepted", "allowed", "consented"].includes(cleaned);
}

function pick(data: WebsiteLeadCapturePayload, ...keys: string[]) {
  for (const key of keys) {
    const value = cleanString(data[key]);
    if (value) return value;
  }
  return null;
}

function splitName(data: WebsiteLeadCapturePayload) {
  const firstName = pick(data, "firstName");
  const lastName = pick(data, "lastName");
  if (firstName || lastName) return { firstName, lastName };

  const fullName = pick(data, "fullName", "contactName", "name");
  if (!fullName) return { firstName: null, lastName: null };

  const parts = fullName.split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() || null,
    lastName: parts.join(" ") || null,
  };
}

function isValidEmail(value: string | null) {
  if (!value) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidWebsite(value: string | null) {
  if (!value) return true;
  return /^https?:\/\/[^\s]+\.[^\s]+$/i.test(value) || /^[^\s]+\.[^\s]{2,}$/i.test(value);
}

function buildCommunicationPermissions(data: WebsiteLeadCapturePayload) {
  const consent = data.consent && typeof data.consent === "object" ? data.consent : {};
  return {
    email: boolFromValue(data.emailConsent) || boolFromValue(consent.email) || boolFromValue(consent.marketing),
    sms: boolFromValue(data.smsConsent) || boolFromValue(consent.sms),
    whatsapp: boolFromValue(data.whatsappConsent) || boolFromValue(consent.whatsapp),
    phone: boolFromValue(data.phoneConsent) || boolFromValue(consent.phone),
  };
}

function buildNotes(data: WebsiteLeadCapturePayload) {
  const lines = [
    pick(data, "message", "notes"),
    pick(data, "guideName") ? `Guide requested: ${pick(data, "guideName")}` : null,
    pick(data, "ctaClicked", "cta_clicked", "cta") ? `CTA clicked: ${pick(data, "ctaClicked", "cta_clicked", "cta")}` : null,
    boolFromValue(data.marketingConsent) ? "Marketing consent: yes" : null,
    boolFromValue(data.privacyPolicyConsent) ? "Privacy policy consent: yes" : null,
  ];
  return lines.filter(Boolean).join("\n") || null;
}

function hasSpamTrap(data: WebsiteLeadCapturePayload) {
  return Boolean(
    pick(data, "honeypot", "websiteLeadTrap", "botField", "_hp"),
  );
}

function validatePayload(data: WebsiteLeadCapturePayload) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw ApiError.badRequest("Lead payload must be an object");
  }

  if (hasSpamTrap(data)) {
    throw ApiError.badRequest("Submission rejected");
  }

  const accountName = pick(data, "accountName", "clinicName", "companyName");
  const { firstName, lastName } = splitName(data);
  const email = pick(data, "email");
  const phone = pick(data, "phone");
  const website = pick(data, "website");
  const hasIdentity = Boolean(accountName || firstName || lastName);
  const hasContactMethod = Boolean(email || phone);

  if (!hasIdentity) {
    throw ApiError.badRequest("Lead must include an account name or contact name");
  }

  if (!hasContactMethod) {
    throw ApiError.badRequest("Lead must include an email or phone number");
  }

  if (!isValidEmail(email)) {
    throw ApiError.badRequest("Lead email must be valid");
  }

  if (!isValidWebsite(website)) {
    throw ApiError.badRequest("Lead website must be a valid domain or URL");
  }
}

function toContactPayload(data: WebsiteLeadCapturePayload, rawPayloadId: string) {
  const name = splitName(data);
  const accountName = pick(data, "accountName", "clinicName", "companyName");
  const source = pick(data, "source", "firstSource", "first_source", "utmSource", "utm_source") || "website";
  const packageInterest = pick(data, "packageInterest", "package_interest", "package", "serviceInterest");
  const guideName = pick(data, "guideName");
  const ctaClicked = pick(data, "ctaClicked", "cta_clicked", "cta");
  const landingPage = pick(data, "landingPage", "landing_page", "pageUrl", "page_url");
  const communicationPermissions = buildCommunicationPermissions(data);

  return {
    accountName,
    ...name,
    email: pick(data, "email"),
    phone: pick(data, "phone"),
    website: pick(data, "website"),
    address: pick(data, "location"),
    communicationPermissions,
    emailPermission: communicationPermissions.email,
    phonePermission: communicationPermissions.phone,
    smsPermission: communicationPermissions.sms,
    whatsappPermission: communicationPermissions.whatsapp,
    status: "lead",
    leadStatus: "new",
    source,
    firstSource: pick(data, "firstSource", "first_source") || source,
    latestSource: pick(data, "latestSource", "latest_source") || source,
    convertingSource: pick(data, "convertingSource", "converting_source") || source,
    utmSource: pick(data, "utmSource", "utm_source"),
    utmMedium: pick(data, "utmMedium", "utm_medium"),
    utmCampaign: pick(data, "utmCampaign", "utm_campaign", "campaign"),
    utmContent: pick(data, "utmContent", "utm_content"),
    utmTerm: pick(data, "utmTerm", "utm_term"),
    landingPage,
    referrer: pick(data, "referrer"),
    formSubmitted: pick(data, "formSubmitted", "form_submitted", "formName") || guideName,
    pageSubmitted: pick(data, "pageSubmitted", "page_submitted") || landingPage,
    ctaClicked,
    gclid: pick(data, "gclid"),
    fbclid: pick(data, "fbclid"),
    msclkid: pick(data, "msclkid"),
    ttclid: pick(data, "ttclid"),
    gbraid: pick(data, "gbraid"),
    wbraid: pick(data, "wbraid"),
    packageInterest,
    recommendedPackage: null,
    treatmentInterests: packageInterest ? [packageInterest] : [],
    tags: [
      "website_lead",
      guideName ? `guide:${guideName}` : null,
      ctaClicked ? `cta:${ctaClicked}` : null,
    ].filter(Boolean) as string[],
    notes: buildNotes(data),
    externalId: pick(data, "eventId", "submissionId") || rawPayloadId,
  };
}

export class WebsiteLeadsService {
  async captureWebsiteLead(
    clinicId: string,
    apiKeyId: string,
    payload: WebsiteLeadCapturePayload,
    meta: { ipAddress?: string | null; userAgent?: string | null } = {},
  ): Promise<WebsiteLeadCaptureResult> {
    const normalizedPayload =
      payload && typeof payload === "object" ? payload : {} as WebsiteLeadCapturePayload;
    const eventId = pick(normalizedPayload, "eventId", "submissionId");
    const rawPayload = await this.createPayloadLog(clinicId, eventId, normalizedPayload, apiKeyId);

    if (rawPayload.duplicateEvent && rawPayload.contactId) {
      return {
        accepted: true,
        contactId: rawPayload.contactId,
        duplicateCandidates: [],
        duplicateEvent: true,
        rawPayloadId: rawPayload.id,
      };
    }

    try {
      validatePayload(normalizedPayload);
      const result = await contactsService.createContact(
        clinicId,
        null as any,
        toContactPayload(normalizedPayload, rawPayload.id),
        meta,
      );

      await this.markPayloadProcessed(clinicId, rawPayload.id, result.contact.id);

      await logAuditEvent({
        clinicId,
        userId: null,
        action: "WEBSITE_LEAD_CAPTURED",
        entityType: "contact",
        entityId: result.contact.id,
        changes: {
          apiKeyId,
          rawPayloadId: rawPayload.id,
          source: pick(normalizedPayload, "source", "utmSource", "utm_source"),
          packageInterest: pick(normalizedPayload, "packageInterest", "package_interest", "package"),
          guideName: pick(normalizedPayload, "guideName"),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return {
        accepted: true,
        contactId: result.contact.id,
        duplicateCandidates: result.duplicateCandidates || [],
        duplicateEvent: false,
        rawPayloadId: rawPayload.id,
      };
    } catch (error) {
      await this.markPayloadFailed(clinicId, rawPayload.id, error);
      await logAuditEvent({
        clinicId,
        userId: null,
        action: "WEBSITE_LEAD_CAPTURE_FAILED",
        entityType: "integration_raw_payload",
        entityId: rawPayload.id,
        changes: {
          apiKeyId,
          error: error instanceof Error ? error.message : String(error),
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw error;
    }
  }

  private async createPayloadLog(
    clinicId: string,
    eventId: string | null,
    payload: WebsiteLeadCapturePayload,
    apiKeyId: string,
  ) {
    const id = uuidv4();

    try {
      await pool.execute(
        `INSERT INTO integration_raw_payload
          (id, clinic_id, source, source_event_id, payload, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'received', ?)`,
        [id, clinicId, PAYLOAD_SOURCE, eventId, JSON.stringify(payload || {}), apiKeyId],
      );
      return { id, duplicateEvent: false, contactId: null as string | null };
    } catch (error: any) {
      if (error?.code !== "ER_DUP_ENTRY" || !eventId) throw error;

      const [rows]: any = await pool.execute(
        `SELECT id,
                status,
                linked_entity_id as contactId
         FROM integration_raw_payload
         WHERE clinic_id = ? AND source = ? AND source_event_id = ?
         LIMIT 1`,
        [clinicId, PAYLOAD_SOURCE, eventId],
      );
      const existing = rows[0];
      if (!existing?.id) {
        throw ApiError.conflict("Website lead event could not be reserved.");
      }
      if (existing?.status === "processed" && existing?.contactId) {
        return { id: existing.id as string, duplicateEvent: true, contactId: existing.contactId as string };
      }

      await pool.execute(
        `UPDATE integration_raw_payload
         SET payload = ?,
             status = 'received',
             linked_entity_type = NULL,
             linked_entity_id = NULL,
             processed_at = NULL,
             created_by = ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ? AND clinic_id = ?`,
        [JSON.stringify(payload || {}), apiKeyId, existing.id, clinicId],
      );

      return { id: existing.id as string, duplicateEvent: false, contactId: null as string | null };
    }
  }

  private async markPayloadProcessed(clinicId: string, rawPayloadId: string, contactId: string) {
    await pool.execute(
      `UPDATE integration_raw_payload
       SET linked_entity_type = 'contact',
           linked_entity_id = ?,
           status = 'processed',
           processed_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [contactId, rawPayloadId, clinicId],
    );
  }

  private async markPayloadFailed(clinicId: string, rawPayloadId: string, error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await pool.execute(
      `UPDATE integration_raw_payload
       SET status = 'failed',
           processed_at = CURRENT_TIMESTAMP,
           payload = JSON_SET(COALESCE(payload, JSON_OBJECT()), '$._error', ?)
       WHERE id = ? AND clinic_id = ?`,
      [message, rawPayloadId, clinicId],
    );
  }
}

export const websiteLeadsService = new WebsiteLeadsService();
