# Current Trello Card Update Copy

Use this to update the current Trello cards before adding new Phase 1 backend cards.

## Latest Pull Review Updates To Apply

Generated: 2026-06-26

Note: this shell session can read the Trello Viewer snapshot, but no live Trello write tool/credentials are exposed. Apply these through the VS Code Trello Viewer UI.

Latest reviewed pulls:
- Frontend `965cb92..9ea733b` - 22 commits through `feat(frontend): OAuth Login Callback QA And States and Global Command Palette shell`.
- Backend `449f182..072e6c4` - `feat(ai): add live growth brief generation endpoint` and `feat(reports): add phase 1 CSV export suite`.

Verification run:
- Frontend `npm run typecheck`: pass.
- Frontend `npm run lint`: pass with existing warnings only.
- Frontend `npm test`: pass, 1 file / 5 tests.
- Backend `npm run build`: pass.
- Backend `npm run qa:phase1`: pass; prints the manual browser QA release gate.
- Backend `node --test dist/test/test-growth-brief.js`: assertions passed, but the combined command was stopped after it hung before process exit.
- Backend `node --test dist/test/test-report-exports.js`: assertions passed, but the command was stopped after it hung before process exit.

Review finding to track:
- Frontend now calls AI generation endpoints for show-rate, sales assistant, campaign analyst, LTV optimiser and competitor insights, but the backend pull only exposes `/api/ai/growth-brief/generate`. Those UI actions will hit 404 until backend routes or explicit unavailable states are added.

### Phase 1: Auth Me Endpoint

Action: move to `complete`.

Add comment:

```text
Codex review update - 2026-06-26

The explicit card gap is now closed. Backend has `GET /api/auth/me` wired in `src/modules/auth/auth.routes.ts`, and the pulled frontend OAuth callback verifies received OAuth tokens through `api.auth.me()` before storing/refreshing the session.

Verification:
- Backend `npm run build` passed.
- Frontend `npm run typecheck`, `npm run lint` and `npm test` passed.

Note: lint still reports existing warnings unrelated to this card.
```

### 0Auth

Action: keep in `awaiting review`.

Add comment:

```text
Codex review update - 2026-06-26

OAuth frontend callback handling is now implemented:
- Login/signup expose Google, Facebook and Apple OAuth actions.
- New `/oauth/callback` page handles provider errors, hash/search callback payloads, session storage, 2FA-required state and post-login redirects.
- Backend OAuth routes for Google/Facebook/Apple and `/api/auth/me` session verification are present.

Keep this in awaiting review until staging provider credential/callback testing is completed with real Google, Facebook and Apple apps.

Verification:
- Frontend `npm run typecheck`, `npm run lint` and `npm test` passed.
- Backend `npm run build` passed.
```

### Phase 1: AI Growth Brief Generator Endpoint

Action: move to `awaiting review`.

Add comment:

```text
Codex review update - 2026-06-26

Growth Brief generation is now implemented end-to-end for the supported backend contract:
- Backend added `POST /api/ai/growth-brief/generate`.
- Backend generation collects clinic-scoped Phase 1 report data, enforces insufficient-data and missing-OpenAI unavailable states, and saves AI run history.
- Frontend `/app/ai/growth-brief` can generate a live brief, reload run history, show KPIs, and display evidence/provenance.

Review note:
- OpenAI is disabled in this local environment, and the backend correctly returned a controlled 503 unavailable state.
- Staging still needs a real OpenAI-configured smoke test before marking complete.

Verification:
- Backend `npm run build` passed.
- Backend Growth Brief integration assertions passed, but the node test process did not exit cleanly and had to be stopped after success output.
- Frontend `npm run typecheck`, `npm run lint` and `npm test` passed.
```

### Phase 1: Reports Export Suite

Action: move to `awaiting review`.

Add comment:

```text
Codex review update - 2026-06-26

Reports export suite is now implemented for CSV-backed Phase 1 reports:
- Backend added tenant-scoped CSV export support for revenue, attribution, pipeline and operational reports at `/api/reports/exports/:type`.
- Unsupported export formats return a controlled unsupported/validation state instead of fake PDF output.
- Frontend report pages now expose CSV export controls with loading/success/error states and shared date-range handling.
- Ads/report pages removed sample fallback rows where live backend data is unavailable.

Review note:
- Backend export integration assertions passed for attribution, revenue, operational and pipeline CSVs, including tenant scoping.
- Browser download QA still needs to be run in staging before marking complete.

Verification:
- Backend `npm run build` passed.
- Backend report-export integration assertions passed, but the node test process did not exit cleanly and had to be stopped after success output.
- Frontend `npm run typecheck`, `npm run lint` and `npm test` passed.
```

