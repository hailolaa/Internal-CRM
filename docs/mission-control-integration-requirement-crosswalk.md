# Mission Control Integration Requirement Crosswalk

Last updated: 2 September 2026

This note maps the retained integration-lifecycle requirements before the
legacy wrapper task is closed. It is an evidence artifact for `869er9bne` -
`[Mission Control] Map legacy integration requirements to governed tasks`.

It does not approve provider activation, credential storage, production
connection, paid provider spend, permission widening or closure of the legacy
task.

## Task Boundaries

Legacy wrapper: `869efyy2r` - `[LEGACY - use governed CG integration tasks]
Build complete integration lifecycle for marketing, CRM, Twilio and
QuickBooks`.

Active governed sources:

- `869er9bne` - integration crosswalk and retained-requirement mapping.
- `869efapy1` - `CG-079`: per-client sync health and exception
  administration, including freshness, retry, dead-letter, reconciliation and
  data-state labelling.
- `869egfgtp` - `CG-160`: first-class client operating register, canonical
  client identity, operating state and import provenance.
- `869efatbn` - `CG-066`: ClickUp OAuth/API lifecycle, client/task identity
  mapping, webhook intake, reconciliation and controlled writes.
- `869emyqnp` - `P0.2`: Mission Control REST API v1 and universal search.
- `869emyqnw` - `P0.3`: authenticated read-only MCP server and core tools.
- `869eeeq2b` - `2.6`: one lead-ingestion path from every supported source.
- `869eeeq2j` - `CG-2.7`: Clinic OS alpha sync source and Mission Control
  receiver contract.
- `869eamkyc` - missed-call tracking and recovery across Clinic OS and Mission
  Control.
- `869ehypp3` - service agreement / contract bridge, including QuickBooks
  staging after approval, signature and payment gates.

Legacy task `869efyy2r` is not ongoing build authority. It remains a wrapper to
be closed only after this mapping is accepted and any DATA GAP rows are either
assigned to governed tasks or explicitly accepted as external gates.

## Boundary Decisions

- Mission Control owns governed roll-up, connection status, freshness,
  exception administration, client/source mapping, read APIs and auditability.
- Clinic OS owns clinic-facing source events and source-side sync where the
  provider event originates in Clinic OS.
- Provider consoles own real OAuth consent, account access, paid-plan
  eligibility, production credentials, scopes, webhooks and real-account test
  evidence.
- ClickUp owns task governance and reviewer/business acceptance where a source
  requires follow-up work.
- Credentials, tokens, recovery codes, raw provider payloads and secrets must
  not be stored in documentation, ClickUp comments, frontend code or browser
  evidence.
- A UI status alone is not evidence that a provider connection is live.

## Retained Lifecycle Requirement Mapping

