# Revised Phase 1 Backend Trello Plan

Purpose: align the backend Trello board with Max's revised Phase 1 plan while keeping it realistic for the current Express/MySQL backend.

Important backend context:
- Keep the current Express/TypeScript/MySQL structure.
- Do not add Prisma/PostgreSQL language to these cards unless a migration is intentionally planned.
- Most cards should extend the existing backend modules rather than create brand new architecture.
- Assign each new card to `HM`.
- Suggested labels: `Backend`, `Phase 1`, plus one priority label: `P0` or `P1`.

## Recommended Build Order

### Current Cards To Keep First

These are still valid and should stay ahead of the new cards.

1. `Unified Lead/Contact API Foundation` - P0
2. `Lead Inbox Search, Filters, And Pagination` - P0
3. `Duplicate Detection On Lead/Contact Create` - P0
4. `Spreadsheet Lead/Contact Import` - P1
5. `Pipeline Stages API` - P0
6. `Pipeline Opportunities And Stage Movement API` - P0
7. `Consult Appointment API Foundation` - P0

Reason: these create the core CRM, pipeline, and consult tracking spine that the revised Phase 1 plan still depends on.

### New Cards To Add Next

Add these after the current 7 cards. This gives the backend developer a clear next batch without dumping the whole master plan into Trello at once.

---

## 8. Website Form Capture And Attribution Baseline

Labels: `Backend`, `Phase 1`, `P0`, `Attribution`, `CRM`

Member: `HM`

Purpose:
Connect website/landing page enquiries into the lead/contact system with enough attribution data for Phase 1 reporting.

Scope:
- Use the existing backend module patterns for forms, webhooks, contacts, campaigns, and audit logging.
- Capture website form submissions as lead/contact records.
- Store source, campaign, landing page, treatment interest, and UTM fields where available.
- Preserve raw payload data for debugging where sensible.
- Avoid relying on Google/Meta APIs for this card. Manual/source-level attribution is enough for Phase 1.

Acceptance:
- A website form submission can create a lead/contact.
- Duplicate email/phone handling uses the same behaviour as manual contact creation.
- UTM/source/campaign fields are stored with the lead/contact.
- Form submissions are clinic-scoped.
- Failed/invalid submissions return clear errors.
- Important submissions create an event or audit entry.
- Frontend/API response shapes stay consistent with existing backend patterns.

---

## 9. Communications Thread Detail API

Labels: `Backend`, `Phase 1`, `P0`, `Communications`

Member: `HM`

Purpose:
Turn the current communications inbox into a usable conversation system for SMS/email history.

Scope:
- Extend the existing `comms` module.
- Keep the current inbox list working.
- Add conversation/thread detail for a contact or conversation.
- Include SMS, email, internal notes, timestamps, direction, status, and sender where available.
- Link conversations back to contact/lead records.

Acceptance:
- The inbox can list conversations.
- A conversation detail endpoint returns ordered messages for one contact/conversation.
- Messages are clinic-scoped.
- Internal notes are clearly separated from patient-facing messages.
- Missing contact/conversation access returns a normal not-found/permission response.
- The response supports the current frontend communications UI without mock data.

---

## 10. Message Templates And Quick Replies Polish

Labels: `Backend`, `Phase 1`, `P1`, `Communications`, `Automation`

Member: `HM`

Purpose:
Make the existing message template backend useful for quick replies, missed-call text-back, and follow-up sequences.

Scope:
- Extend the existing `message-templates` module if needed.
- Support SMS and email templates.
- Support active, draft, and archived templates.
- Support simple placeholders such as patient name, clinic name, appointment date, and treatment.
- Keep templates clinic-scoped.

Acceptance:
- Templates can be listed, created, updated, archived, and deleted.
- Templates can be filtered by channel and status.
- Active templates are usable by communications/automation flows.
- Template body validation prevents empty sends.
- Placeholder behaviour is documented in the card or API response.
- Existing frontend template screens continue to work.

---

## 11. Missed-Call Text-Back And Follow-Up Automation

Labels: `Backend`, `Phase 1`, `P0`, `Communications`, `Automation`, `Twilio`

Member: `HM`

Purpose:
Create the Phase 1 missed-call recovery workflow so missed revenue opportunities are acted on quickly.