### Phase 1: Remove Remaining Frontend Sample Fallbacks

Action: move to `awaiting review`.

Add comment:

```text
Codex review update - 2026-06-26

The latest frontend pull removes another major sample-data surface:
- Ads/report pages no longer fall back to static ad metrics, platform breakdowns, campaign rows or keyword rows.
- Empty/loading/error states are now shown when live report data is unavailable.
- Several new report and AI surfaces include explicit unavailable/provenance messaging rather than fabricated records.

Keep in awaiting review until a final browser sweep confirms no remaining Phase 1 user-facing page still displays seeded/sample business records during API failure.

Verification:
- Frontend `npm run typecheck`, `npm run lint` and `npm test` passed.
```

### Phase 1 Extension: Global Command And Action Palette

Action: keep in `in progress`.

Add comment:

```text
Codex review update - 2026-06-26

The latest frontend pull improves the command palette shell:
- Hidden disabled actions are filtered out of search results.
- Report actions route to `/app/reports/overview`.
- Log-call now routes to the calls page with `?log=1` instead of showing a not-integrated message.
- Clinic switching remains wired through the auth context.

Keep in progress until the target routes/actions are browser-verified, especially `log_call`, `create_lead`, `create_booking`, `create_task`, record deep links and mobile open/keyboard behavior.

Verification:
- Frontend `npm run typecheck`, `npm run lint` and `npm test` passed.
```

### Phase 1: Browser QA And Regression Test Pack

Action: keep in `in progress`.

Add comment:

```text
Codex review update - 2026-06-26

QA documentation was expanded:
- Frontend added `docs/phase1-staging-browser-qa-evidence.md`.
- Backend `npm run qa:phase1` prints the required Phase 1 browser QA checklist and release gate.

Keep in progress because the actual desktop/mobile staging browser run, screenshots and tenant-switching evidence are still pending.

Verification:
- Backend `npm run qa:phase1` passed.
```

### New Follow-Up Card To Add

List: `To Do`

Title:
Phase 1: Missing AI Generation Backend Endpoints

Description:

```text
Purpose:
Close the frontend/backend contract gap introduced by the latest AI frontend wiring.

Current review finding:
The frontend now calls:
- `POST /api/ai/show-rate/generate`
- `POST /api/ai/sales-assistant/generate`
- `POST /api/ai/campaign-analyst/generate`
- `POST /api/ai/ltv-optimiser/generate`
- `POST /api/ai/competitor-insights/generate`

The backend currently exposes only:
- `POST /api/ai/growth-brief/generate`
- AI projects/runs history endpoints

Acceptance:
- Either implement the missing backend generation endpoints with tenant-scoped data and saved AI run history, or change the frontend to show explicit unavailable states without calling missing routes.
- Missing OpenAI/API config returns controlled errors.
- Frontend and backend route contracts match.
- Tests cover at least one success/unavailable path per endpoint or a documented shared unavailable-handler path.

Verification:
- Backend build/tests.
- Frontend typecheck/lint.
- Browser smoke test each affected AI page.
```

## Latest Phase 1 Card Updates To Apply

Generated: 2026-06-09

Note: the VS Code Trello Viewer credentials were not accessible from this shell session, so these are copy-ready updates for the Trello Viewer UI rather than confirmed live Trello API writes.

### Phase 1: Revenue Leakage Engine

Add comment:

```text
Implementation update - 2026-06-09

Leakage drill-down context links v1 is now implemented:
- Backend revenue leak detail records now include linked context for contact activity, calls, bookings, forms and messages.
- Leak records also expose linked insight status, action task status and monthly action plan item status where those records exist.
- Frontend `/app/leakage` drill-down rows now show compact context badges for linked calls/bookings/forms/messages plus insight/task/plan state.
- Leak rows can open `/app/leads?contactId=...`, and the Leads page opens the matching lead drawer when that query param is present.
- Backend smoke coverage verifies linked counts plus insight/action-task context.

Checklist update:
- Mark deeper leakage-to-lead/activity/action context v1 as complete.
- Keep direct individual call/form/booking/message detail-page navigation open until those detail routes are available everywhere.
```

Checklist items to add/complete:

