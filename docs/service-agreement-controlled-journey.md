# ClinicGrower Service Agreement Controlled Journey

This runbook covers the Mission Control bridge from an accepted proposal to a ClinicGrower-branded service agreement. It does not define legal wording. Max/Solicitor approval remains the source of truth for production legal content.

## Source Inputs

- `accepted_proposal`: must be an accepted or won proposal with a stored acceptance record and client account profile.
- `manual_entry`: must include explicit commercial terms entered by an authorised user.
- `transcript_draft`: must include explicit commercial terms extracted and reviewed by an authorised user.

Mission Control must not invent package, price, scope, VAT, payment or legal terms.

## Registry

The backend validates every render against server-side registry values:

- `SERVICE_AGREEMENT_LEGAL_TERMS_VERSION`
- `SERVICE_AGREEMENT_LEGAL_CONTENT_SHA256`
- `SERVICE_AGREEMENT_TEMPLATE_VERSION`
- `SERVICE_AGREEMENT_TEMPLATE_SHA256`
- `SERVICE_AGREEMENT_CSS_SHA256`
- `SERVICE_AGREEMENT_ASSET_MANIFEST_SHA256`
- `SERVICE_AGREEMENT_ALLOWED_ASSET_PREFIXES`
- `SERVICE_AGREEMENT_PRODUCTION_SEND_ENABLED`

Submitted hashes are compared to the server registry. The payload cannot approve its own expected hash.

## Controls

- Test renders are marked `DO NOT SEND - TEST RENDER`.
- Production external-send approval fails closed unless the registry is complete and production send is enabled.
- Max approval binds approver, payload hash, legal hash, template hash, CSS hash and asset manifest hash.
- E-sign evidence is attached only after Max approval and is immutable once stored.
- QuickBooks staging uses one idempotency key per service agreement.
- Onboarding unlock requires signed agreement evidence, QuickBooks staging and authenticated cleared payment.
- All rows are tenant scoped by `clinic_id`.

## Remaining Production Gates

- Actual Playwright-rendered agreement PDF.
- Visual regression screenshots proving no overlap, clipping, broken glyphs, blank pages or unresolved tokens.
- Michael UAT evidence.
- Max production activation approval.
- Production deployment and verification after approval.
