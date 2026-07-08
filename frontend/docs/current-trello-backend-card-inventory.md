# Current Trello Backend Card Inventory

Purpose: running capture of the current Clinic Grower CRM Trello To Do cards visible through the VS Code Trello viewer.

Use this to compare the current board against the Phase 1 backend build plan in `phase-1-backend-trello-cards.md`.

## Captured Cards

### 1. Contacts API Foundation

URL: https://trello.com/c/2vgW0UkM/7-contacts-api-foundation

Members: HM

Description:
Implement tenant-scoped CRUD endpoints for contacts.

Endpoints:
- `GET /api/contacts`
- `POST /api/contacts`
- `GET /api/contacts/:id`
- `PATCH /api/contacts/:id`
- `DELETE /api/contacts/:id`

Acceptance:
- Contacts are scoped by clinic ID from auth token.
- Supports soft delete.
- Returns frontend-compatible response envelope.
- Validates required fields and normalizes email/phone.

Phase 1 mapping:
- Closest to Module 4 - Unified lead inbox, but this is framed as `contacts`, not `leads`.
- Keep if contacts are the frontend/domain name for patient/lead records.
- Otherwise consider renaming or splitting into Lead CRUD vs Contact/Profile work so Phase 1 stays revenue-intelligence focused.

### 2. Paginated Contact List, Search, And Filters

URL: https://trello.com/c/5oh6YWdM/8-paginated-contact-list-search-and-filters

Members: HM

Description:
Add list behavior needed by the Contacts screen.

Acceptance:
- Supports pagination.
- Search by name, email, phone, source, tag.
- Filter by status.
- Filter by tag.
- Sort by name, source, status, value, last contact.
- Returns total count and page metadata.

Phase 1 mapping:
- Strong fit for Module 4 - Unified lead inbox list/filtering work.
- Could be merged into or depend on card 1, but keeping it separate is reasonable because list behavior can be tested independently.
- Add treatment interest/category and assigned staff filters if this screen backs the Phase 1 lead inbox.

### 3. Create Contact From New Contact Form

URL: https://trello.com/c/AQtebbWT/9-create-contact-from-new-contact-form

Members: HM

Description:
Wire backend support for the new contact form fields.

Acceptance:
- Accepts first name, last name, email, phone, address, status, source, value, notes, tags, treatment interests.
- Creates a contact record.
- Creates an audit/event record such as `contact.created`.
- Handles duplicate email/phone gracefully.

Phase 1 mapping:
- Overlaps with card 1 - Contacts API Foundation and card 6 - Duplicate Detection On Contact Create.
- Best merged into `Unified Lead/Contact API Foundation` as create endpoint/form-field acceptance.
- Keep only if the frontend form has a special payload shape that needs dedicated backend wiring.

### 4. Spreadsheet Contact Import

URL: https://trello.com/c/ODaneMtl/19-spreadsheet-contact-import

Members: HM

Description:
Support importing contacts from spreadsheet uploads, not just manually created contacts. Build the backend flow for uploading and processing contact spreadsheets so clinics can bulk import leads/patients from CSV or spreadsheet exports.

Acceptance:
- Accepts uploaded CSV files from the existing import contacts UI.
- Parses spreadsheet rows into contact import rows.
- Validates required fields and reports row-level errors.
- Supports `create_only` and `upsert` import modes.
- Normalizes email and phone values.
- Adds optional tags to imported contacts.
- Detects duplicates during import.
- Persists an import batch record with totals.
- Exposes import history via `GET /api/contacts/imports`.
- Returns inserted, updated, duplicate, and error row counts.
- Keeps all imported contacts scoped to the authenticated clinic.

Frontend touchpoint:
- Existing screen: `app/app/crm/contacts/import`.
- Existing API client methods: `api.contacts.importContacts`, `api.contacts.getImportBatches`, `api.contacts.getDuplicateCandidates`.

Phase 1 mapping:
- Useful for onboarding/demo data and Module 4 lead/contact ingestion.
- Not core to the initial revenue-control wedge unless the first clinics need legacy list import, so mark as P1 unless this blocks pilot setup.
- Keep strict tenant scoping and import batch auditing.

### 5. Contact Detail And Update Support

URL: https://trello.com/c/wuvKEBJF/10-contact-detail-and-update-support

Members: HM

Description:
Add backend support for viewing and editing a single contact.

Acceptance:
- `GET /api/contacts/:id` returns full contact profile.
- `PATCH /api/contacts/:id` supports partial updates.
- Updates are clinic-scoped.
- Creates `contact.updated` event/audit entries.
- Returns clear validation errors.

Phase 1 mapping:
- Overlaps heavily with card 1 because `GET /api/contacts/:id` and `PATCH /api/contacts/:id` are already part of Contacts API Foundation.
- Either merge this into card 1 or keep it as a child card specifically for profile enrichment and event/audit behavior.
- If kept separate, add lead timeline data, notes/tags, treatment interest, current stage, and last activity fields to make it Phase 1 useful.

### 6. Contact Soft Delete

URL: https://trello.com/c/cRFl3Okn/11-contact-soft-delete

Members: HM

Description:
Implement contact removal without destroying history.

Acceptance:
- `DELETE /api/contacts/:id` sets `deleted_at`.
- Deleted contacts do not appear in normal list responses.
- Related events/history remain intact.
- Endpoint is permission-protected.

