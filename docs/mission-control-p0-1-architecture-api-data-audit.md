# Mission Control P0.1 Architecture, API and Data Audit

Prepared: 25 Aug 2026

Task: `869emyqne` - P0.1 audit Mission Control architecture, data and existing APIs

Related parent implementation evidence: `9dc6e4f` (`feat(api): add Mission Control read API and MCP endpoint`)

Audit base: `main` at `6f57fc2` before this audit commit

## Result

Repo-side P0.1 evidence is ready for review.

This pack verifies what is present in the Mission Control repository, code, configuration templates, migrations, tests and existing documentation. It does not claim production/staging deployment, provider-console setup, vault setup, DNS setup, backup execution, restore rehearsal, or reviewer sign-off where those cannot be verified from repository evidence.

Evidence labels used below:

- VERIFIED FROM REPOSITORY
- VERIFIED FROM DOCUMENTATION
- VERIFIED FROM CONFIGURATION
- VERIFIED FROM TEST
- EXTERNAL / NOT VERIFIED
- UNKNOWN
- BLOCKED

## Repository Identity

| Item | Current evidence | Status |
| --- | --- | --- |
| Root repository | `D:\Project\The Growth Group\Internal-CRM`; remote `https://github.com/hailolaa/Internal-CRM.git` | VERIFIED FROM REPOSITORY |
| Branch | `main` | VERIFIED FROM REPOSITORY |
| Audit base HEAD | `6f57fc2` | VERIFIED FROM REPOSITORY |
| Frontend package | `frontend/package.json`, package name `clinic-grower-internal-crm` | VERIFIED FROM REPOSITORY |
| Backend package | `backend/package.json`, package name `clinic-grower-internal-crm-backend` | VERIFIED FROM REPOSITORY |
| Frontend/backend relationship | One monorepo with separate `frontend` and `backend` packages. Frontend uses API clients under `frontend/lib/api-client*`; backend exposes Express routes under `backend/src/app.ts`. | VERIFIED FROM REPOSITORY |
| Authoritative status | This repository is the active Mission Control application repo for current frontend/backend work. | VERIFIED FROM REPOSITORY |
| Separate Clinic OS or clinic-facing repo | Not audited in this P0.1 pack. Cross-system Clinic OS references are recorded only where this repo contains configuration or API code. | EXTERNAL / NOT VERIFIED |

## Architecture

| Area | Verified current state | Evidence |
| --- | --- | --- |
| Frontend runtime | Next.js 16 App Router, React 19, TypeScript. | `frontend/package.json`, `frontend/app/**`, `frontend/lib/api-client.ts` |
| Backend runtime | Node.js ESM, Express 5, TypeScript, MySQL via `mysql2/promise`. | `backend/package.json`, `backend/src/app.ts`, `backend/src/config/database.ts` |
| Database | MySQL. Fresh database starts from `backend/db.sql`; ordered migrations run from `backend/scripts/migrations` using checksum tracking. | `backend/README.md`, `backend/scripts/db-migrate.mjs`, `docs/mission-control-environments.md` |
| Auth | JWT bearer sessions. `authenticate` validates the user, active membership and active tenant/workspace before route handlers run. | `backend/src/middleware/authenticate.ts` |
| Permissions | Role/permission checks through `authorizePermission`, `authorizeAnyPermission` and role aliases. Permission data is in `permission`, `role`, `role_permission`. | `backend/src/middleware/authorize.ts`, `backend/db.sql` |
| Tenants | Application-level tenant scoping through `clinic_id`, derived from authenticated user context. | `docs/tenant-isolation-verification.md`, `backend/src/middleware/authenticate.ts` |
| Frontend to backend | Browser calls the configured API base URL through shared API client factories. Auth refresh is centralised. | `frontend/lib/api-client.ts`, `frontend/lib/api-client/core.ts`, `frontend/lib/env.ts` |
| API error shape | Request context supplies request IDs; error handler returns safe API errors. P0 API envelope includes `success`, `data`, `error`, `request_id`, `generated_at`. | `backend/src/middleware/requestContext.ts`, `backend/src/middleware/errorHandler.ts`, `backend/src/modules/mission-control-api/**` |
| Background jobs | In-process job definitions exist; docs warn multi-instance scheduling needs DB lock or external queue before multi-process enablement. | `backend/src/modules/background-jobs/**`, `docs/architecture-diagram.md` |
| Observability | Structured request logging, observability helpers, uptime workflow and alert webhook hooks exist. External alert destination still needs configuration. | `docs/observability-and-alerting.md`, `.github/workflows/uptime-check.yml`, `backend/src/utils/observability.ts` |

