# Monthly Action Plan Implementation Plan

Feature selected: Monthly Action Plan v1

Implementation status: core backend/frontend v1 implemented on 2026-06-09.

Source state:

- Current build-state doc lists Monthly Action Plan as the next priority after Insight v1.
- Backend already has clinic tasks at `/api/tasks`, internal tasks at `/api/tasks/internal`, and Insight v1 at `/api/insights`.
- Insights can create linked clinic action tasks through `insight.action_task_id`.
- Internal delivery tasks already support `workflow_month`, but clinic action tasks do not have a month-scoped plan container.

Shared decisions:

- Add a dedicated monthly action plan model rather than overloading clinic task fields. This keeps the backend design consistent with the existing module-per-domain pattern and preserves task as the execution item.
- Treat a monthly plan as a clinic-scoped commercial action workspace for one `YYYY-MM` period.
- In v1, plan items should reference existing `task` and/or `insight` records instead of duplicating task behavior.
- Use deterministic plan generation from active insights, revenue leakage details and open tasks first. OpenAI-backed plan narrative can follow after the OpenAI insight service exists.

## Task 1: Backend Monthly Plan Schema And Module

Goal:

Create durable, tenant-scoped monthly action plan records with linked plan items.

Context:

The backend uses Express modules under `src/modules/<domain>`, MySQL migrations under `migrations`, and a canonical schema dump in `db.sql`. Insight work recently added the same pattern with `src/modules/insights`, migrations and `db.sql`.

Relevant files:

- Backend: `clinicgrower-crm-backend/src/app.ts`
- Backend: `clinicgrower-crm-backend/src/modules/insights/*`
- Backend: `clinicgrower-crm-backend/src/modules/tasks/*`
- Backend: `clinicgrower-crm-backend/db.sql`
- Backend: `clinicgrower-crm-backend/migrations`

Proposed approach:

- Add tables such as `monthly_action_plan` and `monthly_action_plan_item`.
- `monthly_action_plan` should include `id`, `clinic_id`, `plan_month`, `status`, `title`, `summary`, `focus_metric`, `created_by`, timestamps and soft delete.
- `monthly_action_plan_item` should include `id`, `plan_id`, `clinic_id`, `task_id`, `insight_id`, `source_type`, `source_id`, `title`, `recommended_action`, `priority`, `status`, `sort_order`, timestamps and soft delete.
- Add indexes for `(clinic_id, plan_month, deleted_at)`, `(plan_id, status)`, `task_id` and `insight_id`.
- Add a `monthly-action-plans` backend module with controller, service, routes, validators and types.
- Register routes at `/api/monthly-action-plans`.
- Use existing permissions initially: `reports:read` for reads and `reports:write` for generation/mutations.

Acceptance criteria:

- A migration creates both tables and can be applied to the live database.
- `db.sql` includes the new tables and foreign keys.
- `GET /api/monthly-action-plans?month=YYYY-MM` returns the current clinic's plan if present.
- `POST /api/monthly-action-plans/generate` creates or updates a plan for a month without duplicating active items.
- `PATCH /api/monthly-action-plans/:id/status` updates plan status.
- `PATCH /api/monthly-action-plans/:planId/items/:itemId/status` updates an item status.
- Requests cannot access plans or items from another clinic.

Source reference:

- Current build-state doc: Recommended Next Build Priorities item 1.

Verify:

- Backend: `npm run build`
- Backend: add and run a focused integration test, for example `node dist/test/test-monthly-action-plans.js`.

Out of scope:

- PDF exports, share links and OpenAI narrative generation.

## Task 2: Generate Monthly Plan Items From Insights And Tasks

Goal:

Turn current active commercial signals into a usable monthly plan without asking users to manually assemble it.

Context:

Insight v1 creates open/in-progress leakage insights and can create linked clinic action tasks. Clinic tasks list active non-internal tasks. Revenue leakage details expose source records for missed calls, SLA breaches, no-shows and low consult conversion.

Relevant files:

- Backend: `clinicgrower-crm-backend/src/modules/insights/insights.service.ts`
- Backend: `clinicgrower-crm-backend/src/modules/reports/reports.service.ts`
- Backend: `clinicgrower-crm-backend/src/modules/tasks/tasks.service.ts`
- Backend: new monthly action plan service

Proposed approach:

- Plan generation should collect open and in-progress insights for the clinic.
- Include insight-linked tasks where present.
- For insights without tasks, create plan items that can later trigger the existing insight task handoff.
- Include open clinic tasks with category/source text that indicates revenue, leakage, follow-up or consult work.
- Sort by severity, priority, due date and recency.
- Store enough item metadata to render the plan even if the source task or insight is later resolved.

Acceptance criteria:

- Generating a plan twice for the same month is idempotent for the same active insights/tasks.
- Resolved or archived insights are not added as new active plan items.
- Items linked to completed tasks appear completed or are omitted according to the plan status rules chosen in the service.
- Generated items include title, recommended action, priority, status and source links.
- Audit events are logged for plan generation and item status changes.

Source reference:

