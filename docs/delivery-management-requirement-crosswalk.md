# Delivery Management Requirement Crosswalk

Last updated: 1 September 2026

This note maps the retained delivery-management requirements before the legacy
wrapper task is closed. It is an evidence artifact for `869er9bp4`; it is not
approval to close the legacy task.

## Task Boundaries

Legacy wrapper: `869efyxy5` - `[LEGACY - use CG-161] Build Mission Control Delivery Management - workstream status, evidence and QA per client`

Active governed tasks:

- `869egfgu7` - `CG-161`: freelancer report inputs, evidence, QA status and source links.
- `869egfguf` - `CG-162`: recurring weekly/monthly client strategy and reporting workspace.
- `869er9bp4`: crosswalk proving where legacy delivery-management requirements are governed.

Boundary decision:

- Client delivery execution remains in the client delivery locations and task systems.
- Mission Control owns the governed roll-up, evidence visibility, QA state, exceptions and reporting.
- Status alone is not completion evidence.

## Claimed Complete vs Accepted Complete

Claimed complete means a delivery owner has marked work as done or submitted report input.

Accepted complete means the submitted work has evidence, source links, QA review and reviewer acceptance. High-risk work needs the appropriate reviewer before it can be treated as accepted.

## Retained Requirement Mapping

| Legacy requirement | Retained requirement | Governed task/workstream | Current implementation location | Evidence source | Owner/boundary | Acceptance state |
|---|---|---|---|---|---|---|
| Per-client active workstreams | Show active client delivery work without duplicating client task execution | `869egfguf` CG-162, with legacy capture in `869efyxy5` | `frontend/app/app/ops/delivery/page.tsx`, client account services, internal tasks | Delivery Work page, client account service records | Client/location systems execute; Mission Control rolls up | Repo-side mapped; CG-162 acceptance pending |
| Owner per workstream | Keep accountable delivery owner visible with work | `869egfguf` CG-162 | Client services, internal task ownership, ClickUp operations mapping | Client service/task owner fields | Client/location owner remains source; Mission Control displays | Repo-side mapped; owner acceptance pending |
| Tasks, milestones, deadlines and status | Surface delivery tasks, due dates, blocked and overdue states | `869efyxy5`, `869egfguf` CG-162 | Internal delivery tasks, Delivery Work page, ClickUp operations dashboard | Task deadlines/status, ClickUp workstream counts | Task systems remain execution layer | Existing implementation present; target-environment evidence pending |
| Evidence per deliverable | Require report evidence, source links, metrics, risks and recommended actions | `869egfgu7` CG-161 | `backend/src/modules/integration-inputs/*`, `frontend/app/app/ops/delivery/page.tsx` | Freelancer report QA records | Specialists submit evidence; Mission Control validates visibility | Repo-side implemented; delivery owner acceptance pending |
| Claimed complete vs verified complete | Separate submitted/status work from QA-accepted work | `869egfgu7` CG-161 | Freelancer report QA statuses: `awaiting_evidence`, `awaiting_qa`, `accepted`, `failed_qa`, `rejected` | Integration-inputs API and Delivery Work QA panel | Reviewer acceptance, not status, closes work | Repo-side implemented; operational acceptance pending |
| QA and approval workflow | Track reviewer, verification date, QA notes and high-risk review | `869egfgu7` CG-161 | `freelancer_report_review` table and Delivery Work QA panel | Backend QA fields and frontend review state | High-risk work requires appropriate reviewer | Repo-side implemented; reviewer assignment process pending |
| Blockers and overdue highlighting | Surface blocked/overdue delivery exceptions | `869efyxy5`, `869egfguf` CG-162 | ClickUp operations service, task dashboards, Delivery Work page | ClickUp blocked/overdue task mapping | Mission Control exception roll-up only | Existing implementation present; Ops acceptance pending |
| Dependencies between deliverables | Preserve dependencies in the recurring strategy/reporting workspace | `869egfguf` CG-162 | Task workspace and client strategy/reporting model | CG-162 requirement | Client delivery execution stays outside managerial role lists | Mapped to CG-162; no separate data gap here |
| Client-health roll-up | Include delivery state in client-health reporting | `869egfguf` CG-162 | Client account health/service roll-ups and delivery summaries | Client account health records | Mission Control owns roll-up; source systems own execution | Existing foundation present; fuller CG-162 acceptance pending |
| Exportable delivery summary | Produce governed delivery summary after source/evidence checks | `869egfguf` CG-162 | Reporting/action-plan foundations | CG-162 recurring reporting requirement | Mission Control reporting layer | Mapped to CG-162; not part of CG-161 |
| Evidence state and rework dashboard visibility | Show awaiting evidence, awaiting QA, failed QA, accepted/rejected and rework rate | `869egfgu7` CG-161 | Delivery Work freelancer report QA panel | Commit `b3e4d1f` | Mission Control reporting layer | Repo-side implemented; target-environment evidence pending |

## Data Gaps

No retained legacy requirement is currently unowned.

Open acceptance gates:

- Operations Manager / reviewer must accept this mapping before closing the legacy wrapper.
- Usman and delivery owners still need to accept the service report templates operationally.
- Staging or production evidence should be attached once the delivery workspace is verified in the target environment.

## Engineering Evidence

Relevant shipped foundation:

- `42b9dc8` - collaborative task workspaces.
- `080fa58` - secure delivery mapping workflow.
- `1f72ea4` - commercial delivery handoff.
- `1bf9f9f` - Ops Manager report actions.
- `373ad15` - freelancer report QA controls.

Current repo-side follow-up:

- Delivery Work page reads freelancer report templates and report QA summaries.
- The UI shows awaiting evidence, awaiting QA, failed QA, rejected/accepted counts, work-type coverage and rework rate.
- Frontend API types and tests cover the CG-161 report QA states.
- `b3e4d1f` - surfaces freelancer QA status and work-type breakdown in the Delivery Work page.