Scope:
- Use existing `calls`, `automations`, `sequences`, `message-templates`, and `comms` module patterns.
- When a missed call is logged, allow an SMS follow-up to be triggered.
- Link the follow-up to the call and contact/lead where possible.
- Prevent accidental duplicate text-backs for the same missed call.
- Track send status and failure reason.

Acceptance:
- Missed calls can be identified from call records.
- A missed-call follow-up can be queued or sent using a configured template.
- The follow-up is visible in communications history.
- Duplicate sends are prevented unless manually retried.
- Errors from the SMS provider are stored clearly.
- The workflow is clinic-scoped and permission-protected.

---

## 12. Deposit Payment Links And Payment Tracking

Labels: `Backend`, `Phase 1`, `P0`, `Payments`, `Stripe`

Member: `HM`

Purpose:
Support consultation/treatment deposit collection without turning this into full accounting or invoicing software.

Scope:
- Build on the existing `billing` and `deposits` modules.
- Create Stripe payment links or checkout sessions for deposits.
- Link payment records to contact, appointment/consult, treatment, practitioner, and deposit amount where available.
- Track requested, paid, failed, refunded, and waived states.
- Update payment status from Stripe webhook events.

Acceptance:
- A deposit payment link/session can be created for a contact/consult.
- Deposit amount and status are stored in the backend.
- Stripe webhook updates the matching deposit/payment record.
- Deposit records are clinic-scoped.
- The existing subscription billing flow is not broken.
- This card does not add full invoice/accounting behaviour.

---

## 13. Appointment Availability And Double-Booking Rules

Labels: `Backend`, `Phase 1`, `P1`, `Appointments`

Member: `HM`

Purpose:
Add the minimum scheduling rules needed for Phase 1 calendar/consult booking without replacing a full practice management system.

Scope:
- Build on the consult appointment API card.
- Store basic clinician/practitioner availability.
- Prevent obvious double bookings for the same practitioner and time range.
- Support appointment status changes: scheduled, rescheduled, completed, no-show, cancelled.
- Support reminder metadata where useful.

Acceptance:
- Appointment create/update checks practitioner availability where configured.
- Double-booking attempts return a clear validation error.
- Rescheduled/cancelled/no-show/completed actions are persisted.
- Appointment changes are clinic-scoped.
- Important appointment changes create event/audit entries.
- The frontend calendar can still render day/week/month data.

---

## 14. Revenue And ROI Reporting Data Foundation

Labels: `Backend`, `Phase 1`, `P0`, `Reporting`, `Attribution`

Member: `HM`

Purpose:
Make the reporting layer pull from real lead, consult, spend, deposit, and treatment data instead of mock values.

Scope:
- Use existing `reports`, `ops-logs`, `contacts`, `deposits`, `treatment-plans`, and campaign/source data.
- Support date ranges.
- Support lead count, booked consults, attended consults, sold consults, revenue, deposits, spend, CPL, cost per booked consultation, and basic ROI.
- Clearly separate exact, manual, estimated, and unknown values.

Acceptance:
- Reports return clinic-scoped metrics for a selected date range.
- Manual spend entries contribute to source/campaign reporting.
- Consult/deposit/treatment values contribute to revenue reporting.
- Empty states return zeroed data instead of mock data.
- Metrics can explain whether values are exact, manual, estimated, or unknown.
- Current frontend reporting widgets can be wired to these responses.

---

## 15. Internal Client Account Profiles

Labels: `Backend`, `Phase 1`, `P0`, `Internal OS`

Member: `HM`

Purpose:
Add the backend foundation for Clinic Grower's internal client/account management layer.

Scope:
- This is for Clinic Grower internal operations, not clinic patient records.
- Use the existing clinic/account structure where sensible.
- Store account manager, services used, onboarding status, health status, churn risk, renewal date, contract status, and key notes.
- Keep access limited to appropriate internal/admin roles.

Acceptance:
- Internal users can view and update a client/account profile.
- Profiles can show account manager, active services, status, renewal date, health, and churn risk.
- Patient/contact data is not mixed into the internal account profile.
- Updates are audited.
- Access is permission-protected.
- Existing clinic login/user flows are not affected.

---

## 16. Internal Service And Contract Tracking

Labels: `Backend`, `Phase 1`, `P1`, `Internal OS`

Member: `HM`

Purpose:
Track which Clinic Grower services each client has and the commercial state of those services.