| Legacy requirement | Governed task / surface | Current implementation or evidence location | Status | Remaining dependency |
|---|---|---|---|---|
| OAuth or secure authentication flow | Provider-specific implementation task, `869efatbn` for ClickUp, `869ehypp3` for QuickBooks bridge, `869eamkyc` for signed call intake | `docs/provider-access-readiness-matrix.md`, `docs/clickup-delivery-integration.md`, provider modules under `backend/src/modules/*` | Partial | DATA GAP for source-specific GA4, Google Ads, Search Console, GBP, Meta and clinic CRM/booking OAuth acceptance tasks |
| Server-side encrypted credential storage | `869efatbn`, CG-018/CG-019 security hardening, provider readiness matrix | `docs/secret-management-and-rotation.md`, `docs/secret-inventory.md`, `backend/src/utils/provider-credentials.ts` | Partial | Provider-owner approval and production secret manager evidence |
| Token refresh mechanism | Provider-specific implementation task; ClickUp notes token behaviour; QuickBooks OAuth tests cover accounting refresh flow where enabled | `docs/clickup-delivery-integration.md`, `backend/src/test/test-quickbooks-oauth.ts`, provider config docs | Partial | DATA GAP for GA4, Ads, GSC, GBP, Meta and CRM/booking refresh acceptance |
| Reauthorisation after token expiry/revocation | Provider-specific implementation task and sync-health exception model | `docs/fleet-sync-health-exception-administration.md`, `frontend/app/app/integrations/sync-health/page.tsx` | Partial | Provider-specific reauth UX/evidence required before live acceptance |
| Scheduled data ingestion pipeline | Fleet ingestion / analytics source model and source-specific ingestion tasks | `docs/unified-data-model.md`, `backend/src/modules/fleet-ingestion/*`, `backend/src/modules/analytics-store/*` | Partial | DATA GAP for every provider without a source-specific scheduled pull task and real-account evidence |
| Historical backfill | Fleet ingestion / source-specific import or sync tasks | `docs/unified-data-model.md`, import/backfill docs where present | Partial | 90-day real-account backfill evidence is external/provider-gated for MVP sources |
| Data freshness monitoring | `869efapy1` CG-079 | `docs/fleet-sync-health-exception-administration.md`, `frontend/app/app/integrations/sync-health/page.tsx`, `backend/src/test/test-fleet-ingestion.ts` | Mapped | Target-environment provider freshness evidence pending |
| Account and client matching | `869egfgtp` CG-160, `869efatbn` CG-066, `869eeeq2j` CG-2.7 | `docs/client-operating-register-import.md`, `docs/clickup-delivery-integration.md`, `backend/src/modules/client-accounts/*` | Mapped | Real provider account-to-client mapping evidence pending |
| API failures, rate limits and partial data | `869efapy1` CG-079 plus provider readiness matrix | `docs/fleet-sync-health-exception-administration.md`, `docs/provider-access-readiness-matrix.md` | Mapped | Real provider failure evidence and rate-limit policy per provider |
| Connection-health dashboard indicator | `869efapy1` CG-079 and integrations UI | `frontend/app/app/integrations/sync-health/page.tsx`, `frontend/app/app/integrations/page.tsx` | Mapped | Target-environment evidence pending |
| Missing-data warnings | `869efapy1` CG-079 | `docs/fleet-sync-health-exception-administration.md`, `backend/src/modules/fleet-ingestion/*` | Mapped | Real missing-data simulation per provider before acceptance |
| Real client account testing | Provider-specific acceptance tasks and provider access matrix | `docs/provider-access-readiness-matrix.md` | External | Max/provider owners must provide approved real or pilot account evidence |
| Synthetic/placeholder data removal before pilot | Data-state controls and provider readiness matrix | `docs/mission-control-data-isolation.md`, `docs/provider-access-readiness-matrix.md`, data-state UI/tests | Mapped | Staging/pilot verification required before operational GO |
| End-to-end test and rollback requirement per integration | Release controls, CG-079 exception replay, source-specific provider tasks | `docs/release-promotion-and-rollback.md`, `docs/fleet-sync-health-exception-administration.md` | Partial | DATA GAP for source-specific E2E/rollback acceptance evidence where no provider task exists |

## Source Coverage

