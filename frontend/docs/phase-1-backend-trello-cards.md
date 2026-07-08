# Phase 1 Backend Trello Cards

> Superseded note: this file was drafted from the earlier strategic plan and still contains framework/database language that does not match the current backend. Use `docs/revised-phase-1-backend-trello-plan.md` for the current Express/MySQL-aligned Trello plan.

Purpose: create the backend workstream for the first sellable Clinic Growth OS release.

Board lists to create:

- Sprint 0 - Setup
- Sprint 1 - Auth and Tenancy
- Sprint 2 - Onboarding and Treatments
- Sprint 3 - Leads and Inbox
- Sprint 4 - Pipeline and SLA
- Sprint 5 - Calls
- Sprint 6 - Consults and Plan Value
- Sprint 7 - Revenue Dashboard
- Sprint 8 - Attribution and ROAS
- Sprint 9 - AI Growth Brief
- Sprint 10 - Benchmarks, Competitors, Reputation
- Sprint 11 - Reports and Pilot QA
- Backend Hardening

Suggested labels:

- Backend
- Phase 1
- P0
- P1
- Multi-tenant
- Events
- AI
- Integrations
- Reporting
- Security

Global backend definition of done:

- API works locally and on staging.
- Every record is scoped by `clinic_id` where applicable.
- Tenant isolation is tested.
- Request validation exists.
- Errors return a consistent response shape.
- Important actions write to `events` and/or `audit_logs`.
- Empty/error/loading states have enough API support for the frontend.
- Michael can test it as a clinic user.

## Sprint 0 - Setup

### BE-001 - Backend framework, environments, and project baseline

Labels: Backend, Phase 1, P0

Description:
Set up the backend foundation for the sellable Phase 1 product. Confirm Express vs NestJS direction, dev scripts, environment config, and staging-ready project structure.

Checklist:
- Confirm backend framework and module structure.
- Confirm local, staging, and future production env variables.
- Add health endpoint.
- Add request logging.
- Add error response middleware.
- Add validation approach.
- Add README setup steps.

Acceptance:
- Backend boots locally with one command.
- Health endpoint returns service status.
- Env example file is complete.
- Michael can run the backend without developer help.

### BE-002 - PostgreSQL and Prisma schema v1

Labels: Backend, Phase 1, P0, Multi-tenant

Description:
Create the first schema draft for Phase 1 modules, built around clinics, events, leads, calls, consults, revenue, insights, and reports.

Checklist:
- Add Prisma/Postgres setup.
- Add base multi-tenant columns: `id`, `clinic_id`, `created_at`, `updated_at`.
- Draft schema for Phase 1 tables.
- Add indexes for `clinic_id`, dates, status fields, and common filters.
- Add seed data for demo clinic.

Acceptance:
- Migrations run cleanly.
- Seed creates a usable demo clinic.
- Schema supports Phase 1 without obvious generic CRM drift.

### BE-003 - Event model and logging standard

Labels: Backend, Phase 1, P0, Events

Description:
Create the shared event model that all Phase 1 modules use for reporting, timelines, audits, and AI insight generation.

Checklist:
- Create `events` table.
- Standardise event types such as `lead_created`, `call_received`, `consult_sold`, `insight_generated`.
- Add event logging service.
- Add event query helper scoped by clinic.
- Document when to write events vs audit logs.

Acceptance:
- Services can write events through one helper.
- Events always include clinic scope.
- Event payloads are structured JSON.

## Sprint 1 - Auth and Tenancy

### BE-004 - Auth endpoints and session model

Labels: Backend, Phase 1, P0, Security

Description:
Build authentication endpoints needed for owner/staff login and demo clinic access.

Endpoints:
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Checklist:
- Register user.
- Login user.
- Return current user/session.
- Password reset support or integration point.
- Token/session expiry.
- Auth errors use consistent format.

Acceptance:
- User can register and log in.
- Invalid credentials fail safely.
- Frontend receives enough session data to render app shell.

### BE-005 - Clinics, user memberships, roles, and invites

Labels: Backend, Phase 1, P0, Multi-tenant, Security

