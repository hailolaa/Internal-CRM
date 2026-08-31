export type LeadIngestionChannelKey =
  | "website_forms"
  | "landing_page_forms"
  | "chatbot"
  | "scheduler_bookings"
  | "twilio_calls"
  | "twilio_sms"
  | "missed_calls"
  | "gmail_enquiries"
  | "meta_lead_ads"
  | "google_ads_lead_forms"
  | "manual_entry"
  | "fireflies_post_call"
  | "whatsapp_business_api";

export type LeadIngestionChannelStatus = "ready" | "partial" | "provider_dependent" | "blocked";

export interface LeadIngestionChannelContract {
  channel: LeadIngestionChannelKey;
  label: string;
  status: LeadIngestionChannelStatus;
  endpoint: string | null;
  targetRecord: "contact" | "email" | "call" | "fleet_ingestion_event";
  identity: string[];
  attribution: string[];
  consent: string[];
  idempotency: string;
  replay: string;
  notes: string;
}

interface LeadIngestionReadinessInput {
  apiKeyCount: number;
  formCount: number;
  hasTwilio: boolean;
  hasTrackingNumber: boolean;
  hasMeta: boolean;
  hasGoogle: boolean;
  hasCalendar: boolean;
  hasEmailWebhook: boolean;
}

const BASE_ATTRIBUTION = [
  "originalSource",
  "latestSource",
  "campaign",
  "medium",
  "landingPage",
  "referrer",
  "timestamp",
] as const;

const BASE_CONSENT = ["consent wording/source", "channel opt-in", "opt-out/do-not-contact"] as const;

