import { v4 as uuidv4 } from "uuid";
import pool from "../../config/database.js";
import { ApiError } from "../../utils/ApiError.js";
import { buildTimelineMetadata, logTimelineActivity } from "../../utils/activity.js";
import { logAuditEvent } from "../../utils/audit.js";
import { contactsService } from "../contacts/contacts.service.js";
import { pipelineService } from "../pipeline/pipeline.service.js";
import type { WebsiteLeadCapturePayload, WebsiteLeadCaptureResult } from "./website-leads.types.js";

const PAYLOAD_SOURCE = "website_lead_capture";
const PACKAGE_NAMES = {
  growthScore: "Clinic Growth Score",
  growthDiagnostic: "Growth Diagnostic",
  leadConcierge: "Lead Concierge",
  performanceOs: "Performance OS",
  growthEngine: "Growth Engine",
  marketLeader: "Market Leader",
} as const;

interface WebsiteLeadIntentMapping {
  leadType: string;
  packageInterest: string | null;
  source: string;
  tags: string[];
}

interface GuideDownloadContext {
  downloadedAt: string;
  guideName: string;
  nextAction: string;
}

export interface WebsiteLeadSourceConfig {
  apiKeyId: string;
  sourceKey?: string | null;
  sourceLabel?: string | null;
  defaultSource?: string | null;
  initialStageName?: string | null;
  ownerUserId?: string | null;
  followUpEnabled?: boolean;
}

export interface WebsiteLeadCaptureOptions {
  payloadSource?: string;
  sourceConfig?: WebsiteLeadSourceConfig;
}

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

function nullableBoolFromValue(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  const cleaned = cleanString(value)?.toLowerCase();
  if (!cleaned) return null;
  if (["1", "true", "yes", "y", "on", "accepted", "allowed", "consented"].includes(cleaned)) return true;
  if (["0", "false", "no", "n", "off", "blocked", "declined", "unsubscribed"].includes(cleaned)) return false;
  return null;
}

function pick(data: WebsiteLeadCapturePayload, ...keys: string[]) {
  for (const key of keys) {
    const value = cleanString(data[key]);
    if (value) return value;
  }
  return null;
}

function withSourceConfig(
  payload: WebsiteLeadCapturePayload,
  sourceConfig?: WebsiteLeadSourceConfig,
) {
  if (!sourceConfig) return payload;

  const configuredSource = cleanString(sourceConfig.defaultSource) || cleanString(sourceConfig.sourceKey);
  if (!configuredSource) return payload;

  const submittedSource = pick(payload, "source");
  return {
    ...payload,
    source: configuredSource,
    firstSource: pick(payload, "firstSource", "first_source") || configuredSource,
    latestSource: configuredSource,
    convertingSource: pick(payload, "convertingSource", "converting_source") || configuredSource,
    _submittedSource: submittedSource,
    _configuredSource: configuredSource,
    _sourceKey: cleanString(sourceConfig.sourceKey),
    _sourceLabel: cleanString(sourceConfig.sourceLabel),
  };
}

function normalizeText(value: string | null) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildIntentSearchText(data: WebsiteLeadCapturePayload) {
  return normalizeText([
    pick(data, "leadType"),
    pick(data, "formSubmitted", "form_submitted", "formName"),
    pick(data, "ctaClicked", "cta_clicked", "cta"),
    pick(data, "guideName", "guideTitle"),
    pick(data, "packageInterest", "package_interest", "package", "serviceInterest"),
    pick(data, "source"),
    pick(data, "calendlyEventId", "calendlyEventUri", "calendlyInviteeUri"),
    pick(data, "scheduledAt", "scheduleAt", "scheduled_at", "eventStartTime", "startTime", "start_time"),
    pick(data, "chatbotConversationId", "conversationId"),
    pick(data, "conversationTranscript", "transcript"),
    pick(data, "landingPage", "landing_page", "pageUrl", "page_url"),
    pick(data, "utmCampaign", "utm_campaign", "campaign"),
  ].filter(Boolean).join(" "));
}

function inferPackageInterest(text: string) {
  if (/\b(market leader|market leadership|dominant market)\b/.test(text)) return PACKAGE_NAMES.marketLeader;
  if (/\b(growth engine|engine call|engine demo)\b/.test(text)) return PACKAGE_NAMES.growthEngine;
  if (/\b(performance os|performance demo|os demo|demo performance)\b/.test(text)) return PACKAGE_NAMES.performanceOs;
  if (/\b(lead concierge|concierge)\b/.test(text)) return PACKAGE_NAMES.leadConcierge;
  if (/\b(growth diagnostic|diagnostic)\b/.test(text)) return PACKAGE_NAMES.growthDiagnostic;
  if (/\b(clinic growth score|growth score|free audit|audit form|score form)\b/.test(text)) return PACKAGE_NAMES.growthScore;
  return null;
}

