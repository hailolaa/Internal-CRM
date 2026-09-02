# Delivery Management Requirement Crosswalk

Last updated: 1 September 2026

This note maps the retained delivery-management requirements before the legacy
wrapper task is closed. It is an evidence artifact for `869er9bp4`; it is not
approval to close the legacy task.

## Task Boundaries

Legacy wrapper: `869efyxy5` - `[LEGACY - use CG-161] Build Mission Control Delivery Management - workstream status, evidence and QA per client`

Active governed tasks:

- `869egeh5q` - `CG-024`: Mission Control task versus ClickUp operating model,
  source-of-truth rules, conflict handling and duplicate prevention.
- `869egfgtp` - `CG-160`: first-class Mission Control client operating
  register, client identity, client state and reconciliation exceptions.
- `869egfgu7` - `CG-161`: freelancer report inputs, evidence, QA status and source links.
- `869egfguf` - `CG-162`: recurring weekly/monthly client strategy and reporting workspace.
- `869er9bp4`: crosswalk proving where legacy delivery-management requirements are governed.

Legacy task `869efyxy5` is not an ongoing governed owner. It remains a wrapper
to be closed only after this mapping is accepted by Max / Operations.

Boundary decision:

- Client delivery execution remains in the client delivery locations and task systems.
- Mission Control owns the governed roll-up, evidence visibility, QA state, exceptions and reporting.
- ClickUp owns task governance where task fields, source-of-truth rules,
  conflict handling, dependencies, status and duplicate prevention are governed
  by `869egeh5q` / CG-024 and the ClickUp lifecycle model.
- Status alone is not completion evidence.
- Michael Hodgson provides business definitions, legacy context and UAT
  evidence where applicable. He is not the sole owner of the resulting
  requirement or release decision; Max / Operations acceptance is still
  required for closure.

## Claimed Complete vs Accepted Complete

Claimed complete means a delivery owner has marked work as done or submitted report input.

Accepted complete means the submitted work has evidence, source links, QA review and reviewer acceptance. High-risk work needs the appropriate reviewer before it can be treated as accepted.

## Retained Requirement Mapping

| Legacy requirement | Retained requirement | Governed task/workstream | Current implementation location | Evidence source | Owner/boundary | Acceptance state |
|---|---|---|---|---|---|---|
| Per-client active workstreams | Show active client delivery work without duplicating client task execution | `869egfguf` CG-162, backed by `869egfgtp` CG-160 client register identity | `frontend/app/app/ops/delivery/page.tsx`, client account services, internal tasks | Delivery Work page, client account service records, client operating register | Client/location systems execute; Mission Control rolls up against governed client identity | Repo-side mapped; CG-162 acceptance pending |
| Owner per workstream | Keep accountable delivery owner visible with work | `869egfguf` CG-162 and `869egeh5q` CG-024 task ownership/source-of-truth rules | Client services, internal task ownership, ClickUp operations mapping | Client service/task owner fields, ClickUp operating model | Client/location owner remains source; Mission Control displays; ClickUp governs task ownership conflicts | Repo-side mapped; owner acceptance pending |
| Tasks, milestones, deadlines and status | Surface delivery tasks, due dates, blocked and overdue states | `869egeh5q` CG-024 and `869egfguf` CG-162 | Internal delivery tasks, Delivery Work page, ClickUp operations dashboard | Task deadlines/status, ClickUp workstream counts | Task systems remain execution layer; Mission Control shows governed roll-up only | Existing implementation present; target-environment evidence pending |
| Evidence per deliverable | Require report evidence, source links, metrics, risks and recommended actions | `869egfgu7` CG-161 | `backend/src/modules/integration-inputs/*`, `frontend/app/app/ops/delivery/page.tsx` | Freelancer report QA records | Specialists submit evidence; Mission Control validates visibility | Repo-side implemented; delivery owner acceptance pending |
| Claimed complete vs verified complete | Separate submitted/status work from QA-accepted work | `869egfgu7` CG-161 | Freelancer report QA statuses: `awaiting_evidence`, `awaiting_qa`, `accepted`, `failed_qa`, `rejected` | Integration-inputs API and Delivery Work QA panel | Reviewer acceptance, not status, closes work | Repo-side implemented; operational acceptance pending |
| QA and approval workflow | Track reviewer, verification date, QA notes and high-risk review | `869egfgu7` CG-161 | `freelancer_report_review` table and Delivery Work QA panel | Backend QA fields and frontend review state | High-risk work requires appropriate reviewer | Repo-side implemented; reviewer assignment process pending |
| Blockers and overdue highlighting | Surface blocked/overdue delivery exceptions | `869egeh5q` CG-024 and `869egfguf` CG-162 | ClickUp operations service, task dashboards, Delivery Work page | ClickUp blocked/overdue task mapping | Mission Control exception roll-up only | Existing implementation present; Ops acceptance pending |
| Dependencies between deliverables | Preserve dependencies in the recurring strategy/reporting workspace and task model | `869egeh5q` CG-024 and `869egfguf` CG-162 | Task workspace and client strategy/reporting model | CG-024 source-of-truth rules, CG-162 requirement | Client delivery execution stays outside managerial role lists; ClickUp governs task dependency ownership | Mapped to active governed tasks; no separate data gap here |
| Client-health roll-up | Include delivery state in client-health reporting | `869egfgtp` CG-160 and `869egfguf` CG-162 | Client account health/service roll-ups and delivery summaries | Client account health records and operating register | Mission Control owns roll-up; source systems own execution | Existing foundation present; fuller CG-162 acceptance pending |
| Exportable delivery summary | Produce governed delivery summary after source/evidence checks | `869egfguf` CG-162 | Reporting/action-plan foundations | CG-162 recurring reporting requirement | Mission Control reporting layer | Mapped to CG-162; not part of CG-161 |

