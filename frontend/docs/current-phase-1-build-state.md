# Current Phase 1 Build State

Last audited: 2026-06-26

This note reconciles the current frontend and backend codebase against the Phase 1 Clinic Performance OS plan and the Trello Phase 1 cards.

Latest implementation sync: 2026-06-26

Latest pushed commits:
- Frontend: `9ea733b` - `feat(frontend): OAuth Login Callback QA And States and Global Command Palette shell`
- Backend: `072e6c4` - `feat(reports): add phase 1 CSV export suite`

## Audit Inputs

- Frontend repo: `clinic_grower_crm`
- Backend repo: `clinicgrower-crm-backend`
- Boss Phase 1 brief: pasted Master Build Bible attachments
- Planning docs: `docs/revised-phase-1-backend-trello-plan.md`, `docs/phase-1-backend-trello-cards.md`
- Trello board: Clinic Grower CRM

## Overall State

The product is no longer at a blank To Do state. The backend has a broad Express/MySQL foundation with real modules for CRM contacts, pipeline, appointments, consults, calls, SLA, forms, reports, manual spend, deposits, treatments, treatment plans, campaigns, reviews, integrations, AI workspace, tasks, internal tasks, client accounts, SOPs and strategy logs.

The frontend also has many real app pages wired to authenticated API calls, including the revenue dashboard, revenue leakage page, lead list, calls, SLA, reports, treatment plans, manual spend, manual consults, client accounts, campaigns, offers, reviews, integrations, tasks and settings.

Phase 1 is still partial because several areas are currently foundation-level rather than the complete commercial workflow described in the brief. The main remaining gaps are full attribution linking, broader detail views, call intelligence AI summaries and production integrations for Google/Meta/GBP/GA4/SEO/OpenAI.

## Recent Quick Wins Implemented

- `GET /api/auth/me` now exists in the backend, closing the explicit Auth Me card gap.
- OAuth login/signup callback handling now has a frontend `/oauth/callback` route with session verification, friendly errors and 2FA-required handling. Live provider credential/callback testing remains a staging QA item.
- Growth Brief generation now has a backend `POST /api/ai/growth-brief/generate` endpoint and a frontend generate/history/provenance UI. Local OpenAI-disabled behavior returns a controlled unavailable state.
- CSV exports now exist for Phase 1 revenue, attribution, pipeline and operational reports, with frontend CSV export controls and controlled unsupported-format states.
- Ads/report pages no longer fall back to static sample ad metrics, campaign rows, platform breakdowns or keyword rows when backend data is unavailable.
- Command palette shell routing was tightened for reports and log-call actions, and disabled actions are no longer included in search results.
- Phase 1 browser QA docs were expanded with a frontend evidence pack and the backend `npm run qa:phase1` checklist runner.
- Performance Dashboard v1 is connected to live report endpoints at `/app/revenue`.
- `/app/revenue` now includes a plain-English executive summary using live revenue, spend, ROAS, consult attendance, open opportunity and leakage data.
- Revenue Leakage v1 is connected to live report leakage endpoints at `/app/leakage`.
- `/app/leakage` now uses a dedicated backend leakage detail endpoint for missed calls, SLA breaches, no-shows and low consult conversion source records.
- Backend Insight v1 is implemented in the `db.sql` schema, `/api/insights` endpoints, deterministic leakage insight generation, status updates, assignment and linked action task creation.
- Insight generation now has an opt-in OpenAI enrichment layer using the Responses API, with deterministic fallback and provider/model/fallback metadata stored per insight.
- `/app/leakage` now includes a Revenue Insights panel that can generate insights, resolve insights and create linked action tasks.
- `/app/leakage` drill-down rows now show linked lead context counts, insight/task/action-plan status and open the lead drawer through `/app/leads?contactId=...`.
- Monthly Action Plan v1 is implemented with backend monthly plan tables/endpoints and a frontend workspace at `/app/action-plan`.
- Internal Control Centre now surfaces current-month action plan status, item counts, progress and action-plan pressure per client account.
- `/app/leads` now includes a lead detail drawer v2 with contact metadata, treatment interests, tags, notes, timeline events and linked calls/forms/bookings/messages.
- Reporting Centre generated monthly report v1 is implemented with an idempotent backend monthly snapshot endpoint and a frontend generate/preview flow on `/app/reports/overview`.
- Reporting Centre report detail/share/print v1 is implemented with authenticated report detail reads, secure public share tokens, public shared report rendering and browser print/PDF support.
- Internal Control Centre now includes an all-client account summary endpoint and frontend table at `/app/ops/client-accounts`.
- Internal Control Centre now shows internal account alerts for account risk, overdue/missed delivery pressure, renewal risk and missing strategy context.
- The backend all-client account summary now exposes `overdueTaskCount` and `missedTaskCount` for internal delivery pressure alerts.
- Internal task permissions were added to migration/db seed grants.
- Booked consult reporting now consistently counts scheduled, completed and no-show consult appointments where appointment-based booked counts are used.
- Signup payment lint issues were fixed and the frontend now passes `npm run lint`.

