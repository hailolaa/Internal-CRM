import assert from "node:assert/strict";
import test from "node:test";
import {
  buildGuideDownloadContext,
  buildWebsiteLeadContactPermissions,
  mapWebsiteLeadIntent,
} from "../modules/website-leads/website-leads.service.js";

test("Clinic Growth Score form maps to the Free Clinic Growth Audit without implying a verified score", () => {
  const result = mapWebsiteLeadIntent({
    formName: "Clinic Growth Score form",
    ctaClicked: "Get my free audit",
  });

  assert.equal(result.source, "website_free_clinic_growth_audit");
  assert.equal(result.leadType, "free_audit");
  assert.equal(result.packageInterest, "Free Clinic Growth Audit");
});

test("free guide download maps to lead magnet nurture", () => {
  const result = mapWebsiteLeadIntent({
    guideName: "Free guide: 7 ways to increase enquiries",
    formName: "Guide download",
  });

  assert.equal(result.source, "website_lead_magnet");
  assert.equal(result.leadType, "lead_magnet_nurture");
  assert.equal(result.packageInterest, null);
});

test("free guide download stores guide title, download time, and Growth Score next action", () => {
  const context = buildGuideDownloadContext({
    guideTitle: "Clinic Growth Guide",
    downloadedAt: "2026-07-16T10:30:00.000Z",
  });

  assert.equal(context.guideName, "Clinic Growth Guide");
  assert.equal(context.downloadedAt, "2026-07-16T10:30:00.000Z");
  assert.equal(context.nextAction, "Start Free Clinic Growth Audit");
});

test("website package CTAs map to the approved funnel and monthly package interests", () => {
  const cases = [
    ["Book Clinic Growth Diagnostic", "Clinic Growth Diagnostic", "website_clinic_growth_diagnostic_cta", "package_interest"],
    ["Prove one priority treatment with Treatment Growth", "Treatment Growth", "website_treatment_growth_cta", "package_interest"],
    ["Talk to us about Lead Concierge", "Clinic Growth", "website_clinic_growth_cta", "package_interest"],
    ["Book a Performance OS demo", "Clinic Growth", "website_clinic_growth_cta", "demo_request"],
    ["Scale with Growth Engine", "Clinic Growth", "website_clinic_growth_cta", "package_interest"],
    ["Become the Market Leader", "Market Leader", "website_market_leader_cta", "package_interest"],
  ] as const;

  for (const [ctaClicked, packageInterest, source, leadType] of cases) {
    const result = mapWebsiteLeadIntent({ ctaClicked });
    assert.equal(result.source, source);
    assert.equal(result.leadType, leadType);
    assert.equal(result.packageInterest, packageInterest);
  }
});

test("contact form and manual referral sources are supported", () => {
  const contact = mapWebsiteLeadIntent({ formName: "Contact form" });
  assert.equal(contact.source, "website_contact_form");
  assert.equal(contact.leadType, "contact_enquiry");

  const manual = mapWebsiteLeadIntent({ source: "manual phone lead" });
  assert.equal(manual.source, "manual phone lead");
  assert.equal(manual.leadType, "manual");

  const referral = mapWebsiteLeadIntent({ source: "Partner referral" });
  assert.equal(referral.source, "referral");
  assert.equal(referral.leadType, "referral");
});

test("Calendly and schedule-call submissions map to scheduled sales calls", () => {
  const result = mapWebsiteLeadIntent({
    source: "website",
    calendlyEventUri: "https://api.calendly.com/scheduled_events/event-123",
    ctaClicked: "Book a Clinic Growth call",
    scheduledAt: "2026-08-05T10:00:00.000Z",
  });

  assert.equal(result.source, "website_schedule_call");
  assert.equal(result.leadType, "schedule_call");
  assert.equal(result.packageInterest, "Clinic Growth");
  assert.ok(result.tags.includes("website_schedule_call"));
});

test("chatbot submissions map to chatbot lead capture", () => {
  const result = mapWebsiteLeadIntent({
    source: "website",
    chatbotConversationId: "chat-123",
    conversationTranscript: "I need help with Performance OS and reporting.",
  });

  assert.equal(result.source, "website_chatbot");
  assert.equal(result.leadType, "chatbot");
  assert.equal(result.packageInterest, "Clinic Growth");
  assert.ok(result.tags.includes("website_chatbot"));
});

test("website submissions map consent values into CRM contact permissions", () => {
  const permissions = buildWebsiteLeadContactPermissions({
    consent: {
      email: true,
      phone: "yes",
      whatsapp: 1,
      permissionSource: "growth score form",
      optInAt: "2026-07-16T08:45:00.000Z",
    },
  });

  assert.deepEqual(permissions.communicationPermissions, {
    email: true,
    sms: false,
    whatsapp: true,
    phone: true,
  });
  assert.equal(permissions.canEmail, true);
  assert.equal(permissions.canCall, true);
  assert.equal(permissions.canWhatsAppMessage, true);
  assert.equal(permissions.permissionSource, "growth score form");
  assert.equal(permissions.optInAt, "2026-07-16 08:45:00");
});

test("unsubscribe and do-not-contact suppress unsafe outreach channels", () => {
  const unsubscribed = buildWebsiteLeadContactPermissions({
    emailConsent: true,
    whatsappConsent: true,
    phoneConsent: true,
    unsubscribed: true,
    permissionSource: "unsubscribe link",
  });

  assert.equal(unsubscribed.emailPermission, false);
  assert.equal(unsubscribed.whatsappPermission, false);
  assert.equal(unsubscribed.phonePermission, true);
  assert.equal(unsubscribed.unsubscribed, true);
  assert.equal(Boolean(unsubscribed.optOutAt), true);

  const doNotContact = buildWebsiteLeadContactPermissions({
    consent: {
      email: true,
      phone: true,
      whatsapp: true,
      doNotContact: "yes",
    },
  });

  assert.deepEqual(doNotContact.communicationPermissions, {
    email: false,
    sms: false,
    whatsapp: false,
    phone: false,
  });
  assert.equal(doNotContact.doNotContact, true);
});