Description:
Build clinic creation, clinic membership, user-clinic relationships, and team invite flows.

Endpoints:
- `POST /clinics`
- `GET /clinics`
- `GET /clinics/:clinicId`
- `PATCH /clinics/:clinicId`
- `POST /clinics/:clinicId/users/invite`
- `PATCH /clinics/:clinicId/users/:userId/role`
- `DELETE /clinics/:clinicId/users/:userId`

Checklist:
- Create clinic.
- List clinics for current user.
- Invite team member.
- Change role.
- Remove user from clinic.
- Support roles: Owner, Manager, Reception, Practitioner, Agency / Analyst, Super Admin.

Acceptance:
- User can create a clinic.
- Owner can invite team member.
- User can only see clinics they belong to.

### BE-006 - Tenant middleware and permission middleware

Labels: Backend, Phase 1, P0, Multi-tenant, Security

Description:
Enforce tenant isolation and role permissions across all clinic-scoped routes.

Checklist:
- Resolve active clinic per request.
- Reject access to another clinic.
- Add permission middleware.
- Add super admin bypass rules.
- Add tests for cross-clinic access.

Acceptance:
- A user from Clinic A cannot read/update Clinic B data.
- Missing or invalid clinic context fails closed.
- Permission errors are clear.

### BE-007 - Audit log service

Labels: Backend, Phase 1, P1, Events, Security

Description:
Track important security and configuration actions.

Endpoints:
- `GET /clinics/:clinicId/audit-log`

Checklist:
- Create `audit_logs` table/service.
- Log login-sensitive and account-management actions.
- Log role changes, invites, removals, clinic setting changes.
- Add clinic-scoped audit log query.

Acceptance:
- Audit feed returns current clinic actions only.
- Role changes are auditable.

## Sprint 2 - Onboarding and Treatments

### BE-008 - Onboarding status and partial-save endpoints

Labels: Backend, Phase 1, P0, Multi-tenant

Description:
Build the clinic onboarding backend so Michael can onboard pilot clinics quickly.

Endpoints:
- `GET /onboarding/status`
- `PATCH /onboarding/clinic-basics`
- `PATCH /onboarding/team`
- `PATCH /onboarding/treatments`
- `PATCH /onboarding/lead-sources`
- `PATCH /onboarding/call-tracking`
- `PATCH /onboarding/marketing`
- `PATCH /onboarding/competitors`
- `PATCH /onboarding/reviews`
- `POST /onboarding/complete`

Checklist:
- Store step completion.
- Allow partial save.
- Return completion percentage.
- Validate minimum required fields.
- Create default clinic setup on completion.

Acceptance:
- Clinic can resume onboarding.
- Completion percentage is correct.
- Onboarding can be completed in under 45 minutes.

### BE-009 - Staff and practitioner profiles

Labels: Backend, Phase 1, P0

Description:
Create staff/practitioner records used by consults, calls, tasks, and conversion reporting.

Checklist:
- Add staff profile model.
- Add practitioner profile model.
- Link profiles to clinic users where relevant.
- Add CRUD endpoints.
- Include active/inactive state.

Acceptance:
- Practitioners are selectable for consults.
- Staff can be used for lead assignment and response metrics.

### BE-010 - Treatment categories and treatments API

Labels: Backend, Phase 1, P0, Reporting

Description:
Build commercial treatment data used for revenue, consult, treatment plan, and benchmark intelligence.

Endpoints:
- `GET /treatment-categories`
- `POST /treatments`
- `GET /treatments`
- `PATCH /treatments/:id`
- `DELETE /treatments/:id`
- `GET /metrics/treatments/performance`

Checklist:
- Seed default categories: Injectables, Skin, Laser, Body, Surgery, Wellness, Other.
- Add treatment CRUD.
- Average price.
- Optional margin estimate.
- Priority/high-ticket flags.

Acceptance:
- Treatments are clinic-scoped.
- Treatment values can drive revenue estimates.
- Categories remain standardised for Phase 1.

### BE-011 - Default clinic setup automation