## Latest Trello Sync

Updated locally for Trello sync on 2026-06-26:

- `Phase 1: Auth Me Endpoint` should move to complete.
- `0Auth` should stay in awaiting review until staging OAuth provider callback testing is completed.
- `Phase 1: AI Growth Brief Generator Endpoint` should move to awaiting review pending OpenAI-enabled staging smoke testing.
- `Phase 1: Reports Export Suite` should move to awaiting review pending browser download QA.
- `Phase 1: Remove Remaining Frontend Sample Fallbacks` should move to awaiting review pending a final browser/API-failure sweep.
- `Phase 1 Extension: Global Command And Action Palette` should stay in progress pending browser verification of target actions and mobile/keyboard behavior.
- `Phase 1: Browser QA And Regression Test Pack` should stay in progress until the actual staging desktop/mobile run is captured.
- Add a follow-up card for missing AI generation backend endpoints because the frontend now calls show-rate, sales assistant, campaign analyst, LTV optimiser and competitor insights generation routes that are not exposed by the backend yet.

Copy-ready Trello comments/checklist changes are in `docs/current-trello-card-update-copy.md`.

Previously updated locally for Trello sync on 2026-06-09:

- `Phase 1: Executive Performance Dashboard` was previously updated to 5/6 complete. The executive-summary checklist item was marked complete.
- `Phase 1: Revenue Leakage Engine` should be updated for leakage context links: drill-down records now expose linked calls/bookings/forms/messages, insight/task/action-plan state and lead deep links.
- `Phase 1: Lead and Enquiry Hub` should be updated for lead detail drawer v2: grouped backend contact activity plus frontend linked calls/forms/bookings/messages tabs are complete.
- `Phase 1: ClinicGrower Internal Control Centre` should be updated for current-month action-plan health/status per client account, including missing/high-priority action-plan pressure alerts.
- `Phase 1: Monthly Action Plan` should be updated for backend/frontend v1 plus internal account status integration.
- `Phase 1: Reporting Centre` should be updated for generated monthly report v1: backend report snapshot generation, executive summary/risks/recommendations sections, frontend generate action and saved report preview are complete.
- `Phase 1: AI Performance Insights And Alerts` should be updated for OpenAI-backed leakage insight enrichment with deterministic fallback and metadata.

The cards remain in `in progress` because the broader Phase 1 scope is still not fully done.

## Area Status

### Core Performance Data Model

Status: Partial

Implemented:

- Clinic-scoped data exists for contacts/leads, calls, forms, appointments, consult entries, deposits, deals, treatments, treatment plans, spend entries, campaigns and reports.
- Dashboard/report endpoints can aggregate lead, funnel, spend, revenue, treatment, leakage and opportunity data.
- Dedicated `insight` records exist and can link to source records, contacts and created action tasks.
- Backend tests cover key report aggregation, revenue leakage details, insight generation/action tasks, client accounts and internal delivery task foundations.