Scope:
- Support services such as PPC, SEO, GBP, website, landing pages, CRO, and strategy.
- Track service status, start date, renewal/end date, owner/account manager, recurring value where relevant, and contract status.
- Link services to the internal client/account profile.

Acceptance:
- Internal users can add/update/archive client services.
- Service records are linked to the correct client/account.
- Contract status and renewal dates can be reported.
- Archived services do not appear as active.
- Changes are audited.
- This does not become full accounting software.

---

## 17. Internal Delivery Task Boards

Labels: `Backend`, `Phase 1`, `P0`, `Internal OS`, `Tasks`

Member: `HM`

Purpose:
Support repeatable delivery task boards for Clinic Grower's SEO, PPC, GBP, website, and strategy workflows.

Scope:
- Build on the existing `tasks` module.
- Add support for internal task categories/boards.
- Support assigned user, client/account, service type, due date, priority, status, and proof/upload reference where available.
- Support recurring monthly workflow templates if this is already close to the existing task model.

Acceptance:
- Internal tasks can be grouped by service/board.
- Tasks can be assigned, updated, completed, and archived.
- Tasks can be linked to a client/account.
- Overdue and completed states are queryable.
- The structure supports monthly recurring workflows.
- Clinic users do not see internal Clinic Grower delivery tasks unless explicitly allowed.

---

## 18. Internal QA And Approval Workflow

Labels: `Backend`, `Phase 1`, `P1`, `Internal OS`, `QA`

Member: `HM`

Purpose:
Add lightweight QA and approval tracking for internal delivery work.

Scope:
- Build around existing tasks where possible.
- Support QA checklist items, approval status, reviewer, completion proof, missed-task flag, escalation flag, and freelancer/team score where relevant.
- Keep it lightweight; do not build a complex project management platform.

Acceptance:
- A task/delivery item can be marked as needing QA.
- QA checklist status can be stored.
- Approved/rejected/needs changes status is persisted.
- Escalation and missed-task flags are queryable.
- QA actions are audited.
- The API supports internal QA screens without mock data.

---

## 19. Internal Strategy Logs And Meeting Notes

Labels: `Backend`, `Phase 1`, `P1`, `Internal OS`, `Reporting`

Member: `HM`

Purpose:
Store strategy notes and review-meeting context so Clinic Grower can manage clients consistently.

Scope:
- Use or extend `ops-logs` where sensible.
- Store monthly strategy logs, meeting notes, SEO plan, PPC plan, landing page plan, KPI notes, decisions, next actions, and owner.
- Link logs to the internal client/account profile.

Acceptance:
- Internal users can create, update, list, and archive strategy logs.
- Logs can be filtered by client/account, month, owner, and type.
- Notes are permission-protected.
- Logs are not exposed to clinic users by default.
- Updates are audited.

---

## 20. SOP And Prompt Library Polish

Labels: `Backend`, `Phase 1`, `P1`, `Internal OS`, `SOPs`

Member: `HM`

Purpose:
Make the existing SOP backend usable as an internal knowledge base for SEO, PPC, GBP, AI prompts, and delivery processes.

Scope:
- Build on the existing `sops` module.
- Support category, owner, status, content, search, and updated date.
- Add or support prompt-library categories if needed.
- Keep internal access controlled.

Acceptance:
- SOPs can be listed, searched, created, updated, published, archived, and deleted.
- SOPs can be filtered by category and status.
- AI prompt library items can be stored without needing a separate system unless necessary.
- Published/internal visibility rules are clear.
- Updates are audited.

---

## Cards To Defer For Now

Do not add these as immediate backend cards unless Max explicitly pulls them forward.

- AI call analysis.
- AI Growth Brief.
- Benchmarking v1.
- Competitor intelligence beyond the existing light CRUD.
- Reputation/review intelligence beyond existing basics.
- Predictive analytics.
- White-label/agency mode.
- Advanced multi-location reporting.
- Heavy Google Ads/Meta API integration.
- Full diary/practice-management replacement.
- EMR, medical notes, prescriptions, inventory, accounting.

Reason: the revised plan moves AI later and makes the first sellable product about CRM, communications, attribution, payments, reporting, automations, and the internal Clinic Grower OS.

## Suggested Trello List Layout

Keep it simple:

- `To Do`
- `Ready - Current Sprint`
- `In Progress`
- `Blocked`
- `Review / QA`
- `Done`
- `Deferred`

Use the card order above inside `To Do`/`Ready - Current Sprint` to show build sequence.