Labels: Backend, Phase 1, P0, Events

Description:
When a clinic completes onboarding, automatically create standard pipeline stages, call outcomes, consult outcomes, and default settings.

Checklist:
- Create default pipeline stages.
- Create default call outcomes.
- Create default consult outcomes.
- Create default SLA setting.
- Create default review/reputation settings.

Acceptance:
- New clinic has usable defaults immediately.
- Defaults are not over-customised.

## Sprint 3 - Leads and Inbox

### BE-012 - Lead CRUD, filters, and search

Labels: Backend, Phase 1, P0, Multi-tenant

Description:
Build the lead model and APIs powering the unified lead inbox.

Endpoints:
- `POST /leads`
- `GET /leads`
- `GET /leads/:id`
- `PATCH /leads/:id`
- `DELETE /leads/:id`

Checklist:
- Required lead fields from build guide.
- Search by name, phone, email.
- Filters by status, source, campaign, treatment, assigned staff.
- Pagination.
- Tenant isolation.

Acceptance:
- Leads can be manually created.
- Inbox filters are fast.
- Leads cannot leak between clinics.

### BE-013 - Lead notes, tags, timeline, and events

Labels: Backend, Phase 1, P0, Events

Description:
Build lead activity history and timeline support.

Endpoints:
- `POST /leads/:id/notes`
- `GET /leads/:id/timeline`
- `PATCH /leads/:id/assign`

Checklist:
- Add lead notes.
- Add standard and custom tags.
- Record assignment changes.
- Record stage changes.
- Timeline combines notes and events.

Acceptance:
- Lead detail drawer has a useful timeline.
- Every important lead action logs an event.

### BE-014 - Website form webhook and UTM capture

Labels: Backend, Phase 1, P0, Integrations, Events

Description:
Allow website forms to create leads with source, campaign, UTM and click-id data.

Endpoints:
- `POST /webhooks/leads`

Checklist:
- Validate webhook payload.
- Capture source/campaign/UTMs.
- Capture `gclid` and `fbclid`.
- Create lead.
- Write `lead_created` event.
- Return useful webhook response.

Acceptance:
- Test webhook creates lead in correct clinic.
- UTM data is stored.

### BE-015 - Lead duplicate detection and CSV export

Labels: Backend, Phase 1, P1

Description:
Detect duplicates by phone/email and export filtered leads for clinic reporting.

Endpoints:
- `GET /leads/export`

Checklist:
- Duplicate detection helper.
- Duplicate match endpoint or flag on create/list.
- CSV export respects filters and clinic scope.
- Export includes key commercial fields.

Acceptance:
- Duplicate leads can be identified.
- CSV export never includes another clinic's data.

## Sprint 4 - Pipeline and SLA

### BE-016 - Pipeline stages and stage movement

Labels: Backend, Phase 1, P0, Events

Description:
Build pipeline stages and stage transition APIs for the conversion pipeline.

Endpoints:
- `GET /pipeline`
- `GET /pipeline/stages`
- `POST /pipeline/stages`
- `PATCH /pipeline/stages/:id`
- `PATCH /leads/:id/stage`
- `GET /metrics/pipeline`

Checklist:
- Default stages: New, Contacted, Qualified, Consult Booked, Consult Attended, Sold, Lost.
- Stage history.
- Required fields on key transitions.
- Lost reason.
- Sold revenue value.
- Consult date when booking.

Acceptance:
- Leads move through stages.
- Stage transitions write events.
- Pipeline summary metrics are returned.

### BE-017 - SLA engine and breach detection

Labels: Backend, Phase 1, P0, Reporting

Description:
Track speed-to-lead performance and detect missed response targets.

Endpoints:
- `GET /sla/summary`
- `GET /sla/breaches`
- `PATCH /leads/:id/mark-contacted`
- `GET /metrics/response-time`
- `GET /metrics/staff-response`

Checklist:
- Set SLA deadline on lead creation.
- Record first response time.
- Breach detection job every minute.
- Average response time.
- Breach percentage.
- Staff leaderboard.
- Estimated revenue risk calculation.

