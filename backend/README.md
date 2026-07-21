# ClinicGrower CRM Backend

Express, TypeScript and MySQL backend for the ClinicGrower CRM / Clinic Performance OS.

The backend is a multi-tenant API for clinic CRM workflows, revenue reporting, leakage detection, insight generation, monthly action planning, internal delivery operations, integrations and admin settings.

## Current Features

- Auth, JWT sessions, 2FA foundations, team, roles, permissions and audit logging.
- Clinic profile, settings, locations, billing and Stripe subscription/deposit foundations.
- Contacts/leads with CRUD, imports, duplicate candidates, mark-contacted behavior, timeline activity and grouped linked activity for calls/forms/bookings/messages.
- Pipeline stages and deals, including opportunity metadata and movement tracking.
- Appointments, clinician availability, consult records and consult metrics.
- Twilio call webhook ingestion, call recordings metadata, call outcomes, missed-call recovery fields and staff call metrics.
- SLA / speed-to-lead settings, breach tracking and lead response metrics.
- Public and authenticated forms, message templates, communication sequences and lightweight comms APIs.
- Manual spend, campaign metrics, marketing metrics, offers and reviews.
- Treatment catalog, treatment plans and revenue-by-treatment reporting.
- Deposits and payment status fields, including Stripe checkout/payment metadata.
- Reports dashboard endpoints for summary, funnel, revenue by channel, revenue by treatment, revenue leaks, revenue leak details and top opportunities.
- Generated monthly report detail and secure share-token endpoints for authenticated reads and public shared report views.
- Revenue leakage detail contract for missed calls, SLA breaches, no-shows and low consult conversion.
- Insight v1 model and `/api/insights` endpoints for revenue leakage insight generation, OpenAI-backed enrichment with deterministic fallback, assignment, status updates and linked action task creation.
- Monthly Action Plan v1 model and `/api/monthly-action-plans` endpoints for month-scoped plan generation, plan status updates and item status updates.
- General clinic tasks plus ClinicGrower internal delivery tasks with boards, workflow month, QA, archive, missed/escalation flags and client account links.
- Client account profiles, services, all-client summaries, current-month action plan health, internal delivery pressure counts, SOPs and strategy logs.
- AI workspace project/run persistence and AI tool scaffolding.
- API keys, webhooks, integrations cards/connect/disconnect and background job state/run tracking.
- Database backup, restore and migration runner scripts.

## In Progress / Partial Features

- OpenAI-backed insight generation is opt-in via env config; deterministic leakage generation remains the safe fallback.
- Revenue leakage has useful detail views, but deeper links to message/form/booking/treatment/monthly-plan context are still being expanded.
- Monthly Action Plan v1 exists, and internal client account delivery views now surface plan health/status.
- Reporting Centre has generated monthly report records, authenticated detail reads and secure public share links; browser print/PDF is handled by the frontend.
- Attribution exists in parts, and lead detail can show linked calls/forms/bookings/messages, but full source/campaign to consult/treatment/revenue/insight/action attribution is not complete.
- Call intelligence stores outcomes and recording metadata, but transcript ingestion, AI summaries and quality scoring are not complete.
- Internal Control Centre has usable client account summaries, alerts and action-plan status per client, but package-level plan data and richer owner/status fields are still pending.

## Pending Features

- Call summary service interface and transcript-backed call intelligence.
- Dedicated alert inbox/detail views if alerts diverge from insights.
- Team performance dashboard and individual front-desk/staff accountability scoring.
- Treatment performance list/detail pages, source mix, treatment funnel and ROI per treatment.
- Report share revocation/expiry management if pilots need public links to be managed after creation.
- Production Google Ads, Meta, GBP, GA4, SEO and OpenAI integrations or documented manual import fallbacks.
- Broader tenant isolation tests across the full commercial data chain.
- Deployment/integration documentation for production environments.

## Tech Stack

- Node.js ESM
- Express 5
- TypeScript
- MySQL via `mysql2/promise`
- JWT authentication
- Stripe SDK
- Brevo/log email provider support
- Twilio-compatible call webhook ingestion

## Install

```bash
npm install
cp .env.example .env
```

Fill `.env` with local or deployed service values.

## Database migrations

`db.sql` is the fresh-database bootstrap. Existing databases must be upgraded with
the ordered, checksum-tracked migration runner:

```bash
npm run db:migrate
```