```text
✅ Show linked lead/activity/action context on leakage drill-down records.
✅ Add lead deep links from leakage rows into the lead detail drawer.
```

### Phase 1: Lead and Enquiry Hub

Add comment:

```text
Implementation update - 2026-06-09

Lead detail drawer v2 is now implemented:
- Backend added `GET /api/contacts/:id/activity` for grouped lead activity.
- The grouped response includes timeline events, linked calls, linked bookings/appointments, linked form submissions and linked email/SMS messages.
- Frontend `/app/leads` now loads the grouped activity payload when a lead is selected.
- Lead drawer now has tabs for Overview, Calls, Forms, Bookings and Messages, with empty/loading states.
- Added backend smoke coverage for the new route/contract.

Commits:
- Backend `4e33766` - `feat(contacts): expose linked lead activity`
- Frontend `9d899d8` - `feat(leads): show linked activity in drawer`

Checklist update:
- Mark lead-detail drawer v1/v2 and linked calls/forms/bookings/messages context as complete.
- Keep deeper record actions and full end-to-end attribution open.
```

Checklist items to add/complete:

```text
✅ Implemented lead detail drawer v2 with linked calls, forms, bookings and messages.
✅ Added grouped backend contact activity endpoint for lead detail.
```

### Phase 1: ClinicGrower Internal Control Centre

Add comment:

```text
Implementation update - 2026-06-09

Internal Control Centre now surfaces current-month action-plan health per client:
- Backend client account summaries include current-month action plan id/month/status, total/completed/open items, high-priority open items, progress percent and last updated timestamp.
- Frontend `/app/ops/client-accounts` shows a Plan open metric and an Action plan table column.
- Account alerts now flag missing current-month plans and high-priority open action-plan pressure.
- Docs were updated to move action-plan status out of the pending bucket.

Commits:
- Backend `0785cc4` - `feat(client-accounts): expose action plan health`
- Frontend `5f2671f` - `feat(client-accounts): show action plan health`

Checklist update:
- Mark action-plan status per client/account summary as complete.
- Keep package-level plan/billing data, client account detail route/selector and richer owner/status fields open.
```

Checklist items to add/complete:

```text
✅ Surface current-month action-plan status and progress per client account.
✅ Add missing/high-priority action-plan pressure alerts to Internal Control Centre.
```

### Phase 1: Monthly Action Plan

Add comment:

```text
Implementation update - 2026-06-09

Monthly Action Plan v1 is implemented and now connected into internal account oversight:
- Backend monthly action plan tables/endpoints support current-month reads, deterministic generation, plan status updates and item status updates.
- Frontend `/app/action-plan` provides month selection, generation, summary metrics, active/completed lists and complete/skip actions.
- Internal Client Accounts now show current-month plan health/status per client.

Commits:
- Backend `bdbdd82` - `feat(action-plan): add monthly action plan backend`
- Frontend `7b54525` - `feat(action-plan): add monthly action plan workspace`
- Backend `0785cc4` - `feat(client-accounts): expose action plan health`
- Frontend `5f2671f` - `feat(client-accounts): show action plan health`

Checklist update:
- Mark Monthly Action Plan v1 and internal-account plan status integration as complete.
- Keep deeper source/treatment links and ClinicGrower team delivery view refinements open.
```

Checklist items to add/complete:

```text
✅ Implemented Monthly Action Plan v1 backend and frontend workspace.
✅ Connected current-month action-plan health into Internal Client Accounts.
```

### Phase 1: Reporting Centre

Add comment:

```text
Implementation update - 2026-06-09

Generated Monthly Report v1 is now implemented:
- Backend added `POST /api/reports/monthly` to generate or refresh one clinic/month `monthly_performance` snapshot in the existing `report` table.
- Generated report data includes executive summary, highlights, risks, recommendations and embedded dashboard/funnel/channel/treatment/leakage/opportunity metrics.
- Frontend `/app/reports/overview` now has a generate action and previews the latest monthly summary/recommendations in Saved Reports.
- Backend smoke coverage verifies generation, idempotent regeneration, report listing and tenant isolation.

Checklist update:
- Mark generated monthly report records/sections with executive summary and recommendations as complete.
- Keep print/PDF export, secure share links and a fuller report detail route open.
```

Checklist items to add/complete:

```text
✅ Generate monthly performance report snapshots from live reporting metrics.
✅ Show latest generated monthly summary and recommendations in Reports Overview.
```