Still left:

- Complete end-to-end attribution chain from source/campaign to lead, call/form/message, booking, consult, treatment, revenue, insight and action.
- Broader alert-specific records if alerts need to diverge from the current insight workflow.
- More tenant isolation tests across the full chain.

### Executive Performance Dashboard

Status: Partial but usable v1

Implemented:

- Backend report endpoints exist for dashboard summary, funnel, revenue by channel, revenue by treatment, revenue leaks and top opportunities.
- Frontend `/app/revenue` uses those live endpoints.
- Dashboard shows revenue, leakage, opportunities, source/channel, treatment and funnel cards with loading/error/empty handling.
- Dashboard now has a plain-English executive summary at the top that highlights the current commercial signal, main leakage focus, consult attendance pressure and next action.
- Report dashboard smoke test passes.

Still left:

- Monthly trend section.
- More explicit top risks/opportunities action workflow.

### Revenue Leakage Engine

Status: Partial but usable v1

Implemented:

- Backend leakage endpoint calculates missed calls, SLA breaches, no-shows and low consult conversion risk.
- Backend leakage detail endpoint returns a first-class normalized contract for missed calls, SLA breaches, no-shows and low consult conversion records.
- Frontend `/app/leakage` shows leakage categories, estimated risk and recommended actions.
- Frontend `/app/leakage` includes drill-down v1 tables for missed calls, SLA breaches, no-shows and low consult conversion records using the dedicated detail endpoint.
- Revenue leakage details can generate active insights and linked action tasks.
- Revenue leakage detail records include context counts for linked calls, bookings, forms, messages and activity, plus linked insight, action task and monthly action plan item state where present.
- Frontend leakage drill-down rows show those context counts/status badges and can open the linked lead detail drawer.
- Leakage metrics are also used on the revenue dashboard.

Still left:

- Follow-up gap drill-downs beyond missed call and SLA breach views.
- Direct per-record navigation to individual call/form/booking/message detail pages where those pages exist.
- More leakage calculation tests and filters.

### Lead And Enquiry Hub

Status: Partial

Implemented:

- Contact/lead API supports list, create, update, import, duplicate detection, timeline and mark-contacted behavior.
- Frontend `/app/leads` has a live lead list with search/filter behavior.
- Frontend `/app/leads` now has a lead detail drawer v2 showing contact metadata, treatment interests, tags, notes, timeline activity and linked calls/forms/bookings/messages.
- Pipeline stages/deals API and pipeline frontend are present.

Still left:

- Decide whether a separate lead entity is required or whether contacts remain the lead model.
- Add deeper record actions from the linked calls, messages, forms and bookings shown in lead detail.
- Required Phase 1 lead quality, lost reason and richer pipeline workflow.

### Call Intelligence

Status: Partial

Implemented:

- Twilio call and recording webhook ingestion path exists.
- Calls can store direction, missed flag, outcome, notes, assignment, recording metadata and linked contact.
- Frontend call list/detail/recording views exist and use the backend.
- Staff call metrics endpoint exists.

Still left:

- Real transcript ingestion/storage and AI summary generation.
- Explicit treatment-mentioned and booking-intent extraction fields beyond current outcome/notes/classification.
- Complete call quality scoring and richer staff accountability.

### Marketing Intelligence

Status: Partial/manual

Implemented:

- Manual spend, campaign metrics and ROAS-style reporting exist.
- Campaigns, offers and reviews modules/pages exist.
- Marketing/reporting endpoints connect spend to leads, booked consults, attended consults, sold treatments and revenue where data exists.

Still left:

- Google Ads, Meta, GBP, GA4 and SEO production connectors.
- Marketing overview/tabs that match the full Phase 1 brief.
- Better campaign/source attribution tests and import coverage.

### Treatment Intelligence