## Current Mission Control API Inventory

### Existing API surface before P0 API/MCP

The backend registers the following Mission Control module groups in `backend/src/app.ts`.

| Route group | Purpose | Auth boundary |
| --- | --- | --- |
| `/api/auth` | Login, OAuth, sessions, password and email verification | Mixed public auth endpoints and authenticated session endpoints |
| `/api/contacts`, `/api/client-accounts`, `/api/pipeline`, `/api/tasks` | CRM, client accounts, opportunities and internal work | JWT plus module permissions |
| `/api/proposals`, `/api/packages` | Proposal builder, public links, frozen V19 snapshots, package catalogue | JWT plus proposal/package permissions; public share routes are token based |
| `/api/reports`, `/api/metrics`, `/api/growth-scores`, `/api/insights`, `/api/monthly-action-plans` | Reporting, growth score, AI/deterministic insights and action planning | JWT plus reports/contacts permissions |
| `/api/integrations`, `/api/integration-inputs`, `/api/webhooks`, `/api/settings/api-keys` | Provider setup, manual inputs, webhooks and API keys | JWT or API key depending on endpoint |
| `/api/clickup`, `/api/quickbooks`, `/api/calendar`, `/api/clinic-os-entitlements` | Third-party and cross-system integrations | JWT plus dedicated role/permission checks |
| `/api/public/forms`, `/api/public/landing-page-leads`, `/api/public/website-leads` | Server-to-server or public intake | API key and validation where applicable |
| `/api/health`, `/health` | Liveness, readiness and version | Public health endpoints; observability test route is token-gated |

### P0 API/MCP added in `9dc6e4f`

| Endpoint | Method | Scope | Behaviour | Status |
| --- | --- | --- | --- | --- |
| `/api/v1/health` | GET | `mission_control_api:read` | Health, DB health, API version and provenance | VERIFIED FROM REPOSITORY / TEST |
| `/api/v1/version` | GET | `mission_control_api:read` | Release/version metadata | VERIFIED FROM REPOSITORY |
| `/api/v1/capabilities` | GET | `mission_control_api:read` | Lists supported endpoints, record types, tools and read-only policy | VERIFIED FROM REPOSITORY / TEST |
| `/api/v1/search` | GET | `mission_control_api:read` | Tenant-scoped search across supported records | VERIFIED FROM REPOSITORY / TEST |
| `/api/v1/records/:type/:id` | GET | `mission_control_api:read` | Tenant-scoped fetch for one supported record | VERIFIED FROM REPOSITORY / TEST |
| `/mcp` | GET | `mission_control_mcp:read` | MCP endpoint metadata | VERIFIED FROM REPOSITORY |
| `/mcp` | POST | `mission_control_mcp:read` | JSON-RPC `tools/list`, `tools/call` for `search` and `fetch` | VERIFIED FROM REPOSITORY / TEST |

Supported P0 record types: `contact`, `client_account`, `proposal`, `task`, `opportunity`.

P0 write policy: read-only. MCP tools advertise `readOnlyHint: true` and `destructiveHint: false`. Unsupported tool names are rejected. Existing product APIs still include normal write routes outside P0; those are not exposed as P0 MCP tools.

## Data Model

| Mission Control concept | Table or source | Ownership and relationship | Data state |
| --- | --- | --- | --- |
| Workspace/account root | `clinic` | Physical legacy name; current Mission Control workspace/account container. | LIVE by default, DEMO/PREVIEW/PARTIAL/PROVIDER-DEPENDENT where `data_state` says so |
| Client account profile | `client_account_profile` | One profile per client workspace/account; linked by `clinic_id`. | LIVE or workspace-derived state |
| Contact/prospect | `contact` | Scoped by `clinic_id`; can link to deals, activities, proposals and tasks. | LIVE/MANUAL depending source fields and import/provenance |
| Opportunity | `deal` | Scoped by `clinic_id`; can link to contact, pipeline and stage. | LIVE/MANUAL depending creation path |
| Pipeline/stages | `pipeline`, `pipeline_stage`, `pipeline_deal_movement` | Scoped by `clinic_id`; records opportunity movement. | LIVE |
| Tasks/internal work | `task`, `task_comment`, `task_attachment` | Scoped by `clinic_id`; internal tasks use `is_internal=1`. | LIVE, CACHED when mirrored from ClickUp |
| Proposals | `proposal`, proposal governance/archive tables | Scoped by `clinic_id`; V19 public output freezes from snapshot/hash. | LIVE once saved/frozen; generated output is snapshot-derived |
| Growth scores | `account_growth_score`, growth score snapshots | Scoped by client/workspace. | LIVE/MANUAL/ESTIMATED depends component evidence and confidence |
| Manual metrics/spend | `manual_platform_metric`, `manual_spend_entry`, related reporting tables | Scoped by `clinic_id`. | MANUAL |
| Central analytics/fleet ingestion | `analytics_fact`, `fleet_*` tables | Tenant/source registry and imported fact model. | LIVE/CACHED/PARTIAL/PROVIDER-DEPENDENT/DEMO/PREVIEW/ROADMAP per source row |
| Integrations | `integration`, `oauth_account`, provider-specific mapping tables | Scoped by `clinic_id`; credentials are encrypted or environment-supplied. | UNKNOWN until connected; PROVIDER-DEPENDENT when configured |
| Audit | `audit_log`, activity/timeline tables | Scoped by `clinic_id`, user and entity where available. | LIVE |
| API keys/webhooks | `api_key`, `webhook_endpoint`, `integration_raw_payload` | API keys are hashed; raw intake payloads scoped by clinic/source/event ID. | LIVE or CACHED intake evidence |