## Data Gaps

Based on the task evidence currently available, every retained legacy
requirement above maps to at least one active governed task or Mission Control
surface. No new DATA GAP is recorded from this crosswalk.

Open acceptance gates:

- Operations Manager / reviewer must accept this mapping before closing the legacy wrapper.
- Usman and delivery owners still need to accept the service report templates operationally.
- Staging or production evidence should be attached once the delivery workspace is verified in the target environment.
- Max must make any client-scope or finance decision if a mapped delivery
  requirement conflicts with the client operating register, commercial scope or
  finance source-of-truth rules.

## Friday 4 September Review Format

Demonstrate this mapping using the bounded review format from Max's latest
brief:

1. What changed: the retained legacy delivery-management requirements have been
   mapped to CG-024, CG-160, CG-161 and CG-162 instead of leaving them in the
   legacy wrapper.
2. Evidence: this crosswalk, the governed destination task IDs, and repo/test
   evidence from the related implementation commits.
3. Blockers and owners: Max / Operations acceptance is required before the
   legacy wrapper closes; service-owner acceptance remains on CG-161; target
   environment delivery evidence remains pending where noted.
4. One next bounded milestone: attach this crosswalk to `869er9bp4`, have
   Max / Operations accept the boundary decision, then close or retire
   `869efyxy5`.
5. Max decision required: only if a client-scope, finance, permission or release
   conflict appears. This crosswalk does not authorize production release,
   provider activation, permission widening or scope expansion.

## Engineering Evidence

Relevant shipped foundation:

- `42b9dc8` - collaborative task workspaces.
- `080fa58` - secure delivery mapping workflow.
- `1f72ea4` - commercial delivery handoff.
- `1bf9f9f` - Ops Manager report actions.
- `373ad15` - freelancer report QA controls.
- `03b29f4` - Mission Control / ClickUp task operating model.
- `5d04b48` - client operating register identity preservation.
- `2489b26` - delivery-management requirement crosswalk.

Current repo-side follow-up:

- Delivery Work page reads freelancer report templates and report QA summaries.
- The UI shows awaiting evidence, awaiting QA, failed QA, rejected/accepted counts, work-type coverage and rework rate.
- Frontend API types and tests cover the CG-161 report QA states.
- `b3e4d1f` - surfaces freelancer QA status and work-type breakdown in the Delivery Work page.