Acceptance:
- SLA breach is detected.
- Marking contacted records first response.
- Revenue risk is labelled estimated.

## Sprint 5 - Calls

### BE-018 - Twilio tracking number and inbound call webhooks

Labels: Backend, Phase 1, P0, Integrations

Description:
Set up the core Twilio call tracking path.

Endpoints:
- `POST /webhooks/twilio/calls`
- `POST /webhooks/twilio/recordings`

Checklist:
- Assign tracking number per clinic.
- Receive inbound call metadata.
- Store call SID, from/to numbers, duration, status.
- Store recording URL or storage key.
- Handle webhook retries safely.

Acceptance:
- Test call creates backend call record.
- Recording metadata is stored.

### BE-019 - Call list, details, notes, tags, and outcomes

Labels: Backend, Phase 1, P0, Events

Description:
Build clinic call management APIs.

Endpoints:
- `GET /calls`
- `GET /calls/:id`
- `PATCH /calls/:id`
- `POST /calls/:id/notes`
- `GET /metrics/calls/summary`
- `GET /metrics/calls/staff`

Checklist:
- Call filters.
- Outcome tags.
- Call notes.
- Missed call flag.
- Staff attribution.
- Call export-ready fields.

Acceptance:
- Calls can be tagged.
- Call conversion metrics are calculated.

### BE-020 - Call-to-lead matching and missed call recovery

Labels: Backend, Phase 1, P0, Events

Description:
Match calls to existing leads by phone number or create a new lead where no match exists.

Checklist:
- Normalize phone numbers.
- Match call to lead.
- Create lead if no match.
- Mark missed calls for recovery.
- Write call and lead events.

Acceptance:
- Existing lead is linked correctly.
- Unknown caller creates a new lead.
- Missed call appears as a revenue recovery opportunity.

### BE-021 - AI call analysis job

Labels: Backend, Phase 1, P1, AI

Description:
Create structured AI call analysis from transcript/manual transcript.

Endpoints:
- `POST /calls/:id/analyse`
- `GET /calls/:id/analysis`
- `PATCH /calls/:id/analysis`

Checklist:
- Manual transcript input supported.
- AI job row.
- Structured JSON output.
- Store summary, sentiment, objections, appointment offered, deposit requested, follow-up, improvement, quality score.
- Allow regeneration.
- Allow manual correction.

Acceptance:
- AI output matches documented JSON structure.
- AI insights are labelled advisory.

## Sprint 6 - Consults and Plan Value

### BE-022 - Consult CRUD and outcome logging

Labels: Backend, Phase 1, P0, Events, Reporting

Description:
Build consult tracking linked to leads, practitioners, treatments, outcomes, and revenue.

Endpoints:
- `POST /consults`
- `GET /consults`
- `GET /consults/:id`
- `PATCH /consults/:id`
- `PATCH /consults/:id/outcome`
- `GET /metrics/consults/summary`
- `GET /metrics/practitioners/conversion`

Checklist:
- Link consult to lead.
- Practitioner assignment.
- Treatment interest.
- Attended/no-show.
- Outcome labels.
- Revenue value.
- Deposit taken/amount.
- Lost reason.
- Follow-up required.

Acceptance:
- Outcome can be logged in under 20 seconds.
- Practitioner conversion metrics are available.

### BE-023 - Treatment plan value light

Labels: Backend, Phase 1, P1, Reporting

Description:
Build commercial treatment plan value tracking without drifting into EMR/clinical notes.

Endpoints:
- `POST /consults/:id/treatment-plan`
- `PATCH /treatment-plans/:id`
- `GET /metrics/treatment-plans`

Checklist:
- Treatment plan status.
- Expected value.
- Realised revenue.
- Deposit amount.
- Number of sessions.
- Accepted/rejected.
- Drop-off flag.
- Link to consult.

Acceptance:
- Plan value metrics work.
- No clinical note fields are introduced.

## Sprint 7 - Revenue Dashboard

### BE-024 - Dashboard summary and funnel APIs

Labels: Backend, Phase 1, P0, Reporting