## Data-State and Provenance Matrix

| Source or domain | Current classification | Evidence | Notes |
| --- | --- | --- | --- |
| Authenticated CRM records | LIVE | `backend/db.sql`, module routes/services | Scoped by authenticated `clinic_id`. |
| Seeded local/demo workspaces | DEMO/PREVIEW | `backend/db.sql`, `backend/scripts/seed-staging-demo.mjs`, `docs/mission-control-data-isolation.md` | Demo seed is opt-in and labelled. |
| ClickUp task state cache | CACHED | `20260820_add_clickup_lifecycle_sync.sql`, `backend/src/modules/clickup/**` | Mirrors ClickUp events/state after connection. |
| ClickUp operations dashboard | LIVE/CACHED depending configured connection | `backend/src/modules/clickup/**`, `docs/clickup-delivery-integration.md` | Live provider status cannot be claimed without configured workspace evidence. |
| Scoro import foundation | MANUAL/CACHED import source | `docs/scoro-import-cutover.md`, `backend/src/modules/scoro-import/**` | Real Scoro export/API is external and pending. |
| Clinic OS entitlement push | LIVE outbox when configured; UNKNOWN delivery in target Clinic OS | `backend/src/modules/clinic-os-entitlements/**`, `20260824_zzzz_add_clinic_os_entitlement_push.sql` | Requires external Clinic OS endpoint/secret and target confirmation. |
| Public/landing-page lead intake | LIVE once API key receives real event | `docs/landing-page-lead-capture-api.md`, `backend/src/modules/landing-page-leads/**` | API key is server-side only. |
| Manual integration inputs | MANUAL | `backend/src/modules/integration-inputs/**`, backend tests | Explicit fallback path for metrics/leads. |
| Google Ads/GBP connector metrics | PROVIDER-DEPENDENT | `backend/src/modules/integrations/integrations.service.ts` | Requires Google developer/OAuth configuration. |
| Meta metrics | PARTIAL / MANUAL fallback | `backend/src/modules/integrations/integrations.service.ts`, historical status report | OAuth/account listing exists; full metric sync is not proven live here. |
| WhatsApp/Twilio | PROVIDER-DEPENDENT | `docs/twilio-whatsapp-setup.md`, `backend/src/modules/webhooks/**` | Local default is log mode; live requires exact provider setup. |
| Email inbound | PROVIDER-DEPENDENT | `backend/.env.example`, `backend/src/modules/webhooks/**` | Requires inbound provider secret/domain setup. |
| QuickBooks | PROVIDER-DEPENDENT | `backend/src/modules/quickbooks/**`, `20260804_add_quickbooks_integration_foundation.sql` | OAuth disabled by default. |
| Stripe/deposits/card holds | PROVIDER-DEPENDENT | `backend/src/utils/stripe.ts`, deposits/direct-debit modules | Test/live config external; no raw cards stored in repo. |
| OpenAI/growth brief | PROVIDER-DEPENDENT | `backend/src/config/index.ts`, AI/integration-input modules | Disabled unless API key and feature flags are configured. |
| Backups | UNKNOWN operationally, REPO-PREPARED | `docs/backup-and-restore.md`, `.github/workflows/encrypted-backup.yml` | Workflow is gated by repo/environment variables. |
| Staging/prod URLs | DOCUMENTED TARGETS | `docs/mission-control-environments.md`, `.env.staging.example`, `.env.production.example` | Actual deployed targets not verified by this repo audit. |

