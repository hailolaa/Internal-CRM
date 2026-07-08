# Phase 1 Staging Browser QA Evidence Pack

Status: Browser QA evidence captured; mobile route pack completed after auth refresh fix  
Created: 2026-06-25  
Updated: 2026-06-29  
Scope: Final browser QA coverage for wired Phase 1 frontend flows before sign-off.

## Environment

| Item | Value |
| --- | --- |
| Frontend | `https://clinicgrower.ai` |
| API | `https://clinicgrower.ai/api` |
| Browser viewport | Desktop `1440x900`; mobile `390x844` resumed pass completed |
| Demo owner | `owner@phase1-demo.clinicgrower.ai` |
| Primary clinic | Phase 1 Demo Aesthetics Clinic |
| Secondary clinic | Harbour Dental Studio |

## Preflight Evidence

Completed from local repo/tooling on 2026-06-27 and re-run on 2026-06-29:

| Check | Result | Notes |
| --- | --- | --- |
| Backend build | Pass | `npm run build` in `clinicgrower-crm-backend` |
| Backend QA runner | Pass | `npm run qa:phase1` prints the required browser checklist and release gate |
| Frontend typecheck | Pass | `npm run typecheck` in `clinic_grower_crm` |
| Trello QA bugs | Created and triaged | Follow-up cards created for pipeline duplicate stages, calls analytics breakdown route, and auth refresh 429 blocking mobile QA. All three are fixed or verified and awaiting review. |

## Browser Evidence

| Area | Result | Evidence |
| --- | --- | --- |
| Login and membership | Pass | Login API returned 200 for the demo owner; `/api/auth/me` returned 200; `/api/auth/clinics` returned the primary clinic plus Harbour Dental Studio. |
| Protected route refresh | Pass | `/app/revenue` retained the protected route after refresh and rendered revenue content instead of the login page. |
| Tenant switching | Pass | `/api/auth/switch-clinic` switched primary to Harbour and back with 200 responses. Contact list counts changed from 22 primary contacts to 6 Harbour contacts, then restored the primary clinic token. |
| Revenue dashboard | Pass | `/app/revenue` rendered live KPI, leakage, call, and AI insight content with no page-level load errors. |
| Lead pipeline | Pass with live empty state | `/app/leads` rendered the live page and explicit empty state for current filters; no generic not-integrated message. |
| Consult tracking | Pass | `/app/consults` rendered seeded consult pipeline data and revenue metrics. |
| SLA / response time | Pass | `/app/sla` rendered at-risk leads and breach log data from the backend. |
| Retention | Pass | `/app/retention` rendered rebooking queue and retention metrics. |
| Attribution | Pass | `/app/marketing/attribution` rendered attribution evidence and linked recovery coverage. |
| Deposits | Pass | `/app/deposits` rendered paid deposit rows; a broad text scan matched the word `Failed` only as a status label, not a page error. |
| Calls | Pass | `/app/comms/calls` rendered live paginated call rows without page-level load errors. |
| Contacts | Pass | `/app/crm/contacts` rendered 22 live contacts and row action buttons. |
| Pipeline | Re-test pass on 2026-06-29 | `/app/crm/pipeline` now renders one canonical stage column/summary label per stage after the duplicate-stage fix. |
| Calendar | Pass | `/app/crm/calendar` rendered the live-data banner, date range state, edit/reschedule wording, and empty selected-day state. |
| Forms | Pass | `/app/crm/forms` rendered live forms plus open public form, copy link, and in-app preview actions. |
| Campaigns | Pass | `/app/marketing/campaigns` rendered live campaign rows and metrics. |
| Calls analytics | Re-test pass on 2026-06-29 | Mobile `/app/comms/calls/analytics/` rendered performance trends, team metrics, and peak-hours content with no console errors. The production route for `/api/calls/analytics/breakdowns` now returns authenticated API responses instead of `404`. |
| Mobile revenue | Pass | At `390x844`, `/app/revenue/` rendered live KPI content with `documentElement.scrollWidth === clientWidth` and no horizontal overflow. Screenshot: `phase1-qa-mobile-revenue-2026-06-29.png`. |
| Mobile leads | Pass | At `390x844`, `/app/leads/` rendered live empty/filter state, no login redirect, no page-level error, and no horizontal overflow. |
| Mobile calls | Pass | At `390x844`, `/app/comms/calls/` rendered the call log/analytics/compliance navigation, no login redirect, no page-level error, and no horizontal overflow. |
| Mobile pipeline | Re-test pass on 2026-06-29 | At `390x844`, `/app/crm/pipeline/` rendered one canonical `New`, `Contacted`, `Qualified`, `Consult Booked`, `Consult Attended`, `Sold`, and `Lost` stage each after the duplicate-stage fix. |
| Mobile contacts | Pass after auth refresh fix | At `390x844`, `/app/crm/contacts/` stayed authenticated, rendered the `Contacts` page, and had `documentElement.scrollWidth === clientWidth`. Screenshot from auth-fix verification: `auth-refresh-mobile-contacts-b24c961.png`. |
| Mobile forms | Pass | At `390x844`, `/app/crm/forms/` and `/app/crm/forms/submissions/` stayed authenticated, rendered the `Forms` pages, and had no horizontal overflow. |
| Mobile integrations | Pass | At `390x844`, `/app/integrations/` stayed authenticated, rendered `Integrations`, and had no horizontal overflow. |
| Mobile reports | Pass | At `390x844`, `/app/reports/overview/`, `/app/reports/leads/`, `/app/reports/ads/`, and `/app/reports/noshows/` stayed authenticated, rendered their report headings, and had no horizontal overflow. |
| Mobile admin/settings | Pass | At `390x844`, `/app/admin/smoke-tests/` and `/app/settings/` stayed authenticated, rendered `Platform Admin` and `Settings`, and had no horizontal overflow. Final settings route network showed `/api/auth/refresh => 200`, core settings APIs `200`, and console errors `0`. Screenshot: `phase1-qa-mobile-settings-2026-06-29.png`. |