- Insight v1 backend uses deterministic leakage insight generation and active dedupe.

Verify:

- Backend: `npm run build`
- Backend: monthly action plan integration test covers generate, idempotency, status updates, linked insight/task behavior and tenant isolation.

Out of scope:

- Creating new insight types outside revenue leakage.

## Task 3: Frontend API Client And Types

Goal:

Expose the monthly action plan backend contract to the frontend using existing API client patterns.

Context:

Frontend API clients live under `lib/api-client`, API types under `lib/api-types`, and feature hooks wrap authenticated API calls. The new Insights frontend client follows the expected shape.

Relevant files:

- Frontend: `clinic_grower_crm/lib/api-client/growth-api.ts`
- Frontend: `clinic_grower_crm/lib/api-client/insights-api.ts`
- Frontend: `clinic_grower_crm/lib/api-types.ts`
- Frontend: `clinic_grower_crm/lib/api-types/insights.ts`
- Frontend: `clinic_grower_crm/hooks/revenue/use-revenue-leakage-page.ts`

Proposed approach:

- Add `lib/api-types/monthly-action-plans.ts`.
- Add `lib/api-client/monthly-action-plans-api.ts`.
- Export the new API from `growth-api.ts` and `api-types.ts`.
- Add a focused hook such as `hooks/monthly-action-plan/use-monthly-action-plan-page.ts`.
- The hook should load the selected month, generate a plan, update plan/item statuses and surface loading/error/toast states.

Acceptance criteria:

- Frontend types match backend response names without ad hoc remapping in components.
- API methods exist for get current month, generate, update plan status and update item status.
- Hook handles empty, loading, error and optimistic or reload-after-mutation states consistently with existing hooks.

Source reference:

- Existing `insights-api.ts` and `use-revenue-leakage-page.ts`.

Verify:

- Frontend: `npm run lint`
- Frontend: `npm run typecheck`

Out of scope:

- Full page UI.

## Task 4: Monthly Action Plan Page

Goal:

Give clinic users a first usable monthly action plan workspace.

Context:

The app already has authenticated pages under `app/app`, CRM tasks under `/app/crm/tasks`, Revenue Leakage under `/app/leakage`, and navigation sections under `lib/navigation`.

Relevant files:

- Frontend: `clinic_grower_crm/app/app`
- Frontend: `clinic_grower_crm/lib/navigation`
- Frontend: `clinic_grower_crm/components`
- Frontend: `clinic_grower_crm/hooks/monthly-action-plan`
- Frontend: `clinic_grower_crm/lib/constants/routes.ts`
- Frontend: `clinic_grower_crm/lib/constants/page-titles.ts`

Proposed approach:

- Add a route such as `/app/action-plan`.
- Add navigation entry near Revenue or CRM depending on existing app organization.
- Build a work-focused page, not a landing page.
- Include month selector, plan status, summary metrics, active item list, completed item list and clear empty/error states.
- Each item should show source type, priority, recommended action, due date/task status if linked, and actions to mark done or open the linked task/insight context.
- Include a Generate Plan button when no plan exists or when the user wants to refresh the current month.

Acceptance criteria:

- A user can open the current month action plan.
- A user can generate a plan from active insights/tasks.
- A user can mark a plan item complete.
- Linked insight/task IDs are visible through meaningful UI actions or context labels.
- Empty state tells the truth without marketing copy.
- The page remains usable on desktop and mobile.

Source reference:

- Current build-state doc: Monthly Action Plan And Linked Tasks section.

Verify:

- Frontend: `npm run lint`
- Frontend: `npm run typecheck`
- Frontend: `npm run build`
- Smoke: local frontend route `/app/action-plan/` returns `200`.

Out of scope:

- Print/PDF monthly report generation.

## Task 5: Reporting And Internal Visibility Follow-Up

Goal:

Make the monthly action plan visible in the places ClinicGrower operators will naturally manage client delivery.

Context:

The internal control centre already shows client account alerts and internal delivery tasks. Reporting Centre is still partial and will later need generated monthly reports.

Relevant files:

- Frontend: `clinic_grower_crm/components/operations/client-accounts/client-accounts-workspace.tsx`
- Frontend: `clinic_grower_crm/app/app/reports/overview/page.tsx`
- Backend: `clinicgrower-crm-backend/src/modules/client-accounts/client-accounts.service.ts`
- Backend: new monthly action plan service

Proposed approach:

- Add plan completion counts to backend summaries only after the core monthly plan is stable.
- Surface current-month action plan status in client account/internal account views.
- Leave generated report/PDF work as a separate Reporting Centre feature.

Acceptance criteria:

- Internal account summary can show whether the current month has a plan and whether it is on track.
- Plan status does not leak cross-tenant data.
- Reporting overview can link to the current monthly action plan without duplicating plan UI.

Source reference:

- Current build-state doc: ClinicGrower Internal Control Centre and Reporting Centre sections.

Verify:

- Backend: relevant client account/report tests.
- Frontend: `npm run lint`, `npm run typecheck`, `npm run build`.

Out of scope:

- Billing/package-level delivery automation.