function specificInboundSource(data: WebsiteLeadCapturePayload, fallback: string) {
  const source = pick(data, "source");
  if (!source || ["website", "site", "web", "contact form"].includes(source.toLowerCase())) {
    return fallback;
  }
  return source;
}

function toIsoDateTime(value: string | null) {
  const parsed = value ? new Date(value) : new Date();
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return date.toISOString();
}

function toMysqlDateTime(value: string | null) {
  return value ? toIsoDateTime(value).slice(0, 19).replace("T", " ") : null;
}

function tomorrowDateOnly() {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

function dateOnlyFromDateTime(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
}

export function buildGuideDownloadContext(data: WebsiteLeadCapturePayload): GuideDownloadContext {
  return {
    downloadedAt: toIsoDateTime(pick(data, "downloadedAt", "downloaded_at", "downloadAt", "download_at", "downloadDate", "download_date")),
    guideName: pick(data, "guideName", "guideTitle") || "Free guide",
    nextAction: "Request/calculate Clinic Growth Score",
  };
}

export function mapWebsiteLeadIntent(data: WebsiteLeadCapturePayload): WebsiteLeadIntentMapping {
  const text = buildIntentSearchText(data);
  const explicitPackage = pick(data, "packageInterest", "package_interest", "package", "serviceInterest");
  const packageInterest = explicitPackage || inferPackageInterest(text);
  const explicitLeadType = pick(data, "leadType");
  const configuredSource = pick(data, "_configuredSource");
  const hasChatbotSignal = Boolean(pick(data, "chatbotConversationId", "conversationId", "conversationTranscript", "transcript"));
  const hasScheduleSignal = Boolean(pick(data, "calendlyEventId", "calendlyEventUri", "calendlyInviteeUri", "scheduledAt", "scheduleAt", "scheduled_at", "eventStartTime", "startTime", "start_time"));

  if (hasChatbotSignal || /\b(chatbot|chat bot|live chat|chat conversation|chat widget)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "chatbot",
      packageInterest,
      source: specificInboundSource(data, "website_chatbot"),
      tags: ["website_chatbot", "lead_type:chatbot"],
    };
  }

  if (hasScheduleSignal || /\b(calendly|schedule call|scheduled call|book a call|booked call|call booked|discovery booked)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "schedule_call",
      packageInterest,
      source: specificInboundSource(data, "website_schedule_call"),
      tags: ["website_schedule_call", "lead_type:schedule_call"],
    };
  }

  if (/\b(market leader|market leadership|dominant market)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "package_interest",
      packageInterest: PACKAGE_NAMES.marketLeader,
      source: configuredSource || "website_market_leader_cta",
      tags: ["website_cta", "lead_type:package_interest", "package:market_leader"],
    };
  }

  if (/\b(growth engine|engine call|engine demo)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "package_interest",
      packageInterest: PACKAGE_NAMES.growthEngine,
      source: configuredSource || "website_growth_engine_cta",
      tags: ["website_cta", "lead_type:package_interest", "package:growth_engine"],
    };
  }

  if (/\b(performance os|performance demo|os demo|demo performance)\b/.test(text)) {
    const leadType = explicitLeadType || (/\bdemo\b/.test(text) ? "demo_request" : "package_interest");
    return {
      leadType,
      packageInterest: PACKAGE_NAMES.performanceOs,
      source: configuredSource || "website_performance_os_demo",
      tags: ["website_cta", `lead_type:${leadType}`, "package:performance_os"],
    };
  }

  if (/\b(lead concierge|concierge)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "package_interest",
      packageInterest: PACKAGE_NAMES.leadConcierge,
      source: configuredSource || "website_lead_concierge_cta",
      tags: ["website_cta", "lead_type:package_interest", "package:lead_concierge"],
    };
  }

  if (/\b(growth diagnostic|diagnostic)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "package_interest",
      packageInterest: PACKAGE_NAMES.growthDiagnostic,
      source: configuredSource || "website_growth_diagnostic_cta",
      tags: ["website_cta", "lead_type:package_interest", "package:growth_diagnostic"],
    };
  }

  if (/\b(clinic growth score|growth score|free audit|audit form|score form)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "free_audit",
      packageInterest: PACKAGE_NAMES.growthScore,
      source: configuredSource || "website_growth_score_form",
      tags: ["website_form", "lead_type:free_audit", "package:clinic_growth_score"],
    };
  }

  if (/\b(free guide|guide download|download guide|lead magnet|checklist|playbook|ebook|pdf)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "lead_magnet_nurture",
      packageInterest: explicitPackage,
      source: configuredSource || "website_lead_magnet",
      tags: ["website_form", "lead_type:lead_magnet_nurture"],
    };
  }

  if (/\b(referral|referred|partner intro)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "referral",
      packageInterest: explicitPackage,
      source: "referral",
      tags: ["manual_or_referral", "lead_type:referral"],
    };
  }

  if (/\b(manual|phone|whatsapp|email|direct conversation)\b/.test(text)) {
    return {
      leadType: explicitLeadType || "manual",
      packageInterest: explicitPackage,
      source: pick(data, "source") || "manual",
      tags: ["manual_or_referral", "lead_type:manual"],
    };
  }

  return {
    leadType: explicitLeadType || "contact_enquiry",
    packageInterest: explicitPackage,
    source: pick(data, "source") || "website_contact_form",
    tags: ["website_form", "lead_type:contact_enquiry"],
  };
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