## Integrations

| Integration | Purpose | Auth/identity method | Boundary | Current state |
| --- | --- | --- | --- | --- |
| ClickUp | Delivery task mapping, lifecycle sync, operations dashboard, reconciliation | OAuth or backend API token stored encrypted; webhook secret for inbound lifecycle events | Workspace/client mapping by `client_account_profile_id`, not name | REPO-PREPARED; live workspace/provider evidence external |
| Scoro | Import/cutover foundation for contacts, leads, clients/accounts, tasks/follow-ups | CSV/template import foundation, no live API configured | `source_system=scoro` and `scoro_record_id` primary identity | READY FOR REVIEW, source data pending |
| Clinic OS | Entitlement/settings push from Mission Control to Clinic OS | Signed push secret and configured endpoint | Tenant key plus Mission Control clinic/client record | REPO-PREPARED; target endpoint verification external |
| QuickBooks | Finance/customer mapping foundation | OAuth, encrypted stored config | Tenant-scoped QuickBooks customer mapping | REPO-PREPARED; live OAuth/account evidence external |
| Google Drive | Client folder validation and document evidence | Refresh token or service account in backend env/database OAuth | Client/account folder metadata, not browser secrets | PROVIDER-DEPENDENT |
| Google Calendar | Calendar/booking integration foundation | OAuth gated by config | Tenant-scoped config and OAuth | PROVIDER-DEPENDENT |
| Google Ads/GBP/GA4/Search Console | Marketing metrics and reporting inputs | OAuth/developer token where implemented; manual metric fallback | Tenant-scoped integration rows and manual metric rows | PARTIAL/PROVIDER-DEPENDENT |
| Twilio/WhatsApp | Inbound/outbound WhatsApp, call webhooks and missed-call recovery | Provider signature/secret and exact webhook URL | Receiving number maps to workspace; tenant source map | PROVIDER-DEPENDENT |
| Email/Brevo | Transactional and inbound email | Provider key and inbound secret | Workspace map for inbound email | PROVIDER-DEPENDENT |
| Stripe/Direct Debit | Payments, deposits and card-hold foundations | Provider secret/webhook secret in backend only | Tenant-scoped records | PROVIDER-DEPENDENT |
| OpenAI | Growth brief, insights and call intelligence | API key and feature flags | Backend-only provider calls with deterministic fallback where built | PROVIDER-DEPENDENT |

## Environments and Operations

| Area | Verified current state | Status |
| --- | --- | --- |
| Local frontend/backend | Documented as `http://localhost:3000` and `http://localhost:4000/api`. | VERIFIED FROM CONFIGURATION |
| Staging target | `https://mission-control-staging.thegrowthgroup.com` and `https://api-mission-control-staging.thegrowthgroup.com/api` are documented targets. | VERIFIED FROM DOCUMENTATION, deployment NOT VERIFIED |
| Production target | `https://mission-control.thegrowthgroup.com` and `https://api-mission-control.thegrowthgroup.com/api` are documented targets. | VERIFIED FROM DOCUMENTATION, deployment NOT VERIFIED |
| Domain conflict | Older go-live/reference docs and frontend production defaults still mention clinic-facing hosts such as `crm.clinicgrower.co.uk`; newer domain docs and backend production checks reject those hosts. | VERIFIED FROM DOCUMENTATION / CONFIGURATION GAP |
| Secret storage | Repo requires real secrets in host secret manager or approved vault, with only examples tracked. | VERIFIED FROM DOCUMENTATION / CONFIGURATION |
| Vault selection | A specific managed vault/provider is not proven in repo. | EXTERNAL / NOT VERIFIED |
| Backups | Backup/restore scripts and encrypted backup workflow exist. The scheduled workflow is gated by `BACKUP_WORKFLOW_ENABLED=true`. | REPO-PREPARED; production run NOT VERIFIED |
| Rollback | Signed release manifest, verification, rollback rehearsal tooling and workflow exist. | REPO-PREPARED; actual staging rollback NOT VERIFIED |
| Monitoring | Observability hooks and uptime workflow exist. Alert destination is external configuration. | REPO-PREPARED; live alert delivery NOT VERIFIED |
| Deployment | GitHub release promotion workflow can build, migrate, sign, rehearse rollback and call a deployment webhook. | REPO-PREPARED; hosting webhook NOT VERIFIED |
| Staging demonstration date | No repository evidence of a scheduled or completed staging demonstration date was found in this audit. | UNKNOWN |

