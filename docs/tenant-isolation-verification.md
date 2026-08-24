# Tenant Isolation Verification

## Status

Ready for review.

## Scope

This note covers the current Mission Control tenant-isolation evidence for the Performance OS pilot gate. It should be read with:

- `docs/adr/0001-tenancy-and-workspace-boundaries.md`
- `docs/mission-control-data-isolation.md`
- Clinic OS ADR `docs/adr/0001-tenancy-data-boundaries.md` in the clinic-facing repositories

## Isolation Approach

Mission Control uses application-level row scoping. The authenticated session carries the active workspace ID, stored physically as `clinic_id`. Authenticated API handlers derive `clinic_id` from the token/session context and pass it into service-layer queries. Request bodies and query strings are not trusted to choose a workspace unless the endpoint first proves the caller may act for that workspace.

Clinic OS follows the same application-level clinic-tenant model for patient-facing operational data. Cross-system sharing uses explicit integration identifiers and approved summary contracts, not unrestricted table sharing.

Database-level row security is not the current approach. The accepted architecture is application-level scoping with tests around high-risk read, write, export, webhook and integration flows.

## Automated Evidence

Mission Control now includes a consolidated tenant-isolation penetration test:

- `backend/src/test/test-tenant-isolation.ts`

It verifies:

- tenant A cannot read tenant B contact detail through the authenticated API
- tenant A contact list searches do not return tenant B records
- tenant A CSV exports do not contain tenant B records
- new tenant provisioning creates a distinct fleet tenant registry row
- fleet source records remain scoped by workspace
- analytics facts remain scoped by workspace
- management/all-client sync health output is explicitly labelled with client/workspace identity

Additional module coverage already exists for tenant-scoped flows, including client accounts, report exports, fleet ingestion, analytics store, pilot data-feed erasure, proposals, growth briefs, command palette search, integrations, internal delivery tasks and data-state safety.

## Manual Penetration Test Procedure

Use controlled non-production users only.

1. Create two test workspaces, tenant A and tenant B.
2. Create a lead/contact in tenant B.
3. Authenticate as tenant A.
4. Attempt to open tenant B contact detail by direct API URL.
5. Search tenant A contacts using tenant B's email/phone.
6. Export tenant A contacts and leads.
7. Confirm tenant B record data is absent from detail, list and export responses.
8. Register fleet ingestion sources for both tenants with the same source key and different tenant keys.
9. Record analytics facts for both tenants.
10. Confirm scoped health/fact queries show only the active tenant unless an explicitly authorized all-client management scope is used.

Expected result: detail access returns not found, list/export surfaces omit tenant B data, and all-client administration views identify each tenant clearly.

## New Tenant Provisioning Evidence

The provisioning test creates fresh workspaces through the test fixture and then configures fleet ingestion for each workspace. The expected isolated artifacts are:

- a distinct `clinic` row
- an active user membership for that workspace
- a distinct `fleet_tenant_registry` row
- source rows keyed by `clinic_id`
- analytics facts keyed by `clinic_id`

The test confirms records created for one workspace do not appear in scoped reads for the other.

## Remaining Operational Review

Engineering evidence is ready for review. Production/staging sign-off still requires a reviewer or deployment owner to run the same procedure against the intended target environment with approved pilot data.