export function buildWebsiteLeadContactPermissions(data: WebsiteLeadCapturePayload) {
  const consent = data.consent && typeof data.consent === "object" ? data.consent : {};
  const email = nullableBoolFromValue(data.emailConsent)
    ?? nullableBoolFromValue(data.canEmail)
    ?? nullableBoolFromValue(consent.email)
    ?? nullableBoolFromValue(consent.canEmail)
    ?? nullableBoolFromValue(data.marketingConsent)
    ?? nullableBoolFromValue(consent.marketing)
    ?? false;
  const sms = nullableBoolFromValue(data.smsConsent) ?? nullableBoolFromValue(consent.sms) ?? false;
  const whatsapp = nullableBoolFromValue(data.whatsappConsent)
    ?? nullableBoolFromValue(data.canWhatsAppMessage)
    ?? nullableBoolFromValue(data.canWhatsApp)
    ?? nullableBoolFromValue(data.canMessage)
    ?? nullableBoolFromValue(consent.whatsapp)
    ?? nullableBoolFromValue(consent.canWhatsAppMessage)
    ?? nullableBoolFromValue(consent.canWhatsApp)
    ?? nullableBoolFromValue(consent.canMessage)
    ?? false;
  const phone = nullableBoolFromValue(data.phoneConsent)
    ?? nullableBoolFromValue(data.canCall)
    ?? nullableBoolFromValue(consent.phone)
    ?? nullableBoolFromValue(consent.canCall)
    ?? false;
  const unsubscribed = nullableBoolFromValue(data.unsubscribed)
    ?? nullableBoolFromValue(consent.unsubscribed)
    ?? false;
  const doNotContact = nullableBoolFromValue(data.doNotContact)
    ?? nullableBoolFromValue(data.do_not_contact)
    ?? nullableBoolFromValue(consent.doNotContact)
    ?? false;
  const permissionSource = pick(data, "permissionSource", "permission_source", "consentSource", "consent_source")
    || cleanString(consent.permissionSource)
    || cleanString(consent.consentSource)
    || null;
  const optInAt = toMysqlDateTime(
    pick(data, "optInAt", "opt_in_at") || cleanString(consent.optInAt),
  );
  const optOutAt = toMysqlDateTime(
    pick(data, "optOutAt", "opt_out_at") || cleanString(consent.optOutAt),
  );
  const hasExplicitConsentSignal = [
    data.emailConsent,
    data.phoneConsent,
    data.smsConsent,
    data.whatsappConsent,
    data.canEmail,
    data.canCall,
    data.canMessage,
    data.canWhatsApp,
    data.canWhatsAppMessage,
    data.marketingConsent,
    data.unsubscribed,
    data.doNotContact,
    data.do_not_contact,
    consent.email,
    consent.phone,
    consent.sms,
    consent.whatsapp,
    consent.marketing,
    consent.unsubscribed,
    consent.doNotContact,
  ].some((value) => value !== null && value !== undefined && value !== "");
  const consentTimestamp = hasExplicitConsentSignal ? new Date().toISOString().slice(0, 19).replace("T", " ") : null;

  const communicationPermissions = {
    email: doNotContact || unsubscribed ? false : email,
    sms: doNotContact || unsubscribed ? false : sms,
    whatsapp: doNotContact || unsubscribed ? false : whatsapp,
    phone: doNotContact ? false : phone,
  };

  return {
    communicationPermissions,
    emailPermission: communicationPermissions.email,
    phonePermission: communicationPermissions.phone,
    smsPermission: communicationPermissions.sms,
    whatsappPermission: communicationPermissions.whatsapp,
    canEmail: communicationPermissions.email,
    canCall: communicationPermissions.phone,
    canWhatsAppMessage: communicationPermissions.whatsapp,
    unsubscribed,
    doNotContact,
    permissionSource,
    optInAt: optInAt || (Object.values(communicationPermissions).some(Boolean) ? consentTimestamp : null),
    optOutAt: optOutAt || (unsubscribed || doNotContact ? consentTimestamp : null),
    consentUpdatedAt: consentTimestamp,
  };
}