Phase 1 mapping:
- Overlaps with card 1, which already says Contacts API Foundation supports soft delete.
- Best handled as acceptance criteria inside card 1 unless there is meaningful extra work around permissions, restore behavior, or audit policy.
- Make sure deleted records remain excluded from metrics unless explicitly requested for audit/reporting.

### 7. Duplicate Detection On Contact Create

URL: https://trello.com/c/weyCjfe2/12-duplicate-detection-on-contact-create

Members: HM

Description:
Detect likely duplicate contacts when creating a contact manually.

Acceptance:
- Match by normalized email.
- Match by normalized phone.
- Optional fuzzy match by first/last name.
- Creates duplicate candidate records.
- Does not silently overwrite existing contacts.

Phase 1 mapping:
- Strong fit for Module 4 - Unified lead inbox duplicate detection.
- Keep as a separate card because duplicate detection has enough behavior and edge cases to test independently.
- Extend later to support lead/contact merge, but do not let this block initial lead creation if candidate detection is enough for launch.

### 8. Duplicate Detection On Contact Import

URL: https://trello.com/c/ztt4TTIC/13-duplicate-detection-on-contact-import

Members: HM

Description:
Extend/import harden the existing import duplicate workflow.

Acceptance:
- Import creates duplicate candidates where needed.
- Import supports `create_only` and `upsert`.
- Import history is persisted.
- Duplicate candidate status can be updated.
- Existing frontend import workflow continues to work.

Phase 1 mapping:
- Strongly overlaps with card 3 - Spreadsheet Contact Import.
- Keep this separate only if import duplicate handling already has its own UI/API surface and needs specific hardening.
- Otherwise merge into card 3 as acceptance criteria to avoid splitting the import path too finely.

### 9. Contact Import History API Polish

URL: https://trello.com/c/fkMuCivY/14-contact-import-history-api-polish

Members: HM

Description:
Make import history reliable for the import screen.

Acceptance:
- `GET /api/contacts/imports` returns recent import batches.
- Includes filename, status, totals, inserted, updated, duplicates, errors.
- Results are clinic-scoped.
- Sorted newest first.

Phase 1 mapping:
- Overlaps with card 3 - Spreadsheet Contact Import, which already includes import history.
- Merge into card 3 unless there is already a partial import implementation that specifically needs polish.
- Useful but not core sellable wedge; keep behind lead/call/consult/revenue work if prioritising.

### 10. Appointment API Foundation

URL: https://trello.com/c/z0midzz9/15-appointment-api-foundation

Members: HM

Description:
Create the scheduling API needed by the calendar.

Endpoints:
- `GET /api/appointments`
- `POST /api/appointments`
- `PATCH /api/appointments/:id`

Acceptance:
- Appointments are clinic-scoped.
- Supports date range queries.
- Links appointments to contacts.
- Supports scheduled, completed, no-show, cancelled states.

Phase 1 mapping:
- Related to Module 9 - Consult conversion intelligence, but the Phase 1 plan explicitly says not to build a full diary replacement.
- Keep only if this powers consult booking/outcome tracking.
- Rename toward `Consult API Foundation` or constrain acceptance to consult appointments if Phase 1 priority is the revenue wedge.

### 11. Calendar Status Actions

URL: https://trello.com/c/d6qLgsjA/16-calendar-status-actions

Members: HM

Description:
Persist appointment actions currently handled in local UI state.

Acceptance:
- Cancel appointment.
- Reschedule appointment.
- Mark appointment complete.
- Mark no-show.
- Creates related event/audit records.

Phase 1 mapping:
- Fits Module 9 only if appointments are consults or commercial bookings.
- Merge into card 9 if it remains an appointment/consult API foundation card.
- Add outcome fields needed for revenue intelligence: attended, sold/lost/thinking/not suitable, revenue value, deposit amount, practitioner, treatment.

### 12. Pipeline Stages API

URL: https://trello.com/c/iIaMiyuN/17-pipeline-stages-api

Members: HM

Description:
Persist pipeline stages instead of using mock stage data.

Endpoints:
- `GET /api/pipeline/stages`
- `POST /api/pipeline/stages`
- `PATCH /api/pipeline/stages/:id`
- `DELETE /api/pipeline/stages/:id`

Acceptance:
- Stages are clinic-scoped.
- Supports ordering.
- Prevents deleting stages with active deals unless reassigned.
- Matches pipeline settings screen needs.

Phase 1 mapping:
- Strong fit for Module 5 - Conversion pipeline.
- Be careful with customisation: Phase 1 plan says default stages should be standardised and custom workflows should be avoided early.
- Keep CRUD only if the UI already needs it; otherwise create default stages and allow limited ordering/visibility changes.

### 13. Pipeline Deals API

URL: https://trello.com/c/4iNtgYAH/18-pipeline-deals-api

Members: HM

Description:
Create real deal records tied to contacts.

Endpoints:
- `GET /api/pipeline/deals`
- `POST /api/pipeline/deals`
- `PATCH /api/pipeline/deals/:id`
- `PATCH /api/pipeline/deals/:id/move`

Acceptance:
- Deals link to contacts.
- Supports value, source, treatment, stage, owner.
- Moving a deal creates an event.
- Pipeline totals can be calculated from real data.

Phase 1 mapping:
- Strong fit for Module 5 - Conversion pipeline and Module 4 lead stage movement.
- Decide naming: Phase 1 plan uses leads moving through stages, not generic deals. `deal` is fine if it represents revenue opportunity, but it must stay tied to lead/contact, consult, treatment, and revenue metrics.
- Add required transition data for key stages: lost reason, booked consult date, sold revenue value, practitioner, and treatment.
