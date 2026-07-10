# Mission Control Data Isolation

MC-003 keeps this internal CRM separate from the clinic-facing launch system.

## Rules

- Do not reuse clinic-facing production webhooks, callback URLs, API keys, Stripe keys, Twilio credentials, OAuth credentials, email sender credentials, or database credentials.
- Real `.env` files stay local and ignored by Git. The tracked examples intentionally leave external provider secrets blank.
- Mission Control webhook integrations must point to Mission Control environments only.
- Patient, medical, treatment, review/reputation, and clinic launch demo records should not be loaded into a fresh Mission Control database.
- Legacy table and API names such as `clinic_id`, `appointment`, and `treatment` can remain for compatibility until a dedicated schema/API rename pass.

## Current State

- `backend/db.sql` is the source of truth for a fresh internal database.
- Legacy clinic-facing demo rows for clinical notes, old dashboards, campaign examples, consents, consult templates, review/reputation examples, documents, appointments, and external integration placeholders have been removed from the fresh DB seed.
- The old staging demo seed file is retained only as a legacy compatibility artifact and is explicitly marked as not approved for Mission Control demo data.
- `npm run seed:staging-demo` now requires `DEMO_SEED_SQL` to be set explicitly, so the legacy seed cannot be loaded by default.
- Frontend webhook examples are sandbox-only mock events and are marked inactive until Mission Control-owned provider endpoints are configured.

## Before Staging Or Production

- Confirm all provider credentials belong to Mission Control, not the clinic CRM.
- Confirm webhook URLs use the Mission Control domain for that environment.
- Confirm fresh database setup starts from `backend/db.sql`.
- Confirm any optional demo seed is internal-only and does not contain patient or medical records.