The runner applies `scripts/migrations/*.sql` in filename order and records each
checksum in `schema_migration`. Never edit an applied migration; add a newer,
idempotent migration instead. Deployments should back up the database, run the
migration command, build the application, and only then restart the API.

Minimum local values:

```bash
PORT=3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=growth_group_internal_crm
DB_SSL=false
JWT_SECRET=replace-with-a-long-random-secret
FRONTEND_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000
```

For email, Stripe, OAuth and external integrations, leave keys blank in local development unless you are testing that integration.

OpenAI-backed revenue insight enrichment is disabled by default. To enable it:

```bash
OPENAI_API_KEY=sk-...
OPENAI_INSIGHTS_ENABLED=true
OPENAI_INSIGHTS_MODEL=gpt-5-mini
OPENAI_TIMEOUT_MS=15000
```

When OpenAI is disabled, missing or unavailable, `/api/insights/generate` still creates deterministic leakage insights and stores fallback metadata on each insight.

WhatsApp AI lead replies are safe-by-default. Local and staging environments should use `WHATSAPP_PROVIDER=log` unless a real Meta WhatsApp Cloud API number is intentionally connected. In log mode, Mission Control stores inbound messages, drafts replies, approval status and audit history without sending an external WhatsApp message.

To enable live WhatsApp sending:

```bash
WHATSAPP_PROVIDER=meta
WHATSAPP_ACCESS_TOKEN=<Meta WhatsApp Cloud API access token>
WHATSAPP_PHONE_NUMBER_ID=<Meta phone number id>
WHATSAPP_API_VERSION=v20.0
WHATSAPP_VERIFY_TOKEN=<Meta webhook verify token>
WHATSAPP_APP_SECRET=<Meta app secret used to validate X-Hub-Signature-256>
WHATSAPP_WEBHOOK_WORKSPACE_ID=<internal workspace id for this WhatsApp number>
# Optional for multiple Meta phone numbers:
# WHATSAPP_WEBHOOK_WORKSPACE_MAP={"<Meta phone number id>":"<internal workspace id>"}
```

Meta webhook callback URL:

```bash
https://api-mission-control.thegrowthgroup.com/api/webhooks/whatsapp/inbound
```

Use `WHATSAPP_VERIFY_TOKEN` as the Meta webhook verify token. Subscribe the webhook to inbound WhatsApp message events. Public webhook POSTs must include Meta `X-Hub-Signature-256`; Mission Control validates it with `WHATSAPP_APP_SECRET` over the raw request body and rejects unsigned or invalid requests. Public webhook tenant routing is resolved from Meta's receiving `phone_number_id`, using `WHATSAPP_WEBHOOK_WORKSPACE_ID` for one connected number or `WHATSAPP_WEBHOOK_WORKSPACE_MAP` for multiple numbers. Do not pass workspace or clinic ids in the callback URL. AI auto-send remains off unless the workspace WhatsApp AI setting explicitly enables it. Opt-outs, sensitive requests, low-confidence replies and after-hours replies are routed to human review.

## Google Drive Client Folders

Client account profiles can store a designated Google Drive folder URL, folder ID, or ZIP file link. The backend validates the item through Google Drive before saving it, normalizes accepted links into a canonical Drive URL, and stores access-check metadata on the client account profile.

Drive validation requires refreshable Google credentials:

```bash
GOOGLE_DRIVE_VALIDATION_ENABLED=true
GOOGLE_DRIVE_REFRESH_TOKEN=<refresh token with Drive metadata access>
# or
GOOGLE_DRIVE_SERVICE_ACCOUNT_EMAIL=<service account email>
GOOGLE_DRIVE_SERVICE_ACCOUNT_PRIVATE_KEY=<service account private key>
GOOGLE_DRIVE_SERVICE_ACCOUNT_SUBJECT=<optional delegated user>
GOOGLE_DRIVE_SCOPES=https://www.googleapis.com/auth/drive
```

Mission Control rejects inaccessible links, trashed items and non-folder/non-ZIP files before saving. Static expiring access tokens are not used for Drive validation.

## Phase 1 Integration Inputs

The Phase 1 Performance OS can launch before every vendor API is live by using API-key ingestion and manual import fallbacks. All records are clinic-scoped.

Website forms:

- Public endpoint: `POST /api/public/forms/:id/submit`
- Auth: clinic API key in `Authorization: Bearer <key>` or `x-api-key`
- Requires: active form definition and API key
- Stores: `form_submission` raw JSON and a linked contact/lead where possible