function buildNotes(data: WebsiteLeadCapturePayload, mapping: WebsiteLeadIntentMapping) {
  const guideContext = mapping.leadType === "lead_magnet_nurture" ? buildGuideDownloadContext(data) : null;
  const scheduledAt = pick(data, "scheduledAt", "scheduleAt", "scheduled_at", "eventStartTime", "startTime", "start_time");
  const conversationId = pick(data, "chatbotConversationId", "conversationId");
  const conversationTranscript = pick(data, "conversationTranscript", "transcript");
  const lines = [
    pick(data, "message", "notes"),
    `Lead type: ${mapping.leadType}`,
    scheduledAt ? `Scheduled call: ${toIsoDateTime(scheduledAt)}` : null,
    pick(data, "calendlyEventUri") ? `Calendly event: ${pick(data, "calendlyEventUri")}` : null,
    conversationId ? `Chatbot conversation ID: ${conversationId}` : null,
    conversationTranscript ? `Chatbot transcript:\n${conversationTranscript}` : null,
    guideContext ? `Guide downloaded: ${guideContext.guideName}` : null,
    guideContext ? `Guide downloaded at: ${guideContext.downloadedAt}` : null,
    guideContext ? `Recommended next action: ${guideContext.nextAction}` : null,
    !guideContext && pick(data, "guideName", "guideTitle") ? `Guide requested: ${pick(data, "guideName", "guideTitle")}` : null,
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
  const mapping = mapWebsiteLeadIntent(data);
  const source = mapping.source || pick(data, "source", "firstSource", "first_source", "utmSource", "utm_source") || "website";
  const packageInterest = mapping.packageInterest;
  const guideContext = mapping.leadType === "lead_magnet_nurture" ? buildGuideDownloadContext(data) : null;
  const guideName = guideContext?.guideName || pick(data, "guideName", "guideTitle");
  const ctaClicked = pick(data, "ctaClicked", "cta_clicked", "cta");
  const landingPage = pick(data, "landingPage", "landing_page", "pageUrl", "page_url");
  const contactPermissions = buildWebsiteLeadContactPermissions(data);
  const { communicationPermissions } = contactPermissions;

  return {
    accountName,
    ...name,
    email: pick(data, "email"),
    phone: pick(data, "phone"),
    website: pick(data, "website"),
    address: pick(data, "location"),
    communicationPermissions,
    canEmail: contactPermissions.canEmail,
    canCall: contactPermissions.canCall,
    canWhatsAppMessage: contactPermissions.canWhatsAppMessage,
    emailPermission: contactPermissions.emailPermission,
    phonePermission: contactPermissions.phonePermission,
    smsPermission: contactPermissions.smsPermission,
    whatsappPermission: contactPermissions.whatsappPermission,
    unsubscribed: contactPermissions.unsubscribed,
    doNotContact: contactPermissions.doNotContact,
    permissionSource: contactPermissions.permissionSource,
    optInAt: contactPermissions.optInAt,
    optOutAt: contactPermissions.optOutAt,
    consentUpdatedAt: contactPermissions.consentUpdatedAt,
    status: "lead",
    leadStatus: mapping.leadType === "lead_magnet_nurture" ? "nurture" : "new",
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
    recommendedPackage: guideContext ? PACKAGE_NAMES.growthScore : null,
    treatmentInterests: packageInterest ? [packageInterest] : [],
    tags: Array.from(new Set([
      "website_lead",
      `lead_type:${mapping.leadType}`,
      ...mapping.tags,
      guideName ? `guide:${guideName}` : null,
      guideContext ? "next_action:clinic_growth_score" : null,
      ctaClicked ? `cta:${ctaClicked}` : null,
    ].filter(Boolean) as string[])),
    notes: buildNotes(data, mapping),
    externalId: pick(data, "eventId", "submissionId") || rawPayloadId,
  };
}

export class WebsiteLeadsService {
  async captureWebsiteLead(
    clinicId: string,
    apiKeyId: string,
    payload: WebsiteLeadCapturePayload,
    meta: { ipAddress?: string | null; userAgent?: string | null } = {},
    options: WebsiteLeadCaptureOptions = {},
  ): Promise<WebsiteLeadCaptureResult> {
    const normalizedPayload =
      withSourceConfig(
        payload && typeof payload === "object" ? payload : {} as WebsiteLeadCapturePayload,
        options.sourceConfig,
      );
    const eventId = pick(
      normalizedPayload,
      "idempotencyKey",
      "idempotency_key",
      "eventId",
      "submissionId",
      "calendlyEventId",
      "calendlyEventUri",
      "chatbotConversationId",
      "conversationId",
    );
    const rawPayload = await this.createPayloadLog(
      clinicId,
      eventId,
      normalizedPayload,
      apiKeyId,
      options.payloadSource,
    );

    if (rawPayload.duplicateEvent && rawPayload.contactId) {
      const mapping = mapWebsiteLeadIntent(normalizedPayload);
      const nextActionTaskId = await this.ensureInboundFollowUpTask(
        clinicId,
        rawPayload.contactId,
        rawPayload.id,
        normalizedPayload,
        mapping,
        options.sourceConfig,
      );

      return {
        accepted: true,
        contactId: rawPayload.contactId,
        duplicateCandidates: [],
        duplicateEvent: true,
        nextActionTaskId,
        rawPayloadId: rawPayload.id,
      };
    }

    try {
      validatePayload(normalizedPayload);
      const mapping = mapWebsiteLeadIntent(normalizedPayload);
      const result = await contactsService.createContact(
        clinicId,
        null as any,
        toContactPayload(normalizedPayload, rawPayload.id),
        meta,
      );
      const contactId = result.contact.id;
      const dealId = await this.ensureInboundPipelineDeal(
        clinicId,
        contactId,
        normalizedPayload,
        mapping,
        options.sourceConfig,
      );
      const salesCallDemoId = await this.applyScheduleCallFlow(
        clinicId,
        contactId,
        rawPayload.id,
        normalizedPayload,
        mapping,
      );
      const chatbotActivityId = await this.applyChatbotFlow(
        clinicId,
        contactId,
        rawPayload.id,
        normalizedPayload,
        mapping,
      );
      const nextActionTaskId = await this.ensureInboundFollowUpTask(
        clinicId,
        contactId,
        rawPayload.id,
        normalizedPayload,
        mapping,
        options.sourceConfig,
      );

      await this.markPayloadProcessed(clinicId, rawPayload.id, contactId);

      await logAuditEvent({
        clinicId,
        userId: null,
        action: "WEBSITE_LEAD_CAPTURED",
        entityType: "contact",
        entityId: result.contact.id,
        changes: {
          apiKeyId,
          rawPayloadId: rawPayload.id,
          source: mapping.source,
          leadType: mapping.leadType,
          packageInterest: mapping.packageInterest,
          guideName: pick(normalizedPayload, "guideName"),
          nextActionTaskId,
          dealId,
          salesCallDemoId,
          chatbotActivityId,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });

      return {
        accepted: true,
        contactId,
        duplicateCandidates: result.duplicateCandidates || [],
        duplicateEvent: false,
        dealId,
        nextActionTaskId,
        salesCallDemoId,
        chatbotActivityId,
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

  private async ensureInboundFollowUpTask(
    clinicId: string,
    contactId: string,
    rawPayloadId: string,
    payload: WebsiteLeadCapturePayload,
    mapping: WebsiteLeadIntentMapping,
    sourceConfig?: WebsiteLeadSourceConfig,
  ) {
    if (sourceConfig?.followUpEnabled === false) return null;

    if (mapping.leadType === "lead_magnet_nurture") {
      return this.applyGuideDownloadFlow(clinicId, contactId, rawPayloadId, payload, sourceConfig);
    }

    const contact = await contactsService.getContact(clinicId, contactId);
    const scheduledAt = pick(payload, "scheduledAt", "scheduleAt", "scheduled_at", "eventStartTime", "startTime", "start_time");
    const taskPlan = this.getInboundTaskPlan(mapping, payload, scheduledAt);
    const owner = await this.getOwnerAssignment(clinicId, sourceConfig?.ownerUserId || null);
    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM task
       WHERE clinic_id = ?
         AND contact_id = ?
         AND title = ?
         AND is_internal = 1
         AND status <> 'completed'
         AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [clinicId, contactId, taskPlan.title],
    );
    if (existingRows[0]?.id) return existingRows[0].id as string;

    const taskId = uuidv4();
    await pool.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, board_key, service_type,
         contact_id, contact_name, due_label, due_date, assigned_to, assigned_user_id, created_by)
       VALUES (?, ?, 1, ?, ?, ?, 'pending', 'sales_follow_up', 'sales', 'strategy', ?, ?, ?, ?, ?, ?, NULL)`,
      [
        taskId,
        clinicId,
        taskPlan.title,
        taskPlan.description,
        taskPlan.priority,
        contactId,
        contact.name,
        taskPlan.dueLabel,
        taskPlan.dueDate,
        owner.label,
        owner.userId,
      ],
    );

    await logTimelineActivity({
      clinicId,
      contactId,
      userId: null,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "inbound_follow_up_task_created",
        source: "contact",
        recordId: taskId,
        title: taskPlan.title,
        changes: {
          rawPayloadId,
          leadType: mapping.leadType,
          source: mapping.source,
          dueDate: taskPlan.dueDate,
          assignedUserId: owner.userId,
          internal: true,
          visibility: "internal",
        },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId: null,
      action: "INBOUND_LEAD_FOLLOW_UP_TASK_CREATED",
      entityType: "task",
      entityId: taskId,
      changes: {
        contactId,
        rawPayloadId,
        leadType: mapping.leadType,
        source: mapping.source,
        assignedUserId: owner.userId,
      },
    });

    return taskId;
  }

  private async applyGuideDownloadFlow(
    clinicId: string,
    contactId: string,
    rawPayloadId: string,
    payload: WebsiteLeadCapturePayload,
    sourceConfig?: WebsiteLeadSourceConfig,
  ) {

    const guideContext = buildGuideDownloadContext(payload);
    const contact = await contactsService.getContact(clinicId, contactId);
    const tags = Array.from(new Set([
      ...(contact.tags || []),
      "website_lead",
      "website_form",
      "lead_type:lead_magnet_nurture",
      "next_action:clinic_growth_score",
      `guide:${guideContext.guideName}`,
    ]));
    const guideNote = [
      `[Website guide download ${guideContext.downloadedAt}]`,
      `Guide downloaded: ${guideContext.guideName}`,
      `Recommended next action: ${guideContext.nextAction}`,
    ].join("\n");
    const notes = contact.notes?.includes(`[Website guide download ${guideContext.downloadedAt}]`)
      ? contact.notes
      : [contact.notes, guideNote].filter(Boolean).join("\n\n");

    await pool.execute(
      `UPDATE contact
       SET tags = ?,
           notes = ?,
           lead_status = 'nurture',
           latest_source = 'website_lead_magnet',
           recommended_package = COALESCE(recommended_package, ?),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [JSON.stringify(tags), notes, PACKAGE_NAMES.growthScore, contactId, clinicId],
    );

    await pool.execute(
      `UPDATE integration_raw_payload
       SET payload = JSON_SET(
             COALESCE(payload, JSON_OBJECT()),
             '$._guideDownload.guideName', ?,
             '$._guideDownload.downloadedAt', ?,
             '$._guideDownload.nextAction', ?
           ),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ?`,
      [guideContext.guideName, guideContext.downloadedAt, guideContext.nextAction, rawPayloadId, clinicId],
    );

    return this.ensureGuideNextActionTask(clinicId, contactId, contact.name, guideContext, sourceConfig);
  }

  private getInboundTaskPlan(
    mapping: WebsiteLeadIntentMapping,
    payload: WebsiteLeadCapturePayload,
    scheduledAt: string | null,
  ) {
    if (mapping.leadType === "schedule_call") {
      return {
        title: "Prepare for scheduled discovery call",
        description: [
          "Schedule-call lead captured from website/Calendly.",
          scheduledAt ? `Scheduled at: ${toIsoDateTime(scheduledAt)}` : null,
          pick(payload, "calendlyEventUri") ? `Calendly event: ${pick(payload, "calendlyEventUri")}` : null,
          mapping.packageInterest ? `Package interest: ${mapping.packageInterest}` : null,
        ].filter(Boolean).join("\n"),
        priority: "high",
        dueLabel: "Before call",
        dueDate: dateOnlyFromDateTime(scheduledAt) || tomorrowDateOnly(),
      };
    }

    if (mapping.leadType === "chatbot") {
      return {
        title: "Review chatbot conversation and follow up",
        description: [
          "Chatbot lead captured from the website.",
          pick(payload, "chatbotConversationId", "conversationId") ? `Conversation ID: ${pick(payload, "chatbotConversationId", "conversationId")}` : null,
          mapping.packageInterest ? `Package interest: ${mapping.packageInterest}` : null,
        ].filter(Boolean).join("\n"),
        priority: "high",
        dueLabel: "Review today",
        dueDate: tomorrowDateOnly(),
      };
    }

    return {
      title: "Follow up new inbound lead",
      description: [
        "Inbound lead captured from the website.",
        `Source: ${mapping.source}`,
        `Lead type: ${mapping.leadType}`,
        mapping.packageInterest ? `Package interest: ${mapping.packageInterest}` : null,
      ].filter(Boolean).join("\n"),
      priority: "medium",
      dueLabel: "Next follow-up",
      dueDate: tomorrowDateOnly(),
    };
  }

  private async applyScheduleCallFlow(
    clinicId: string,
    contactId: string,
    rawPayloadId: string,
    payload: WebsiteLeadCapturePayload,
    mapping: WebsiteLeadIntentMapping,
  ) {
    if (mapping.leadType !== "schedule_call") return null;

    const scheduledAt = toMysqlDateTime(
      pick(payload, "scheduledAt", "scheduleAt", "scheduled_at", "eventStartTime", "startTime", "start_time"),
    );
    const externalEventId = pick(payload, "calendlyEventId", "calendlyEventUri", "eventId", "submissionId") || rawPayloadId;

    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM sales_call_demo
       WHERE clinic_id = ?
         AND contact_id = ?
         AND notes LIKE ?
         AND deleted_at IS NULL
       LIMIT 1`,
      [clinicId, contactId, `%${externalEventId}%`],
    );
    if (existingRows[0]?.id) return existingRows[0].id as string;

    const id = uuidv4();
    const notes = [
      `Captured from schedule-call flow.`,
      `External event ID: ${externalEventId}`,
      pick(payload, "calendlyEventUri") ? `Calendly event: ${pick(payload, "calendlyEventUri")}` : null,
      pick(payload, "calendlyInviteeUri") ? `Calendly invitee: ${pick(payload, "calendlyInviteeUri")}` : null,
      pick(payload, "message", "notes"),
    ].filter(Boolean).join("\n");

    await pool.execute(
      `INSERT INTO sales_call_demo
        (id, clinic_id, contact_id, booked, scheduled_at, type, package_interest,
         attended, no_show, rescheduled, outcome, next_step, notes, created_by, updated_by)
       VALUES (?, ?, ?, 1, ?, 'discovery_call', ?, 0, 0, 0, NULL, 'Prepare and complete discovery call', ?, NULL, NULL)`,
      [id, clinicId, contactId, scheduledAt, mapping.packageInterest, notes],
    );

    await logTimelineActivity({
      clinicId,
      contactId,
      userId: null,
      type: "Call",
      timestamp: scheduledAt,
      metadata: buildTimelineMetadata({
        action: "schedule_call_captured",
        source: "call",
        recordId: id,
        title: "Discovery call booked",
        changes: {
          rawPayloadId,
          scheduledAt,
          packageInterest: mapping.packageInterest,
          externalEventId,
          internal: true,
          visibility: "internal",
        },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId: null,
      action: "SCHEDULE_CALL_CAPTURED",
      entityType: "sales_call_demo",
      entityId: id,
      changes: { contactId, rawPayloadId, scheduledAt, externalEventId },
    });

    return id;
  }

  private async applyChatbotFlow(
    clinicId: string,
    contactId: string,
    rawPayloadId: string,
    payload: WebsiteLeadCapturePayload,
    mapping: WebsiteLeadIntentMapping,
  ) {
    if (mapping.leadType !== "chatbot") return null;

    const contact = await contactsService.getContact(clinicId, contactId);
    const conversationId = pick(payload, "chatbotConversationId", "conversationId") || rawPayloadId;
    const transcript = pick(payload, "conversationTranscript", "transcript", "message", "notes");
    const marker = `[Chatbot conversation ${conversationId}]`;
    const note = [
      marker,
      transcript ? `Transcript:\n${transcript}` : "Conversation captured without transcript text.",
      mapping.packageInterest ? `Package interest: ${mapping.packageInterest}` : null,
    ].filter(Boolean).join("\n");
    const notes = contact.notes?.includes(marker)
      ? contact.notes
      : [contact.notes, note].filter(Boolean).join("\n\n");

    await pool.execute(
      `UPDATE contact
       SET notes = ?,
           latest_source = ?,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ? AND clinic_id = ? AND deleted_at IS NULL`,
      [notes, mapping.source, contactId, clinicId],
    );

    await logTimelineActivity({
      clinicId,
      contactId,
      userId: null,
      type: "Note",
      metadata: buildTimelineMetadata({
        action: "chatbot_conversation_captured",
        source: "contact",
        recordId: rawPayloadId,
        title: "Chatbot conversation captured",
        changes: {
          rawPayloadId,
          conversationId,
          hasTranscript: Boolean(transcript),
          packageInterest: mapping.packageInterest,
          internal: true,
          visibility: "internal",
        },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId: null,
      action: "CHATBOT_CONVERSATION_CAPTURED",
      entityType: "contact",
      entityId: contactId,
      changes: { rawPayloadId, conversationId, hasTranscript: Boolean(transcript) },
    });

    return rawPayloadId;
  }

  private getPipelineStageName(mapping: WebsiteLeadIntentMapping, sourceConfig?: WebsiteLeadSourceConfig) {
    const configuredStage = cleanString(sourceConfig?.initialStageName);
    if (configuredStage) return configuredStage;
    if (mapping.leadType === "schedule_call") return "Discovery Booked";
    if (mapping.leadType === "lead_magnet_nurture") return "Nurture";
    if (mapping.leadType === "free_audit") return "Free Audit Needed";
    return "New Lead";
  }

  private async ensureInboundPipelineDeal(
    clinicId: string,
    contactId: string,
    payload: WebsiteLeadCapturePayload,
    mapping: WebsiteLeadIntentMapping,
    sourceConfig?: WebsiteLeadSourceConfig,
  ) {
    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM deal
       WHERE clinic_id = ?
         AND contact_id = ?
         AND status = 'open'
         AND deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 1`,
      [clinicId, contactId],
    );
    if (existingRows[0]?.id) return existingRows[0].id as string;

    const pipelineId = await pipelineService.ensureDefaultPipeline(clinicId, null);
    const stageName = this.getPipelineStageName(mapping, sourceConfig);
    const [stageRows]: any = await pool.execute(
      `SELECT id, name
       FROM pipeline_stage
       WHERE clinic_id = ?
         AND pipeline_id = ?
         AND deleted_at IS NULL
       ORDER BY
         CASE WHEN name = ? THEN 0 WHEN position = 1 THEN 1 ELSE 2 END,
         position ASC,
         created_at ASC
       LIMIT 1`,
      [clinicId, pipelineId, stageName],
    );
    const stage = stageRows[0];
    if (!stage?.id) return null;

    const contact = await contactsService.getContact(clinicId, contactId);
    const dealId = uuidv4();
    const packageInterest = mapping.packageInterest || contact.packageInterest || contact.treatmentInterests?.[0] || null;
    const title = `${contact.accountName || contact.name} - ${packageInterest || "Inbound opportunity"}`;

    await pool.execute(
      `INSERT INTO deal
        (id, clinic_id, contact_id, pipeline_id, pipeline_stage_id, title, value,
         stage, probability, expected_close_date, owner_id, source, treatment,
         status, stage_changed_at, created_by)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, 0, NULL, ?, ?, ?, 'open', CURRENT_TIMESTAMP, NULL)`,
      [
        dealId,
        clinicId,
        contactId,
        pipelineId,
        stage.id,
        title.slice(0, 255),
        stage.name,
        sourceConfig?.ownerUserId || null,
        mapping.source,
        packageInterest,
      ],
    );

    await logTimelineActivity({
      clinicId,
      contactId,
      userId: null,
      type: "StatusChange",
      metadata: buildTimelineMetadata({
        action: "inbound_pipeline_opportunity_created",
        source: "pipeline",
        recordId: dealId,
        title: "Inbound opportunity created",
        changes: {
          stage: stage.name,
          source: mapping.source,
          leadType: mapping.leadType,
          packageInterest,
          ownerUserId: sourceConfig?.ownerUserId || null,
          ctaClicked: pick(payload, "ctaClicked", "cta_clicked", "cta"),
        },
      }),
    });

    await logAuditEvent({
      clinicId,
      userId: null,
      action: "INBOUND_PIPELINE_OPPORTUNITY_CREATED",
      entityType: "deal",
      entityId: dealId,
      changes: { contactId, stage: stage.name, source: mapping.source, leadType: mapping.leadType, ownerUserId: sourceConfig?.ownerUserId || null },
    });

    return dealId;
  }

  private async ensureGuideNextActionTask(
    clinicId: string,
    contactId: string,
    contactName: string,
    guideContext: GuideDownloadContext,
    sourceConfig?: WebsiteLeadSourceConfig,
  ) {
    const title = "Request/calculate Clinic Growth Score";
    const [existingRows]: any = await pool.execute(
      `SELECT id
       FROM task
       WHERE clinic_id = ?
         AND contact_id = ?
         AND title = ?
         AND is_internal = 1
         AND status <> 'completed'
         AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT 1`,
      [clinicId, contactId, title],
    );
    if (existingRows[0]?.id) return existingRows[0].id as string;

    const taskId = uuidv4();
    const owner = await this.getOwnerAssignment(clinicId, sourceConfig?.ownerUserId || null);
    await pool.execute(
      `INSERT INTO task
        (id, clinic_id, is_internal, title, description, priority, status, category, board_key, service_type,
         contact_id, contact_name, due_label, due_date, assigned_to, assigned_user_id, created_by)
       VALUES (?, ?, 1, ?, ?, 'medium', 'pending', 'sales_follow_up', 'sales', 'strategy', ?, ?, 'Next action', ?, ?, ?, NULL)`,
      [
        taskId,
        clinicId,
        title,
        `Free guide downloaded: ${guideContext.guideName}\nDownloaded at: ${guideContext.downloadedAt}\nNext action: ${guideContext.nextAction}`,
        contactId,
        contactName,
        tomorrowDateOnly(),
        owner.label,
        owner.userId,
      ],
    );

    await logAuditEvent({
      clinicId,
      userId: null,
      action: "WEBSITE_GUIDE_NEXT_ACTION_TASK_CREATED",
      entityType: "task",
      entityId: taskId,
      changes: {
        contactId,
        guideName: guideContext.guideName,
        downloadedAt: guideContext.downloadedAt,
        nextAction: guideContext.nextAction,
        assignedUserId: owner.userId,
      },
    });

    return taskId;
  }

  private async getOwnerAssignment(clinicId: string, ownerUserId: string | null) {
    if (!ownerUserId) return { userId: null as string | null, label: null as string | null };

    const [rows]: any = await pool.execute(
      `SELECT id,
              first_name as firstName,
              last_name as lastName,
              email
       FROM user
       WHERE id = ?
         AND clinic_id = ?
         AND deleted_at IS NULL
         AND is_active = 1
       LIMIT 1`,
      [ownerUserId, clinicId],
    );
    const owner = rows[0];
    if (!owner?.id) return { userId: null as string | null, label: null as string | null };

    const label = [owner.firstName, owner.lastName].filter(Boolean).join(" ").trim() || owner.email || null;
    return { userId: owner.id as string, label };
  }

  private async createPayloadLog(
    clinicId: string,
    eventId: string | null,
    payload: WebsiteLeadCapturePayload,
    apiKeyId: string,
    payloadSource = PAYLOAD_SOURCE,
  ) {
    const id = uuidv4();
    const payloadJson = JSON.stringify({
      ...(payload || {}),
      _apiKeyId: apiKeyId,
    });

    try {
      await pool.execute(
        `INSERT INTO integration_raw_payload
          (id, clinic_id, source, source_event_id, payload, status, created_by)
         VALUES (?, ?, ?, ?, ?, 'received', ?)`,
        [id, clinicId, payloadSource, eventId, payloadJson, null],
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
        [clinicId, payloadSource, eventId],
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
        [payloadJson, null, existing.id, clinicId],
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