export function buildLeadIngestionContract(input: LeadIngestionReadinessInput): LeadIngestionChannelContract[] {
  const websiteReady = input.formCount > 0 && input.apiKeyCount > 0;
  const apiKeyReady = input.apiKeyCount > 0;
  const twilioReady = input.hasTwilio || input.hasTrackingNumber;

  return [
    {
      channel: "website_forms",
      label: "Website forms",
      status: websiteReady ? "ready" : "partial",
      endpoint: "/api/public/forms/:id/submit",
      targetRecord: "contact",
      identity: ["form submission ID", "email", "phone", "clinic/account name"],
      attribution: [...BASE_ATTRIBUTION, "form name"],
      consent: [...BASE_CONSENT, "form checkbox"],
      idempotency: "form submission/source event ID per workspace",
      replay: "stored integration_raw_payload event can be reviewed by source_event_id",
      notes: "Uses the existing form submission and website lead capture flow.",
    },
    {
      channel: "landing_page_forms",
      label: "Landing-page forms",
      status: apiKeyReady ? "ready" : "partial",
      endpoint: "/api/public/landing-page-leads",
      targetRecord: "contact",
      identity: ["idempotencyKey", "email", "phone", "clinic/account name"],
      attribution: [...BASE_ATTRIBUTION, "gclid", "fbclid", "msclkid"],
      consent: [...BASE_CONSENT, "landing page permission source"],
      idempotency: "idempotencyKey reserved per API key/workspace",
      replay: "duplicate retries return the original linked contact without creating another lead",
      notes: "Private server-to-server API key; never browser-public.",
    },
    {
      channel: "chatbot",
      label: "Website chatbot",
      status: apiKeyReady ? "ready" : "partial",
      endpoint: "/api/public/website-leads",
      targetRecord: "contact",
      identity: ["chatbot conversation ID", "email", "phone", "clinic/account name"],
      attribution: [...BASE_ATTRIBUTION, "chatbot conversation ID"],
      consent: [...BASE_CONSENT, "chatbot consent step"],
      idempotency: "chatbotConversationId/conversationId",
      replay: "raw payload stores the transcript and linked contact",
      notes: "Normalised into the website lead flow with chatbot-specific follow-up.",
    },
    {
      channel: "scheduler_bookings",
      label: "Scheduler bookings",
      status: input.hasCalendar ? "provider_dependent" : "partial",
      endpoint: "/api/public/website-leads",
      targetRecord: "contact",
      identity: ["calendar event ID", "invitee URI", "email", "phone"],
      attribution: [...BASE_ATTRIBUTION, "scheduled at"],
      consent: [...BASE_CONSENT, "booking form consent"],
      idempotency: "calendlyEventId/calendlyEventUri/eventStartTime fallback",
      replay: "stored payload links booking signal to lead/contact and task",
      notes: "Calendar provider OAuth/config controls whether this is live or manual/API-fed.",
    },
    {
      channel: "twilio_calls",
      label: "Twilio calls",
      status: twilioReady ? "ready" : "partial",
      endpoint: "/api/webhooks/twilio/calls",
      targetRecord: "call",
      identity: ["CallSid", "caller number", "tracking number"],
      attribution: ["tracking number", "call source", "timestamp"],
      consent: ["call handling policy", "do-not-contact respected when linked"],
      idempotency: "Twilio CallSid/provider event ID",
      replay: "provider event can be reprocessed through call status records",
      notes: "General call intake remains separate from missed-call recovery.",
    },
    {
      channel: "twilio_sms",
      label: "Twilio SMS",
      status: twilioReady ? "provider_dependent" : "partial",
      endpoint: "/api/webhooks/whatsapp/inbound",
      targetRecord: "contact",
      identity: ["provider message ID", "from number", "to number"],
      attribution: ["message channel", "tracking number", "timestamp"],
      consent: ["SMS/WhatsApp opt-in", "opt-out keywords"],
      idempotency: "provider message ID or stored message idempotency key",
      replay: "message audit records preserve provider status where configured",
      notes: "SMS/WhatsApp automation depends on the approved provider mode.",
    },
    {
      channel: "missed_calls",
      label: "Missed calls",
      status: twilioReady ? "ready" : "partial",
      endpoint: "/api/webhooks/clinicgrower/missed-call-recovery",
      targetRecord: "fleet_ingestion_event",
      identity: ["canonical call ID", "Twilio CallSid", "caller number"],
      attribution: ["tracking number", "call status", "occurred_at"],
      consent: ["recovery eligibility", "do-not-contact respected when linked"],
      idempotency: "signed missed-call event idempotency key",
      replay: "durable recovery event/fallback queue with retry state",
      notes: "Missed calls are recovery events, not a duplicate generic lead system.",
    },
    {
      channel: "gmail_enquiries",
      label: "Gmail/email enquiries",
      status: input.hasEmailWebhook ? "ready" : "partial",
      endpoint: "/api/webhooks/email/inbound",
      targetRecord: "email",
      identity: ["provider message ID", "sender email", "recipient mapping"],
      attribution: ["recipient inbox", "subject", "received_at"],
      consent: ["email reply context", "do-not-contact respected after linking"],
      idempotency: "provider message ID per workspace",
      replay: "thread and raw email records prevent duplicate inbound messages",
      notes: "Recipient-to-workspace mapping prevents cross-tenant ingestion.",
    },
    {
      channel: "meta_lead_ads",
      label: "Meta Lead Ads",
      status: input.hasMeta || apiKeyReady ? "provider_dependent" : "partial",
      endpoint: "/api/integration-inputs/public/meta-leads",
      targetRecord: "contact",
      identity: ["Meta leadgen ID/eventId", "email", "phone"],
      attribution: ["platform", "form_id", "campaign", "ad/adset IDs where supplied"],
      consent: [...BASE_CONSENT, "Meta form consent"],
      idempotency: "eventId/source_event_id",
      replay: "integration_raw_payload retains provider payload and linked contact",
      notes: "Live webhook/account proof is provider-dependent; API path is implemented.",
    },
    {
      channel: "google_ads_lead_forms",
      label: "Google Ads lead forms",
      status: input.hasGoogle ? "provider_dependent" : "blocked",
      endpoint: null,
      targetRecord: "contact",
      identity: ["Google lead form submission ID", "email", "phone"],
      attribution: ["gclid", "campaign", "ad group", "lead form asset"],
      consent: [...BASE_CONSENT, "Google lead form consent"],
      idempotency: "provider submission ID",
      replay: "manual/API import must preserve provider submission ID",
      notes: "Requires Google Ads lead-form source approval/config before live ingestion.",
    },
    {
      channel: "manual_entry",
      label: "Manual lead entry/import",
      status: "ready",
      endpoint: "/api/integration-inputs/manual-leads",
      targetRecord: "contact",
      identity: ["manual source event ID", "email", "phone", "clinic/account name"],
      attribution: ["manual source", "owner", "timestamp"],
      consent: ["operator-entered permission source", "do-not-contact"],
      idempotency: "eventId when supplied plus contact duplicate detection",
      replay: "manual source event is stored for audit/reconciliation",
      notes: "Authenticated CRM users only.",
    },
    {
      channel: "fireflies_post_call",
      label: "Fireflies post-call",
      status: "blocked",
      endpoint: null,
      targetRecord: "fleet_ingestion_event",
      identity: ["Fireflies meeting ID", "calendar event ID", "CRM record match"],
      attribution: ["meeting type", "participants", "recording/transcript timestamp"],
      consent: ["recording/transcription consent", "retention policy"],
      idempotency: "provider meeting ID/source event ID",
      replay: "must follow the CG-095 post-call intelligence contract before ingestion",
      notes: "Blocked until provider access, consent and retention policy are approved.",
    },
    {
      channel: "whatsapp_business_api",
      label: "WhatsApp Business API",
      status: "blocked",
      endpoint: null,
      targetRecord: "contact",
      identity: ["provider message ID", "phone number", "workspace phone mapping"],
      attribution: ["message channel", "template/conversation source", "timestamp"],
      consent: ["official WABA opt-in", "template approval", "opt-out handling"],
      idempotency: "provider message ID/idempotency key",
      replay: "manual task fallback remains until official provider approval",
      notes: "Blocked until official business account, signed webhooks, consent policy and dedupe are ready.",
    },
  ];
}