### Phase 1: AI Performance Insights And Alerts

Add comment:

```text
Implementation update - 2026-06-09

OpenAI-backed leakage insight enrichment v1 is now implemented:
- Backend added an opt-in OpenAI Responses API enrichment service for revenue leakage insights.
- The service can enrich insight title, summary, recommended action and severity from leakage source records.
- Deterministic insight generation remains the default and fallback path when OpenAI is disabled, missing or unavailable.
- Insight metadata now records generation provider, model, response id and fallback reason.
- Existing `/api/insights/generate` contract remains unchanged for the frontend.
- Backend smoke coverage verifies deterministic fallback metadata while preserving generation, dedupe and linked task behavior.

Checklist update:
- Mark OpenAI/service-backed insight generation pipeline v1 as complete.
- Keep alert inbox/detail views, frontend assignment/archive controls and broader permission/tenant tests open.
```

Checklist items to add/complete:

```text
✅ Add OpenAI-backed revenue leakage insight enrichment with deterministic fallback.
✅ Store insight generation provider/model/fallback metadata.
```

## 1. Contacts API Foundation

Action: keep and rename.

New title:
Unified Lead/Contact API Foundation

New description:
Build the tenant-scoped API foundation for lead/contact records used by the revenue-control workflow.

Endpoints:
- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/contacts/:id`
- `PATCH /api/contacts/:id`
- `DELETE /api/contacts/:id`

Acceptance:
- Records are scoped by clinic ID from the authenticated request.
- Create/update validates required fields and normalizes email/phone values.
- Supports source, status, treatment interest, owner, value, tags, and last activity fields needed by the lead inbox.
- `GET /api/contacts/:id` returns a frontend-compatible detail payload.
- `PATCH /api/contacts/:id` supports partial updates.
- `DELETE /api/contacts/:id` soft deletes using `deleted_at`.
- Soft-deleted records do not appear in normal list responses.
- Important actions create event/audit records.
- Response envelope matches the frontend API client.

## 2. Paginated Contact List, Search, And Filters

Action: keep and rename.

New title:
Lead Inbox Search, Filters, And Pagination

New description:
Build the real list behavior needed by the lead/contact inbox so the frontend no longer relies on mock data.

Acceptance:
- Supports pagination with total count and page metadata.
- Search by name, email, phone, source, and tag.
- Filter by status.
- Filter by tag.
- Filter by treatment interest/category where available.
- Filter by assigned owner where available.
- Sort by name, source, status, value, and last contact/activity.
- Results are clinic-scoped.
- Soft-deleted records are excluded.
- Response shape matches the frontend table/list needs.

## 3. Create Contact From New Contact Form

Action: archive after merging into card 1.

Current title:
Create Contact From New Contact Form

Replacement comment/description before archiving:
Merged into `Unified Lead/Contact API Foundation`.

Merged scope:
- Accepts first name, last name, email, phone, address, status, source, value, notes, tags, and treatment interests.
- Creates a lead/contact record.
- Creates an audit/event record such as `contact.created`.
- Handles duplicate email/phone gracefully.

## 4. Spreadsheet Contact Import

Action: keep, rename, and mark P1 unless needed for pilot onboarding.

New title:
Spreadsheet Lead/Contact Import

New description:
Build the backend flow for importing lead/contact records from CSV uploads so clinics can bulk import existing data during onboarding.

Acceptance:
- Accepts uploaded CSV files from the existing import UI.
- Parses rows into lead/contact import rows.
- Validates required fields and reports row-level errors.
- Supports `create_only` and `upsert` import modes.
- Normalizes email and phone values.
- Adds optional tags to imported records.
- Detects duplicates during import.
- Persists an import batch record with filename, status, totals, inserted, updated, duplicates, and errors.
- Exposes import history via `GET /api/contacts/imports`, newest first.
- Keeps all imported records scoped to the authenticated clinic.

Frontend touchpoint:
- `app/app/crm/contacts/import`
- `api.contacts.importContacts`
- `api.contacts.getImportBatches`
- `api.contacts.getDuplicateCandidates`

## 5. Contact Detail And Update Support

Action: archive after merging into card 1.

Replacement comment/description before archiving:
Merged into `Unified Lead/Contact API Foundation`.

Merged scope:
- `GET /api/contacts/:id`
- `PATCH /api/contacts/:id`
- Clinic scoping.
- Validation errors.
- `contact.updated` event/audit entries.

## 6. Contact Soft Delete

Action: archive after merging into card 1.

Replacement comment/description before archiving:
Merged into `Unified Lead/Contact API Foundation`.

Merged scope:
- `DELETE /api/contacts/:id` sets `deleted_at`.
- Deleted records are excluded from normal list responses.
- Related events/history remain intact.
- Endpoint is permission-protected.

## 7. Duplicate Detection On Contact Create

Action: keep and rename.

New title:
Duplicate Detection On Lead/Contact Create

New description:
Detect likely duplicate lead/contact records during manual creation without silently overwriting existing data.

Acceptance:
- Match by normalized email within the authenticated clinic.
- Match by normalized phone within the authenticated clinic.
- Optional fuzzy match by first and last name.
- Creates duplicate candidate records or returns duplicate candidate metadata for frontend review.
- Does not silently overwrite existing records.
- Works with the create endpoint used by the lead/contact form.
- Duplicate checks ignore soft-deleted records unless explicitly requested.

## 8. Duplicate Detection On Contact Import

Action: archive after merging into card 4.

Replacement comment/description before archiving:
Merged into `Spreadsheet Lead/Contact Import`.

Merged scope:
- Import creates duplicate candidates where needed.
- Import supports `create_only` and `upsert`.
- Import history is persisted.
- Duplicate candidate status can be updated if the frontend supports it.
- Existing frontend import workflow continues to work.

## 9. Contact Import History API Polish

Action: archive after merging into card 4.

Replacement comment/description before archiving:
Merged into `Spreadsheet Lead/Contact Import`.

Merged scope:
- `GET /api/contacts/imports` returns recent import batches.
- Includes filename, status, totals, inserted, updated, duplicates, and errors.
- Results are clinic-scoped.
- Sorted newest first.

## 10. Appointment API Foundation

Action: keep and rename.

New title:
Consult Appointment API Foundation

New description:
Build the backend foundation for consult appointments used by the conversion and revenue-intelligence workflow. This is not a full diary replacement.

Endpoints:
- `GET /api/appointments`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`