Description:
Build the dashboard aggregation layer answering whether the clinic is making money and where it leaks money.

Endpoints:
- `GET /dashboard/summary`
- `GET /dashboard/funnel`
- `GET /dashboard/revenue-leaks`
- `GET /dashboard/top-opportunities`

Checklist:
- Date range filters.
- Revenue this month.
- Revenue vs previous period.
- Lead-to-revenue funnel.
- Missed lead revenue risk.
- No-show revenue risk.
- Low consult conversion opportunity.
- Cache expensive queries.

Acceptance:
- Dashboard loads quickly.
- Metrics are clinic-scoped.
- Leak calculations are explainable.

### BE-025 - Revenue by channel, treatment, practitioner, and source

Labels: Backend, Phase 1, P0, Reporting

Description:
Build breakdown APIs needed for revenue intelligence and ROAS clarity.

Endpoints:
- `GET /dashboard/revenue-by-channel`
- `GET /dashboard/revenue-by-treatment`
- `GET /metrics/practitioners/revenue`
- `GET /metrics/sources/revenue`

Checklist:
- Revenue by channel.
- Revenue by treatment.
- Revenue by practitioner.
- Revenue by source.
- Average treatment value.
- Cost-ready response format.

Acceptance:
- Owner can identify best/worst channels and treatments.

## Sprint 8 - Attribution and ROAS

### BE-026 - Manual ad spend and campaign mapping

Labels: Backend, Phase 1, P0, Reporting

Description:
Manual fallback first for ad spend, campaign data, and channel mapping.

Endpoints:
- `POST /ad-spend`
- `GET /ad-spend`
- `PATCH /ad-spend/:id`

Checklist:
- Manual spend entry.
- Channel mapping.
- Campaign mapping.
- Date range.
- Source attribution labels: exact, estimated, manual, unknown.
- Manual correction.

Acceptance:
- User can enter spend without Google/Meta API.
- Spend is clinic-scoped and auditable.

### BE-027 - ROAS and campaign metrics

Labels: Backend, Phase 1, P0, Reporting

Description:
Calculate cost per lead, consult, sold treatment, and ROAS by channel/campaign.

Endpoints:
- `GET /metrics/roas`
- `GET /metrics/campaigns`

Checklist:
- Cost per lead.
- Cost per booked consult.
- Cost per attended consult.
- Cost per sold treatment.
- ROAS by channel.
- ROAS by campaign.
- Estimated vs exact labels.

Acceptance:
- Dashboard can show cost per booked consult and ROAS.
- Attribution assumptions are visible.

## Sprint 9 - AI Growth Brief

### BE-028 - AI insight generation job and prompt logs

Labels: Backend, Phase 1, P0, AI, Reporting

Description:
Generate 3-5 metric-backed growth insights for clinic owners.

Endpoints:
- `GET /insights`
- `POST /insights/generate`

Checklist:
- Insight generation job.
- Pull source metrics.
- Structured prompt.
- Store AI output.
- Store prompt logs.
- Insight types: fix, scale, risk, staff_performance, channel_performance, consult_conversion, call_conversion, revenue_leak.

Acceptance:
- Insights cite metrics.
- Output is commercially useful and specific.

### BE-029 - Insight actions, assignment, archive, and history

Labels: Backend, Phase 1, P1, AI

Description:
Let clinics act on and track AI recommendations.

Endpoints:
- `PATCH /insights/:id/complete`
- `PATCH /insights/:id/archive`
- `POST /insights/:id/assign`

Checklist:
- Assign insight action.
- Mark complete.
- Archive.
- Insight history.
- Staff-facing action version.

Acceptance:
- Insights can move from recommendation to completed action.

## Sprint 10 - Benchmarks, Competitors, Reputation

### BE-030 - Benchmarking v1

Labels: Backend, Phase 1, P1, Reporting

Description:
Build anonymised benchmark calculations for core revenue-control metrics.

Endpoints:
- `GET /benchmarks`
- `GET /benchmarks/:metric`
- `POST /benchmarks/recalculate`