## P0 Parent Gap Assessment

### Completed by `9dc6e4f`

- Secured `/api/v1` read endpoints.
- Secured `/mcp` read-only JSON-RPC endpoint.
- Dedicated `mission_control_api:read` and `mission_control_mcp:read` permissions.
- Tenant-scoped search/fetch for contact, client account, proposal, task and opportunity.
- Response envelopes with request ID and generated timestamp.
- Read-only MCP tool hints and no supported write tools.
- Focused backend test coverage for auth, permission, tenant isolation and search/fetch behaviour.

### Completed by this P0.1 audit work

- Durable current-state technical evidence pack in `docs/`.
- Explicit data-state/provenance matrix.
- Explicit integration and operations classification.
- Explicit documented/config conflict list.
- Additional focused MCP read-only/security assertions in `backend/src/test/test-mission-control-api.ts`.

### Still required before reviewer acceptance

| Gap | Status | Owner/action |
| --- | --- | --- |
| Confirm actual staging and production URLs are deployed and reachable | EXTERNAL / NOT VERIFIED | Deployment owner to provide target evidence |
| Confirm hosting provider/deployment webhook is configured | EXTERNAL / NOT VERIFIED | Deployment owner |
| Confirm managed vault/provider and production secret placement | EXTERNAL / NOT VERIFIED | Security/deployment owner |
| Confirm production backup has run and restore rehearsal evidence exists | EXTERNAL / NOT VERIFIED | Production owner |
| Confirm monitoring account and alert destination receive real staging proof alerts | EXTERNAL / NOT VERIFIED | Monitoring owner |
| Confirm live ClickUp workspace/API actor/access governance | EXTERNAL / NOT VERIFIED | ClickUp workspace owner |
| Confirm live provider data states for Google, Twilio/WhatsApp, email, QuickBooks, Stripe and OpenAI | EXTERNAL / NOT VERIFIED | Provider owners |
| Resolve current Mission Control domain conflict between old clinic-facing docs/defaults and newer Mission Control domain requirements | PARTIAL | Engineering/deployment owner to decide whether old references are historical only or need cleanup |
| Staging demonstration date | UNKNOWN | Michael/business owner to schedule/confirm |

## Acceptance Criteria Breakdown

| Requirement | Result | Evidence | Remaining |
| --- | --- | --- | --- |
| Authoritative frontend/backend repositories and branches | COMPLETE | Root repo, remote, branch, package files | None repo-side |
| Architecture and current data model | COMPLETE | This pack, `docs/mission-control-data-model.md`, `backend/db.sql` | Reviewer validation |
| Database, hosting, environments and production/staging URLs | PARTIAL | Env templates and docs verify targets | Actual deployed URLs/hosting external |
| Existing API routes, services and data model | COMPLETE | `backend/src/app.ts`, route modules, this pack | None repo-side |
| Authentication, roles, tenants and permission enforcement | COMPLETE | Middleware, permission tables, tests | Target-environment smoke external |
| Webhooks and integrations | PARTIAL | Integration routes/docs/migrations | Live provider setup external |
| Deployment, secret-storage references, backups and rollback method | PARTIAL | Workflows and docs | Vault, backup run, restore rehearsal, deployment webhook external |
| Live/cached/manual/estimated/demo data classification | COMPLETE repo-side | This pack plus data-state docs/components | Live source verification external |
| Gap assessment against parent API/MCP task | COMPLETE | This pack | Reviewer acceptance |
| Implementation plan and evidenced blockers | COMPLETE | Gap register above | External owners need to act |
| Attach links/screenshots/evidence | PARTIAL | Repo docs/tests/commit evidence | ClickUp attachments are manual; screenshots not created by this audit |
| Staging demonstration date where known | NOT VERIFIED | No repo evidence found | Business/deployment owner to provide |
| Michael accountable, Haile validates technical facts | PARTIAL | User/task brief only | ClickUp/reviewer confirmation external |
| Never record secret values | COMPLETE | No secret values added; docs use variable names only | Ongoing discipline |

## Validation Plan

Recommended commands for this audit work:

```powershell
cd backend
npm.cmd run db:migrate
npm.cmd run build
npm.cmd run test:mission-control-api
npm.cmd run test:tenant-isolation
npm.cmd run test:clickup

cd ..\frontend
npm.cmd run typecheck
npm.cmd run lint

cd ..
git diff --check
```

## ClickUp Evidence Note

Do not write to ClickUp from this repository audit. Suggested manual evidence should reference only pushed commits and portable validation results, not local temp paths.
