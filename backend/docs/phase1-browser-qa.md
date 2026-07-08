# Phase 1 Browser QA Pack

Use this pack before staging or production releases that touch Phase 1 workflows. It is intentionally browser-level and data-focused: backend smoke tests prove contracts, while this checklist proves the app reloads tenant-scoped data and the main user journeys still work.

Run helper:

```bash
npm run qa:phase1
```

## Automation Split

- Current backend repo: documented manual browser regression scenarios plus a repeatable checklist runner.
- Frontend repo follow-up: add Playwright specs for the same scenarios once the frontend test harness and staging credentials are available.
- Until Playwright exists, every release should attach screenshots or traces for tenant switching and high-risk workflows.

## Pre-Release Command Sequence

Run backend checks from this repo:

```bash
npm run build
npm run qa:phase1
```

Run frontend checks from the frontend repo before browser QA:

```bash
npm run typecheck
npm run build
```

Then complete the browser checklist below against staging or a local frontend pointed at the staging API.

## Test Setup

- Environment: staging or a local frontend pointed at the target API.
- Browser sizes: desktop `1440x900` and mobile `390x844`.
- Clinics: seeded primary clinic and Harbour clinic.
- Users: an owner/admin user with full clinic access, an internal/admin Clinic Grower user, and a restricted clinic user where available.
- Evidence: capture screenshots or traces for failed states, tenant switching, revenue dashboard, lead detail, calls/leakage, insights/action plans, internal ops and settings/integrations.

Record any missing seed data or unsupported frontend path in **Known Gaps** instead of silently skipping it.

## Release Gate

The release is ready only when:

- Critical auth, tenant, dashboard, leads, calls, reports, internal ops and settings paths pass.
- Tenant switching is verified in both directions.
- Seeded, empty, loading and error states are checked where the page supports them.
- Frontend typecheck/build and browser QA are completed for any user-facing workflow change.
- Screenshots or traces are attached for tenant switching and failed/high-risk flows.
- Known gaps are listed with owner and follow-up ticket/card.

## Scenarios

| Area | Scenario | Desktop | Mobile | Expected Result |
| --- | --- | --- | --- | --- |
| Auth | Login with valid admin credentials. | Required | Required | User lands in the app, API-backed pages load, no stale error banner. |
| Auth | Refresh the app while authenticated. | Required | Optional | Session is retained and tenant-scoped data reloads. |
| Auth | Logout. | Required | Optional | Protected pages redirect to login and cached clinic data is not visible. |
| Tenant switching | Switch from primary clinic to Harbour. | Required | Required | Active clinic label changes and visible dashboard/leads/calls data reloads. |
| Tenant switching | Switch from Harbour back to primary. | Required | Required | Primary clinic data returns; Harbour-only records are gone. |
| Revenue dashboard | Open owner dashboard/revenue page with seeded data. | Required | Required | KPI cards, executive summary, monthly trend, top opportunities and risks render from API data. |
| Revenue dashboard | Change date range. | Required | Optional | KPIs, trend and lists update; exact/manual/estimated/unknown labels remain visible. |
| Revenue dashboard | Check new/empty clinic state if available. | Required | Optional | Empty state is clear and no mock values are shown. |
| Leakage | Open leakage summary/detail. | Required | Optional | Missed calls, SLA/no-show/consult leakage and linked source records render from API data. |
| Insights | Generate or refresh insights where permitted. | Required | Optional | Insight list updates and deterministic fallback is labeled when OpenAI is unavailable. |
| Action plans | Open monthly action plan. | Required | Optional | Plan health, linked insight/task context and status updates work. |
| Leads | Open lead inbox/list. | Required | Required | Search, filters and seeded leads load without mock rows. |
| Leads | Open lead detail drawer. | Required | Required | Metadata, notes, tags, treatment interests, linked calls/messages/forms/bookings/deposits/tasks and timeline render. |
| Leads | Exercise drawer actions. | Required | Optional | Call outcome, message template, booking, deposit and task actions call APIs and refresh visible activity. |
| Leads | Move a lead through required stages. | Required | Optional | Stage/status persists, lost reason and follow-up states are reportable. |
| Calls | Open calls or missed-call workflow. | Required | Optional | Call rows, outcomes, recordings/transcription placeholders and missed follow-up state render. |
| Calls | Update a call outcome. | Required | Optional | Outcome persists and linked lead activity updates. |
| Reports | Open reporting centre/monthly report. | Required | Optional | Generated report data, revenue by channel/treatment and leakage sections render. |
| Treatment detail | Open a treatment performance detail if present. | Required | Optional | Date filter, source/campaign attribution, record links and empty states behave correctly. |
| Internal ops | Open client accounts/services. | Required | Optional | Internal profiles, services, renewal/contract state and health/churn data are permission-protected. |
| Internal ops | Open internal tasks/QA. | Required | Optional | Boards group by service/client; QA flags/checklist/approval filters work for internal users only. |
| Internal ops | Open strategy logs/SOPs. | Required | Optional | Search/filter/create/update/archive flows work and clinic users cannot see internal-only notes. |
| Settings | Open settings, integrations and API keys. | Required | Optional | Connector status, health, last sync, missing permissions and manual fallback are visible where configured. |
| Command palette | Open palette by keyboard and visible mobile button. | Required | Required | Actions/search/clinic switch targets are keyboard-accessible and permission-aware. |
| Permissions | Use restricted clinic user where available. | Required | Optional | Internal/admin actions are hidden or disabled; direct URLs return forbidden/not found. |

## Error And Loading Checks

- Throttle network or reload a page with API requests visible and confirm loading states do not overlap core content.
- Force one failed request in dev/staging tooling where safe and confirm the page shows a recoverable error state.
- Confirm empty states do not invent values: unknowns must be labeled as unknown/manual/estimated instead of rendered as zero unless zero is real.

## Tenant Isolation Checks

- Capture a primary-clinic lead ID and verify it is not visible after switching to Harbour.
- Repeat for one call, one report/dashboard metric, one internal client account and one task where seeded data exists.
- Cross-tenant direct URL/API attempts should show not found or forbidden, never another clinic's record.

## Known Gaps

Update this section during each QA run.

| Date | Gap | Impact | Owner/Follow-Up |
| --- | --- | --- | --- |
| 2026-06-12 | Browser automation is documented/manual in this backend repo; Playwright specs should live with the frontend app once its test harness is available. | Manual screenshots are required for UI regression evidence. | Frontend QA follow-up |

## Run Record Template

Copy this block into the release ticket.

```text
Phase 1 Browser QA
Date:
Environment:
Frontend build:
Backend commit:
Tester:

Desktop result:
Mobile result:
Tenant switching result:
Known gaps:
Screenshots/traces:
Release recommendation:
```