Checklist:
- Metric snapshots.
- Percentile calculation.
- Top quartile comparison.
- Exclude insufficient data.
- Minimum data thresholds.
- Benchmark gap explanation.

Acceptance:
- Clinic sees safe benchmark comparisons.
- Insufficient-data metrics are labelled clearly.

### BE-031 - Competitor snapshot light

Labels: Backend, Phase 1, P1, AI

Description:
Lightweight competitor tracking and AI differentiation suggestions. No heavy scraping.

Endpoints:
- `POST /competitors`
- `GET /competitors`
- `PATCH /competitors/:id`
- `DELETE /competitors/:id`
- `POST /competitors/:id/generate-insight`

Checklist:
- Competitor CRUD.
- Website/location/focus treatments/offers/pricing position/notes.
- AI differentiation suggestion.
- AI campaign angle.
- Link competitor opportunities to insights.

Acceptance:
- Competitors can be added and turned into useful strategic notes.

### BE-032 - Review and reputation basics

Labels: Backend, Phase 1, P1, AI

Description:
Build Google review link storage, review request tracking, and AI reply suggestions.

Endpoints:
- `GET /reputation`
- `POST /review-requests`
- `GET /review-requests`
- `POST /reviews/reply-suggestion`
- `PATCH /settings/google-review-link`

Checklist:
- Store Google review link.
- Review request template.
- Review request count.
- Manual review received count.
- AI reply suggestion.
- GBP checklist.

Acceptance:
- Reputation basics are visible and compliance-safe.

## Sprint 11 - Reports and Pilot QA

### BE-033 - Reports, snapshots, and CSV export

Labels: Backend, Phase 1, P1, Reporting

Description:
Build report generation and export for monthly executive reporting.

Endpoints:
- `POST /reports/generate`
- `GET /reports`
- `GET /reports/:id`
- `GET /reports/:id/export`

Checklist:
- Revenue summary.
- Funnel summary.
- Call conversion summary.
- Consult conversion summary.
- ROAS summary.
- Benchmark summary.
- AI recommendations.
- CSV export.

Acceptance:
- Monthly report snapshot can be generated and retrieved.
- CSV export works.

### BE-034 - Pilot clinic setup, demo data, and backend QA

Labels: Backend, Phase 1, P0, Security

Description:
Prepare backend for pilot clinic onboarding and Max's demo flow.

Checklist:
- Create pilot/demo clinic seed.
- Add realistic leads, calls, consults, revenue, insights.
- Run tenant isolation tests.
- Run endpoint smoke tests.
- Verify first sellable release checklist.
- Fix backend blockers.

Acceptance:
- Max can demo confidently.
- Michael can onboard without developer help.

## Backend Hardening

### BE-035 - Tenant isolation test suite

Labels: Backend, Phase 1, P0, Multi-tenant, Security

Description:
Create reusable automated tests proving no clinic can access another clinic's records.

Checklist:
- Test read isolation.
- Test write isolation.
- Test list endpoints.
- Test exports.
- Test webhooks route to correct clinic.
- Test super admin rules separately.

Acceptance:
- Tenant isolation tests pass in CI/local test command.

### BE-036 - Background jobs baseline with Redis/BullMQ

Labels: Backend, Phase 1, P0, Reporting

Description:
Set up background jobs used by SLA checks, AI insights, dashboards, benchmarks, and reports.

Checklist:
- Redis config.
- BullMQ setup.
- Job runner process.
- Retry policy.
- Job logging.
- Failed job visibility.
- Initial jobs: `checkSLABreaches`, `dailySLAReport`.

Acceptance:
- Jobs can run locally and on staging.
- Failed jobs are observable.

### BE-037 - API validation, rate limits, and consistent errors

Labels: Backend, Phase 1, P0, Security

Description:
Standardise validation and API failure behaviour across Phase 1 modules.

Checklist:
- Request validation for all mutating endpoints.
- Consistent error response.
- Rate limit sensitive endpoints.
- Webhook signature/secret validation where available.
- Safe logging without secrets.

Acceptance:
- Frontend can reliably display API errors.
- Sensitive endpoints are protected.
