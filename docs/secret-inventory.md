# Mission Control Secret Inventory

This inventory records secret names and ownership only. Never put live values in Git, tickets, screenshots or QA artifacts.

| Category | Variable name | Service | Environment | Owner role | Rotatable? | Dual-key support? | Restart required? | External provider? |
|---|---|---|---|---|---|---|---|---|
| Session signing | JWT_SECRET | Mission Control backend | staging, production | Engineering lead | Yes | No | Yes | No |
| Database access | DB_PASSWORD | MySQL | staging, production | Deployment owner | Yes | Provider dependent | Yes | Hosting/database |
| Credential encryption | CREDENTIAL_ENCRYPTION_KEY | Mission Control backend | staging, production | Engineering lead | Yes | Yes, via CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS | Yes | No |
| Credential encryption | CREDENTIAL_ENCRYPTION_PREVIOUS_KEYS | Mission Control backend | staging, production | Engineering lead | Yes | Yes | Yes | No |
| Credential encryption legacy bridge | CREDENTIAL_ENCRYPTION_LEGACY_JWT_SECRET | Mission Control backend | temporary rotation only | Engineering lead | Remove after rewrap | Temporary only | Yes | No |
| Backups | BACKUP_ENCRYPTION_KEY | Backup tooling | staging, production | Deployment owner | Yes | No | Next backup job | Storage provider |
| Release signing | RELEASE_MANIFEST_SIGNING_KEY | Release scripts | CI | Release owner | Yes | No | No, CI secret update | GitHub/CI |
| Promotion webhook | PROMOTION_DEPLOY_WEBHOOK_URL | Release scripts | CI | Deployment owner | Yes | Provider dependent | No, CI secret update | Hosting provider |
| Observability webhook | OBSERVABILITY_ALERT_WEBHOOK_URL | Backend/runtime | staging, production | Operations owner | Yes | Provider dependent | Yes | Monitoring provider |
| Observability webhook | OBSERVABILITY_ALERT_WEBHOOK_TOKEN | Backend/runtime | staging, production | Operations owner | Yes | Provider dependent | Yes | Monitoring provider |
| Observability test | OBSERVABILITY_TEST_TOKEN | Backend/runtime | staging only unless approved | Operations owner | Yes | No | Yes | No |
| ClinicGrower event signing | CLINICGROWER_EVENT_SIGNING_SECRET | ClinicGrower event webhook | staging, production | Engineering lead | Yes | Sender/consumer overlap required | Yes | Paired product |
| ClickUp API | CLICKUP_API_TOKEN | ClickUp integration | staging, production | Integration owner | Yes | No | Yes | ClickUp |
| ClickUp OAuth | CLICKUP_CLIENT_SECRET | ClickUp integration | staging, production | Integration owner | Yes | Provider dependent | Yes | ClickUp |
| ClickUp webhook | CLICKUP_WEBHOOK_SECRET | ClickUp integration | staging, production | Integration owner | Yes | Provider dependent | Yes | ClickUp |
| OpenAI | OPENAI_API_KEY | AI features | staging, production | AI/platform owner | Yes | No | Yes | OpenAI |
| Twilio | TWILIO_AUTH_TOKEN | SMS/WhatsApp/calls | staging, production | Telephony owner | Yes | Provider dependent | Yes | Twilio |
| Twilio webhook | TWILIO_WEBHOOK_SECRET | SMS/WhatsApp/calls | staging, production | Telephony owner | Yes | Provider dependent | Yes | Twilio |
| WhatsApp Meta | WHATSAPP_ACCESS_TOKEN | WhatsApp provider | staging, production | Messaging owner | Yes | Provider dependent | Yes | Meta |
| WhatsApp Meta | WHATSAPP_VERIFY_TOKEN | WhatsApp provider | staging, production | Messaging owner | Yes | Provider dependent | Yes | Meta |
| WhatsApp Meta | WHATSAPP_APP_SECRET | WhatsApp provider | staging, production | Messaging owner | Yes | Provider dependent | Yes | Meta |
| E-signature | ESIGN_API_KEY | Proposal acceptance | staging, production | Commercial ops owner | Yes | Provider dependent | Yes | E-sign provider |
| E-signature webhook | ESIGN_WEBHOOK_SECRET | Proposal acceptance | staging, production | Commercial ops owner | Yes | Provider dependent | Yes | E-sign provider |
| Google OAuth | GOOGLE_CLIENT_SECRET | Calendar/Drive/OAuth | staging, production | Integration owner | Yes | Provider dependent | Yes | Google |
| Google Drive | GOOGLE_DRIVE_REFRESH_TOKEN | Drive integration | staging, production | Integration owner | Yes | Provider dependent | Yes | Google |
| Google service account | GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY | Drive integration | staging, production | Integration owner | Yes | Provider dependent | Yes | Google |
| Google Ads | GOOGLE_ADS_DEVELOPER_TOKEN | Ads integration | staging, production | Marketing ops owner | Yes | Provider dependent | Yes | Google |
| QuickBooks | QUICKBOOKS_CLIENT_SECRET | Finance integration | staging, production | Finance ops owner | Yes | Provider dependent | Yes | Intuit |
| Stripe | STRIPE_SECRET_KEY | Payments | staging, production | Finance ops owner | Yes | Provider dependent | Yes | Stripe |
| Stripe webhook | STRIPE_WEBHOOK_SECRET | Payments | staging, production | Finance ops owner | Yes | Provider dependent | Yes | Stripe |

## Engineering-Prepared Controls

- Backend configuration fails closed for missing or placeholder non-local secrets.
- `JWT_SECRET` no longer falls back to a known hardcoded value outside the explicit test-only fixture.
- `CREDENTIAL_ENCRYPTION_KEY` supports active and previous key material for controlled rewraps.
- Secret scanners inspect tracked source/docs and available build output without reading real `.env` values.
- Frontend public environment scanning allowlists intentional `NEXT_PUBLIC_*` values and blocks private secret names.
- Observability redaction tests cover provider keys, webhook tokens, payment secrets and release signing material.

## External Owner Actions

- Choose and configure the approved vault or password manager.
- Move live staging/production values into that vault or the hosting platform secret store.
- Grant access by role with MFA and quarterly review.
- Rotate any credential suspected of appearing in local QA artifacts.
- Run one staging rotation rehearsal before marking CG-019 operationally complete.
