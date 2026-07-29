# Provider Integration Patterns

## Status

Accepted.

## Context

Mission Control integrates with external providers for messaging, inbound email, Google Drive, OAuth, AI support, payments and other operational workflows. These providers have different authentication models, retry behavior and webhook formats.

Provider integrations must be safe to test, replaceable, auditable and tenant-aware.

## Decision

Provider integrations follow an adapter pattern:

- Runtime behavior is selected through environment configuration.
- Safe log/mock modes are preferred when a real provider is not configured.
- Inbound webhooks must authenticate the provider request before processing payloads.
- Tenant/workspace routing must be derived from trusted provider metadata or stored integration configuration.
- Outbound provider sends must use idempotency keys or stored send records to prevent duplicate sends.
- Provider responses, failures and manual fallbacks must be auditable.

## Consequences

Integrations can be enabled gradually without making development or review depend on live credentials.

Provider-specific code stays behind service/provider modules instead of spreading through controllers and UI code.

Real provider setup must be treated as environment and operations work, not as hard-coded application behavior.

## Implementation Notes

- WhatsApp supports log, Meta and Twilio provider modes.
- Meta WhatsApp webhooks validate `X-Hub-Signature-256` using the app secret.
- Twilio WhatsApp webhooks validate the Twilio signature against the exact webhook URL and form parameters.
- WhatsApp inbound routing uses receiving phone number IDs or configured Twilio receiving addresses.
- Email inbound routing uses recipient-address workspace mapping and a webhook secret.
- Google Drive validation uses refreshable OAuth or service-account credentials and rejects inaccessible, trashed or unsupported items.
- AI-assisted replies use guardrails, confidence checks, business-hour rules and human handoff decisions.