Status: Partial

Implemented:

- Treatment catalog/settings and treatment plan management exist.
- Revenue by treatment reporting exists.
- Appointments and treatment plans can store treatment-related data.

Still left:

- Treatment performance list/detail pages from the Phase 1 brief.
- Source mix, conversion funnel and ROI per treatment.
- Stronger linkage from lead to booking to consult outcome to treatment revenue.

### Front Desk And Team Accountability

Status: Partial

Implemented:

- SLA summary, lead response tracking and breach pages exist.
- Contacts support first response time and owner/staff assignment.
- Call staff metrics exist.

Still left:

- Dedicated team performance dashboard and individual team member detail.
- Full booking conversion, follow-up completion and fair scoring model by user.
- Tests for staff metric calculations.

### AI Performance Insights And Alerts

Status: Partial but usable v1

Implemented:

- AI workspace projects/runs pages and several AI tool/agent templates exist.
- Some dashboard/leakage UI includes static recommended action text.
- Insight data model exists in the `db.sql` schema.
- Backend `/api/insights` supports list, generate, resolve/archive/status updates, assignment and linked action task creation.
- Insight generation currently creates deterministic revenue leakage insights from missed calls, SLA breaches, no-shows and low consult conversion details, with active insight dedupe.
- Insight generation can enrich leakage insight title, summary, recommended action and severity through OpenAI when `OPENAI_INSIGHTS_ENABLED=true` and `OPENAI_API_KEY` are configured.
- If OpenAI is disabled, missing or unavailable, insight generation completes with deterministic output and stores generation provider/model/fallback metadata.
- Frontend `/app/leakage` has a Revenue Insights panel for generation, status updates and task handoff.
- Backend report dashboard test covers leakage detail, insight generation fallback metadata, dedupe, linked action task creation, duplicate task protection, resolve and tenant-empty behavior.

Still left:

- Dedicated alert inbox/detail views if alerts become separate from insights.
- Frontend assignment/archive controls beyond the current leakage panel workflow.
- Broader insight permission and tenant boundary tests.

### Monthly Action Plan And Linked Tasks

Status: Partial but usable v1

Implemented:

- General CRM tasks exist.
- Internal delivery tasks exist with assignment, due dates, priority, status, QA and archive support.
- Internal client account page can show delivery task context.
- Leakage insights can create linked clinic action tasks and move the insight into `in_progress`.
- Dedicated `monthly_action_plan` and `monthly_action_plan_item` tables exist with migration and `db.sql` schema.
- Backend `/api/monthly-action-plans` supports current-month reads, deterministic generation, plan status updates and item status updates.
- Plan generation uses active insights and open revenue/action tasks without duplicating existing plan items.
- Frontend `/app/action-plan` provides month selection, plan generation, summary metrics, active/completed item lists, plan completion and item complete/skip actions.

Still left:

- Links from action tasks to sources and treatments beyond the current insight/task/monthly-plan link.
- ClinicGrower team delivery view focused on the monthly plan.

### Reporting Centre

Status: Partial but usable v1

Implemented:

- Reports overview, leads report, ads report and no-shows report pages exist.
- Backend report snapshots table and dashboard report endpoints exist.
- Backend `POST /api/reports/monthly` generates or refreshes one clinic/month `monthly_performance` report snapshot in the existing `report` table.
- Generated monthly report data includes executive summary, highlights, risks, recommendations and embedded dashboard/funnel/channel/treatment/leakage/opportunity metrics.
- Frontend `/app/reports/overview` can generate the current-month report, refresh saved reports and preview the latest monthly summary/recommendations.
- Backend report dashboard smoke coverage verifies monthly report generation, idempotent regeneration, listing and tenant isolation.

Still left:

- Dedicated PDF rendering service if browser print output is not enough for pilots.
- Revocation/expiry management UI for shared report links.
- Fuller report section navigation if reports grow beyond the current executive-summary/risk/recommendation format.

