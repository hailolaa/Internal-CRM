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

Minimum local values:

```bash
PORT=3000
NODE_ENV=development
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password_here
DB_NAME=clinic_grower_crm
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

There are two supported database workflows.

### Option A: Import `db.sql`

This is the fastest way to reset local/dev data when you are comfortable dropping and recreating the database.

```bash
mysql -u root -p -e "DROP DATABASE IF EXISTS clinic_grower_crm; CREATE DATABASE clinic_grower_crm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
mysql -u root -p clinic_grower_crm < db.sql
npm run db:migrate
```

Why run `db:migrate` after importing `db.sql`?

- `db.sql` already contains the current schema.
- `npm run db:migrate` creates/updates `schema_migration`.
- The runner checks whether historical migrations are already satisfied and records them without replaying destructive or duplicate `ALTER TABLE` statements.
- After this, future migrations can be applied normally.

### Option B: Apply Migrations To An Existing DB

```bash
npm run db:migrate
```

The runner:

- Reads SQL files from `migrations/` in filename order.
- Creates `schema_migration` if missing.
- Stores SHA256 checksums.
- Skips already applied migrations.
- Fails if an applied migration file changed.
- Detects already-satisfied historical migrations from databases created by `db.sql`.

Useful migration commands:

```bash
npm run db:migrate
npm run db:migrate -- --dry-run
npm run db:migrate -- 20260609_monthly_action_plans.sql
npm run db:migrate -- --baseline
```

Use `--baseline` only when you intentionally want to mark pending migration files as applied without running them.

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
- `migrations/` contains forward SQL migrations.
- `schema_migration` tracks applied migration filenames and checksums.
- Do not edit old applied migration files casually; add a new migration instead.
- If `db.sql` is updated with a new table/column, add the corresponding migration in the same change.