Meta lead forms and manual lead fallback:

- Public Meta/manual endpoint: `POST /api/integration-inputs/public/meta-leads`
- Auth: clinic API key
- Internal manual lead endpoint: `POST /api/integration-inputs/manual-leads`
- Stores: raw payload in `integration_raw_payload` and creates a contact lead with source/status/treatment interest

Twilio-compatible call tracking:

- Call status endpoint: `POST /api/webhooks/twilio/calls`
- Recording endpoint: `POST /api/webhooks/twilio/recordings`
- Requires: Twilio status/recording callbacks configured, plus a clinic tracking number in `call_tracking_number` or an active `twilio` integration config with `phone_number`, `tracking_number`, or `twilio_number`
- Stores: call status, missed-call flag, recording URL/SID/status/duration and raw webhook payload on the call record

Manual Google/GBP/GA4/SEO metrics:

- Create endpoint: `POST /api/integration-inputs/manual-metrics`
- List endpoint: `GET /api/integration-inputs/manual-metrics`
- Supports platforms: `google_ads`, `ga4`, `google_business_profile`, `meta`, `seo`, `other`
- Stores: metric date, campaign/location labels, metric name/value/unit, attribution label and optional raw payload

Stripe package and billing bridge:

- Billing status: `GET /api/billing`
- Package summary bridge: `GET /api/integration-inputs/stripe/package-summary`
- Requires for live Stripe: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PLAN_STARTER_ID`, `STRIPE_PLAN_PROFESSIONAL_ID`
- Uses Stripe subscription fields on `clinic` plus active `client_account_service` records for package/service views

OpenAI summaries and insights:

- Revenue leakage insight generation: `POST /api/insights/generate`
- Summary interface/placeholder: `POST /api/integration-inputs/openai/summary-preview`
- Optional env: `OPENAI_API_KEY`, `OPENAI_API_URL`, `OPENAI_INSIGHTS_ENABLED`, `OPENAI_INSIGHTS_MODEL`, `OPENAI_TIMEOUT_MS`
- If OpenAI is disabled or unavailable, the backend returns deterministic/placeholder output and records fallback metadata instead of mock data

Setup audit:

- Endpoint: `GET /api/integration-inputs/setup-audit`
- Reports whether website forms, Meta lead intake, Twilio, manual metrics, Stripe package bridge and OpenAI summary paths are ready or need setup.

## Database Setup

The internal CRM uses `db.sql` as the source of truth for fresh local/dev databases.

```bash
mysql -u root -p < db.sql
```

When the schema changes, update `db.sql` directly and recreate the local/dev database from that file.

## Run

Development:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Production-style start after build:

```bash
npm run start
```

Health checks:

```bash
curl http://localhost:3000/api/health/ready
curl http://localhost:3000/health/ready
```

## Backup And Restore

Backup:

```bash
npm run db:backup
```

Restore:

```bash
npm run db:restore -- path/to/backup.sql
```

Backup and restore use `MYSQLDUMP_BIN`, `MYSQL_BIN`, `BACKUP_DIR` and the DB variables from `.env`.

## Verification

Core checks:

```bash
npm run build
node dist/test/test-reports-dashboard.js
node dist/test/test-monthly-action-plans.js
```

Additional focused test files exist under `src/test/` for calls, ad spend, client accounts and internal delivery tasks.

Phase 1 browser release QA:

```bash
npm run qa:phase1
```

Use [docs/phase1-browser-qa.md](docs/phase1-browser-qa.md) before staging/production deploys to cover auth, tenant switching, revenue dashboard, leakage, insights, action plans, leads, calls, reports, internal ops, settings and command palette workflows.

## API Areas

The app registers API modules under `/api`, including:

- `/api/auth`
- `/api/contacts`
- `/api/pipeline`
- `/api/appointments`
- `/api/consults`
- `/api/calls`
- `/api/sla`
- `/api/reports`
- `/api/insights`
- `/api/monthly-action-plans`
- `/api/tasks`
- `/api/client-accounts`
- `/api/strategy-logs`
- `/api/sops`
- `/api/integrations`
- `/api/settings`
- `/api/health`

Most routes require JWT authentication and permission checks.

## Repository Notes

- `db.sql` is the current full schema dump.
- This repo is now optimized for fresh internal CRM databases, so old clinic upgrade SQL files are not part of the active setup path.
- If `db.sql` is updated with a new table/column, keep the change in `db.sql`.