### ClinicGrower Internal Control Centre

Status: Partial but usable v1

Implemented:

- Backend all-client account summary endpoint exists.
- Backend all-client account summary now includes open overdue and missed internal task counts.
- Frontend all-client internal account dashboard exists.
- Frontend internal account dashboard now shows account alerts for risk, overdue/missed delivery pressure, renewal risk and missing strategy context.
- Frontend internal account dashboard now shows current-month action-plan status/progress and flags missing or high-priority open plans.
- Client account profile, services, internal delivery tasks, QA and strategy logs exist.

Still left:

- Package level/plan data from billing, next review date and richer account owner/status fields.
- Dedicated client account detail route or selector beyond the current single workspace.
- Leakage-aware internal alerts per client.
- More explicit internal role and tenant boundary tests.

### Required Integrations And Import Fallbacks

Status: Partial

Implemented:

- Twilio call webhooks exist.
- Stripe billing/deposit foundations exist.
- Public forms/webhooks/API keys exist.
- Manual spend and manual consult import/fallback paths exist.
- Integration cards/connect/disconnect APIs exist.

Still left:

- Meta lead form ingestion.
- Google Ads, GBP, GA4 and SEO manual/API import coverage.
- OpenAI summary/insight service interface.
- Complete integration env/deployment documentation.

## Verification

Passed on 2026-06-09:

- Backend: recreate/import from `backend/db.sql`
- Backend: `npm run build`
- Backend: `node dist/test/test-reports-dashboard.js`
- Backend: `node dist/test/test-monthly-action-plans.js`
- Frontend: `npm run lint`
- Frontend: `npm run typecheck`
- Frontend: `npm test`
- Frontend: `npm run build`
- Smoke: backend `/api/health/ready`
- Smoke: unauthenticated backend `/api/insights/:id/task` returned `401`
- Smoke: frontend `/app/leakage/` returned `200`

Passed on 2026-06-05:

- Backend: `npm run build`
- Backend: `node dist/test/test-internal-delivery-tasks.js`
- Backend: `node dist/test/test-client-accounts.js`
- Backend: `node dist/test/test-reports-dashboard.js`
- Backend: `node dist/test/test-ad-spend-roas.js`
- Backend: `node dist/test/test-calls-commercial.js`
- Backend: `node dist/test/test-calls-twilio.js`
- Backend: `timeout 35s node dist/test/test-calls-missed-followup.js`
- Frontend: `npm run lint`
- Frontend: `npm run typecheck`
- Frontend: `npm run build`

Browser verification note:

- Browser verification for the generated monthly report UI could not run in this session because the required Chrome DevTools MCP tool is not available.
- Headful Chrome verification was attempted earlier but the local environment had no X server available, so visual verification could not be completed in-browser.
- Some call-related test files printed passing assertions but held Node open afterwards, which points to an open handle/test teardown cleanup issue rather than a failed assertion.

## Recommended Next Build Priorities

1. Complete attribution linking and tenant tests across lead, call/form, booking, consult, treatment and revenue.
2. Add transcript-backed call AI summaries and quality scoring.
3. Add direct per-record navigation for call/form/booking/message detail pages.
4. Add production integration coverage or clearly documented manual import fallbacks for Google/Meta/GBP/GA4/SEO/OpenAI.
5. Add report share revocation/expiry controls if pilots need externally shared links to be managed after creation.

## Selected Next Feature

Selected on 2026-06-09: Generated monthly report detail/share/print v1.

Planning artifact: current Phase 1 Reporting Centre gap in this document.

Implementation status: backend and frontend v1 implemented on 2026-06-09.

Reason:

- It turns generated monthly report snapshots into a pilot-ready artefact with a full read route, print/PDF browser flow and secure public sharing.
- The existing `report` snapshot model already carries the monthly executive summary, risks, recommendations and embedded metrics.
- The new `report_share` table stores hashed tokens so public links do not expose authenticated sessions or raw report IDs.