## Loading And Action-State Evidence

Code scan confirms major wired pages use skeleton/loading components or explicit loading labels before data renders. Examples include:

- Revenue components: `StatCardSkeleton`, `CardSkeleton`
- Leads: `StatCardSkeleton`, `TableRowSkeleton`
- SLA: `StatCardSkeleton`, SLA table/breach skeletons
- Deposits: `StatCardSkeleton`, `TableRowSkeleton`
- Contacts detail/edit: `SkeletonLine`
- Pipeline: `PipelineSkeleton`
- Calendar: stat and appointment loading states
- Campaigns, offers, reviews, reports, integrations, settings, admin pages: skeleton or explicit loading branches

Code scan also found unsupported actions generally use precise copy instead of generic dead buttons, for example:

- Inbox star/archive/more actions explicitly say conversation starring/archive/more actions are not integrated yet.
- Integrations explicitly distinguish supported connector setup/sync from unsupported vendor import workers.
- Settings security states explain unavailable password-change metadata.
- Tenant Scope QA explains deliberate cross-clinic denial probes are not exposed by the backend yet.

## Follow-Up Bug Cards

Created on Trello during this QA pass:

1. `Phase 1 QA Bug: Pipeline duplicates stage columns`
2. `Phase 1 QA Bug: Calls analytics breakdown endpoint returns 404`
3. `Phase 1 QA Bug: Auth refresh rate limit blocks mobile browser QA`

All three bug cards have since been fixed or verified and moved to awaiting review. The auth refresh fix allowed the previously blocked contacts/forms/integrations/reports/admin mobile route pack to complete without a login redirect or refresh `429`.

## Acceptance Checklist Mapping

| Checklist item | Status | Evidence |
| --- | --- | --- |
| Smoke test login, onboarding, clinic switcher, and protected-route refresh. | Passed with caveat | Login API, protected revenue refresh, refresh after hard navigations, and clinic switch API passed. Dedicated onboarding browser screenshot still recommended for final pilot sign-off. |
| Smoke test revenue, leads, consults, SLA, retention, attribution, deposits, calls, CRM, marketing, AI, reports, ops, integrations, settings, and admin pages for missing live wiring. | Passed with follow-up bugs awaiting review | Broad representative desktop route smoke completed. Mobile resumed pass now covers revenue, leads, calls, calls analytics, pipeline, contacts, forms, integrations, reports, admin, and settings. |
| Confirm pages show loading states instead of stale mock data before API responses. | Passed by code scan plus sampled routes | Major pages use skeleton/loading branches; sampled routes rendered live or explicit empty states. |
| Confirm all more-menu/action buttons either perform a real action or show a precise not-integrated note. | Passed by code scan plus sampled routes | Row/action controls are wired or have precise unsupported copy. |
| Record any remaining frontend bugs as Trello cards with route, action, and expected behaviour. | Passed | Three QA bug cards created. |

## Run Record

```text
Phase 1 Browser QA
Date: 2026-06-27; resumed 2026-06-29
Environment: https://clinicgrower.ai production demo / staging-like seeded data
Frontend check: npm run typecheck passed
Backend checks: npm run build passed; npm run qa:phase1 passed
Tester: Codex

Desktop result: Representative route matrix passed with follow-up bugs recorded
Mobile result: Revenue, leads, calls, calls analytics, pipeline, contacts, forms, integrations, reports, admin, and settings sampled at 390x844; no horizontal overflow found on sampled routes; no login redirect; /api/auth/refresh returned 200 after the backend limiter fix
Tenant switching result: Passed via /api/auth/switch-clinic and scoped contact counts
Known gaps: Live marketing connector credential validation remains external-credential dependent; the three QA bug cards are fixed/verified and awaiting review acceptance
Screenshots/traces: Playwright MCP snapshots captured during route pass; screenshots saved as phase1-qa-desktop-revenue-2026-06-29.png, phase1-qa-mobile-revenue-2026-06-29.png, phase1-qa-mobile-pipeline-duplicate-stages-2026-06-29.png, auth-refresh-mobile-contacts-b24c961.png, and phase1-qa-mobile-settings-2026-06-29.png
Release recommendation: Code-owned Phase 1 browser QA evidence is ready for review; final sign-off remains subject to review acceptance and external provider credential validation
```
