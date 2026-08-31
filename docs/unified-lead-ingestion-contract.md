# Unified Lead Ingestion Contract

This is the CG-157 Mission Control contract for normalising inbound leads and
lead-like events from forms, chatbot, calls, scheduler bookings, email,
provider lead forms and manual entry.

## Goal

Every test lead should enter Mission Control exactly once with original/latest
source, clinic type where supplied, consent wording/source, timestamps,
owner/SLA/next action and replayable failure evidence.

## Canonical Identity

Use the strongest available identity in this order:

1. Provider/source event ID.
2. Channel-specific ID such as CallSid, provider message ID, chatbot
   conversation ID or scheduler event ID.
3. Normalised email.
4. Normalised phone.
5. Clinic/account name plus contact name when no external ID exists.

Identity is always scoped to the Mission Control workspace/clinic. A matching
value in another workspace must not update or reuse the same record.

## Source Attribution

Each source should preserve:

- original source;
- latest source;
- campaign and medium where available;
- landing page, form, referrer or provider event;
- external lead ID or source event ID;
- timestamp;
- owner/follow-up assignment where configured.

Retries must not overwrite original attribution incorrectly.

## Consent

Consent is stored only when supplied by the source. Mission Control should keep:

- permission source or wording;
- email, phone, SMS and WhatsApp permissions;
- opt-in/opt-out timestamps where supplied;
- do-not-contact state.

Do not invent consent for provider or manual events.

## Required Channels

The backend exposes the current channel contract through:

`GET /api/integration-inputs/setup-audit`

The `leadIngestion` section lists:

- website forms;
- landing-page forms;
- chatbot;
- scheduler bookings;
- Twilio calls;
- Twilio SMS;
- missed calls;
- Gmail/email enquiries;
- Meta Lead Ads;
- Google Ads lead forms;
- manual entry;
- Fireflies post-call;
- WhatsApp Business API.

Each entry states whether the source is ready, partial, provider-dependent or
blocked, plus endpoint, identity fields, attribution fields, consent fields,
idempotency and replay behaviour.

## Provider-Blocked Sources

Google Ads lead forms, Fireflies post-call and WhatsApp Business API must not
be presented as live until their provider account, signed webhook, consent and
retention requirements are approved and configured.

WhatsApp remains a manual task/fallback until official WhatsApp Business API
approval, consent policy, signed webhooks and dedupe are ready.

Fireflies remains governed by the CG-095 post-call intelligence contract before
live ingestion is enabled.

## Current Implemented Paths

- Landing-page forms use `/api/public/landing-page-leads`.
- Website forms and chatbot signals use `/api/public/website-leads`.
- Meta lead form payloads use `/api/integration-inputs/public/meta-leads`.
- Manual lead entry uses `/api/integration-inputs/manual-leads`.
- Email enquiries use `/api/webhooks/email/inbound`.
- Calls and missed-call recovery use the existing Twilio and ClinicGrower
  webhook paths.
- Fleet/Clinic OS sync uses the fleet ingestion queue and replay model.

## Failure And Replay

Source events are recorded with source event IDs, payload summaries or raw
payload records where the existing path supports it. Queue-based paths expose
retry, dead-letter and replay through the fleet sync health surface.

## Review Gaps

Full acceptance still needs real provider evidence for provider-dependent
channels. Repo-side implementation must not claim live Meta, Google, Fireflies
or WhatsApp proof without actual account/webhook evidence.