Acceptance:
- Appointments are clinic-scoped.
- Supports date range queries.
- Links appointments to lead/contact records.
- Supports scheduled, completed, no-show, cancelled, and rescheduled states.
- Stores practitioner, treatment interest, source, and appointment value where available.
- Creates related event/audit records for important changes.
- Returns data needed by the calendar and consult conversion screens.
- Keeps scope limited to commercial consult tracking, not EMR or full diary replacement.

## 11. Calendar Status Actions

Action: archive after merging into card 9.

Replacement comment/description before archiving:
Merged into `Consult Appointment API Foundation`.

Merged scope:
- Cancel appointment.
- Reschedule appointment.
- Mark appointment complete.
- Mark no-show.
- Create related event/audit records.

## 12. Pipeline Stages API

Action: keep and lightly update.

New title:
Pipeline Stages API

New description:
Persist standardised conversion pipeline stages instead of using mock stage data.

Endpoints:
- `GET /api/pipeline/stages`
- `POST /api/pipeline/stages`
- `PATCH /api/pipeline/stages/:id`
- `DELETE /api/pipeline/stages/:id`

Acceptance:
- Stages are clinic-scoped.
- Default Phase 1 stages are created for each clinic: New, Contacted, Qualified, Consult Booked, Consult Attended, Sold, Lost.
- Supports ordering.
- Supports active/inactive or limited edits without encouraging fully custom workflows.
- Prevents deleting stages with active opportunities unless reassigned.
- Matches pipeline settings screen needs.
- Stage changes can be used for conversion metrics.

## 13. Pipeline Deals API

Action: keep and rename.

New title:
Pipeline Opportunities And Stage Movement API

New description:
Create real pipeline opportunity records tied to lead/contact records and persist stage movement events for conversion reporting.

Endpoints:
- `GET /api/pipeline/deals`
- `POST /api/pipeline/deals`
- `PATCH /api/pipeline/deals/:id`
- `PATCH /api/pipeline/deals/:id/move`

Acceptance:
- Opportunities link to lead/contact records.
- Supports value, source, treatment, stage, and owner.
- Moving an opportunity creates a stage movement event.
- Pipeline totals can be calculated from real data.
- Key stage transitions can capture required commercial data:
  - Lost reason.
  - Booked consult date.
  - Sold revenue value.
  - Practitioner.
  - Treatment.
- Results are clinic-scoped.
- Response shape supports the current pipeline UI.