| Source | Current governed destination | System owner | Current evidence | Acceptance state |
|---|---|---|---|---|
| GA4 | `869efapy1` sync health, `869egfgtp` client identity, DATA GAP for source-specific OAuth/ingestion/backfill | Mission Control plus provider owner | Provider access matrix, unified data model | Partial/provider-gated |
| Google Ads | `869efapy1`, `869egfgtp`, DATA GAP for source-specific OAuth/ingestion/backfill | Mission Control plus provider owner | Provider access matrix, attribution/reporting UI references | Partial/provider-gated |
| Google Search Console | `869efapy1`, `869egfgtp`, DATA GAP for source-specific OAuth/ingestion/backfill | Mission Control plus provider owner | Provider access matrix, unified data model | Partial/provider-gated |
| Google Business Profile | `869efapy1`, `869egfgtp`, DATA GAP for source-specific OAuth/ingestion/backfill | Mission Control plus provider owner | Provider access matrix, reviews/readiness UI references | Partial/provider-gated |
| Meta Ads / Lead Forms | `869eeeq2b` lead-ingestion proof, `869efapy1`, DATA GAP for full ads insight sync | Mission Control plus provider owner | Provider access matrix, lead-ingestion contract | Partial/provider-gated |
| Clinic CRM / booking | `869eeeq2j` Clinic OS alpha sync, `869eeeq2b` ingestion proof, `869egfgtp` client identity | Clinic OS source-side and Mission Control receiver | Unified lead ingestion contract, Clinic OS alpha sync commits/evidence | Partial; real pilot E2E evidence pending |
| Twilio / call tracking | `869eamkyc` missed-call recovery, `869efapy1` sync health | Clinic OS source-side and Mission Control receiver | Missed-call recovery docs/tests and Twilio setup docs | Repo-side mapped; provider credentials/test-number evidence pending |
| QuickBooks | `869ehypp3` service agreement bridge and QuickBooks staging controls, finance summary/data-gap task where required | Mission Control plus finance/provider owner | Service agreement journey, QuickBooks OAuth tests, provider matrix | Future/provider-gated; production finance scope needs Max approval |

## DATA GAP Register

The legacy wrapper names CG-075 and CG-071, but CG-075 is not present in the
live task sequence available to this audit. The following missing or
provider-gated work must not be hidden by closing `869efyy2r`:

| Gap | Affected sources | Required governed destination |
|---|---|---|
| Source-specific OAuth, scope and refresh acceptance tasks | GA4, Google Ads, Search Console, GBP, Meta Ads, clinic CRM/booking | Create or link governed provider tasks before live acceptance |
| 90-day historical backfill proof from real pilot accounts | GA4, Google Ads, Search Console and every source claiming historical metrics | Source-specific acceptance evidence or provider task |
| Real-account freshness and missing-data warning evidence | All live providers | CG-079 plus source-specific provider evidence |
| E2E failure, retry and rollback proof per provider | All live providers | CG-079/release controls plus source-specific provider task |
| Provider credential owner and approved storage evidence | All paid or external providers | Provider readiness matrix plus owner evidence |
| Synthetic/placeholder removal proof before pilot | All pilot-facing dashboards | Data-state verification and target-environment review |

## Claimed Complete vs Accepted Complete

Claimed complete means engineering has implemented or mapped a source,
connector, UI or test locally or in the repository.

Accepted complete means the relevant governed task has evidence for the source,
the correct tenant/client mapping, real or approved pilot provider data, failure
handling, freshness, rollback and reviewer acceptance. Production acceptance
also requires approved credentials and target-environment evidence.

## Acceptance Gate Before Closing `869efyy2r`

The legacy wrapper can be closed only after:

1. This crosswalk is accepted for `869er9bne`.
2. Every DATA GAP row is linked to a governed task or explicitly accepted as an
   external gate.
3. Provider owners have supplied no-secret evidence for credentials, scopes,
   real/pilot account access and testing where required.
4. Max approves any paid provider, production credential or system-of-record
   change.
5. No active requirement still uses `869efyy2r` as build authority.

## Review Format

For review, show:

1. What changed: the legacy integration lifecycle is mapped into governed
   Mission Control, Clinic OS, provider-readiness and source-specific tasks.
2. Evidence: this crosswalk, source rows, current implementation surfaces and
   validation test.
3. Blockers and owners: provider owners own live credentials/account evidence;
   engineering owns source-specific repo work where a governed task exists;
   Max owns paid provider, production credential and system-of-record decisions.
4. One next bounded milestone: accept this crosswalk, create/link the DATA GAP
   tasks, then retire `869efyy2r`.
5. Max decision required: only for paid provider, production credential or
   system-of-record changes.
