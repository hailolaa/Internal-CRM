# Mission Control Domain, Login and Session Architecture

## Status

Ready for review. Production approval and DNS/hosting changes remain with the deployment owner.

## Scope

This note covers the Mission Control production-domain, login, redirect, session and tenant-isolation boundary for the internal CRM. It should be read with:

- `docs/mission-control-environments.md`
- `docs/mission-control-data-isolation.md`
- `docs/tenant-isolation-verification.md`
- `docs/release-promotion-and-rollback.md`
- `docs/secret-management-and-rotation.md`

## Approved Domain Boundary

Mission Control must run on The Growth Group internal Mission Control domains, not the clinic-facing ClinicGrower domains.

Staging:

- Frontend: `https://mission-control-staging.thegrowthgroup.com`
- API: `https://api-mission-control-staging.thegrowthgroup.com/api`
- OAuth callback base: `https://api-mission-control-staging.thegrowthgroup.com/api/auth`

Production:

- Frontend: `https://mission-control.thegrowthgroup.com`
- API: `https://api-mission-control.thegrowthgroup.com/api`
- OAuth callback base: `https://api-mission-control.thegrowthgroup.com/api/auth`

The backend production configuration check rejects `FRONTEND_URL`, `API_PUBLIC_URL`, `OAUTH_CALLBACK_BASE_URL` and `CORS_ORIGINS` when they point at known clinic-facing hosts such as `clinicgrower.ai`, `clinicgrower.co.uk` or `crm.clinicgrower.co.uk`.

## Login and Session Boundary

Mission Control authentication is backend-owned. The frontend stores and sends the authenticated session token, but tenant and permission decisions are enforced by backend middleware and service-layer scoping.

Required controls:

- `JWT_SECRET` is a dedicated Mission Control secret and must not match `CREDENTIAL_ENCRYPTION_KEY`.
- Non-local environments require a strong `JWT_SECRET`, database password, credential encryption key and ClinicGrower event signing secret.
- OAuth redirects must use the environment-specific Mission Control API callback base.
- CORS must allow only the matching Mission Control frontend origin for the environment.
- Google Workspace auto-provisioning requires an approved allowed-domain list and explicit target workspace.
- Real secrets live in the host secret manager or approved vault, never in Git or ClickUp.

## Tenant Isolation

The authenticated backend request context supplies the active workspace, stored as `clinic_id`. API handlers and services must derive tenant scope from that context rather than trusting request bodies or arbitrary query parameters.

Allowed management/all-client views must clearly label the client/workspace identity and data state. Routine workspace users must only see their scoped workspace records.

Automated isolation evidence includes:

- tenant A cannot read tenant B contact detail
- tenant A contact search/export omits tenant B data
- fleet registry and source rows are workspace scoped
- analytics facts are workspace scoped
- all-client sync health labels client/workspace identity explicitly

## Redirect and CORS Rules

The frontend and backend environment variables must be paired by environment:

- `FRONTEND_URL`
- `API_PUBLIC_URL`
- `OAUTH_CALLBACK_BASE_URL`
- `CORS_ORIGINS`
- `NEXT_PUBLIC_API_BASE_URL`
- `NEXT_PUBLIC_APP_URL`

Do not mix staging frontend with production API, or Mission Control frontend with clinic-facing API. A mixed-domain deploy should be treated as a failed release gate.

## Threat Checks

Before production approval, verify:

- session tokens cannot be accepted across tenant boundaries
- CORS rejects unapproved origins
- OAuth callback URLs resolve to the expected environment
- unauthenticated users are rejected by protected API routes
- workspace users cannot pass another `clinic_id` to access foreign records
- admin/all-client views are permission-gated and labelled
- demo, preview and roadmap data states are visibly distinct from live data
- no browser-visible `NEXT_PUBLIC_*` value contains server secrets
- release and rollback artifacts identify the exact deployed revision

## Rollback

Rollback uses the existing release-promotion process:

1. Promote a signed release manifest that records frontend/backend revision and migration state.
2. Keep the previous known-good application revision available.
3. Take a database backup before production promotion.
4. If domain/session deployment fails, redeploy the previous revision and restore DNS/hosting environment variables to the previous known-good values.
5. Restore database only when the deployment owner confirms it is safer than fixing forward.
6. Verify backend health, frontend login and tenant-isolation smoke checks after rollback.

## External Approval Boundary

Engineering can provide the repo-side guards, tests and documentation. Production completion still requires:

- DNS/hosting owner to configure the final domains
- deployment owner to configure environment variables in the host secret manager
- reviewer to run target-environment login/session/tenant smoke checks
- business approval for production activation

Until those actions are complete, the repo-side state is ready for review rather than production verified.
