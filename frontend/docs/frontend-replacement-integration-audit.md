# Frontend Replacement Integration Audit

Last audited: 2026-06-10

Use this checklist when replacing the current frontend with the new Sintra export/build. The current UI is not just static screens; it is wired to the backend through shared auth, tenant context, API clients, route-level hooks, and static export deployment.

## Build And Runtime Shape

- Framework: Next.js 16, React 19, TypeScript.
- Deployment output: static export via `next.config.ts` with `output: "export"` and `trailingSlash: true`.
- Production deploy target observed on VPS: `~/apps/frontend`, served as static files.
- Main scripts:
  - `npm run build`
  - `npm run typecheck`
  - `npm run lint`
  - `npm test`
- Required public env:
  - `NEXT_PUBLIC_API_BASE_URL`, normally `https://clinicgrower.ai/api`
  - `NEXT_PUBLIC_APP_URL`, normally `https://clinicgrower.ai`
  - `NEXT_PUBLIC_LOGO_URL`
  - `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`

## Global Providers And Shell

The authenticated app is wrapped by `app/app/layout.tsx`:

- `AppProviders` from `lib/providers.tsx`
- `AuthenticatedAppShell` from `components/authenticated-app-shell.tsx`

Provider order matters:

1. `ThemeProvider`
2. `AuthProvider`
3. `TenantProvider`
4. `EventBusProvider`
5. `AuditProvider`
6. `WebhookProvider`
7. `ToastProvider`

The app shell currently provides:

- Auth guard and session refresh
- Sidebar navigation
- Top bar title
- Tenant switcher and tenant badge
- Theme toggle
- Logout action

If the new frontend replaces the shell, it must still mount `AppProviders` around authenticated pages or reimplement equivalent auth/tenant/toast behavior.

## Auth And Tenant Wiring

Core files:

- `lib/api-client/core.ts`
- `lib/api-client.ts`
- `lib/api-client/auth-session.ts`
- `lib/auth-context/provider.tsx`
- `lib/tenant-context.tsx`
- `hooks/data/use-authenticated-query.ts`

Storage key:

- `clinic_grower_auth`

Session behavior:

- Auth tokens are stored in `localStorage` when remember-me is true, otherwise `sessionStorage`.
- API requests send `Authorization: Bearer <token>`.
- `apiRequest` automatically retries once after a 401 by calling `api.auth.refresh`.
- `AuthProvider` refreshes the stored session on app mount.
- `TenantProvider` calls `api.auth.getClinics(token)` and supports `auth.switchClinic(clinicId)`.

Auth endpoints used by the frontend include:

- login
- signup/register clinic
- verify 2FA
- refresh token
- logout
- forgot/reset password
- verify email/resend verification
- OAuth callback/session storage
- clinic membership list
- clinic switching

## API Client Surface

All backend calls go through `lib/api-client.ts`, which composes modules under `lib/api-client/*-api.ts`.

Current API modules to preserve or rewire:

- `account-api.ts`
- `ai-api.ts`
- `appointments-api.ts`
- `auth-api.ts`
- `automations-api.ts`
- `billing-security-api.ts`
- `catalog-api.ts`
- `clinic-setup-api.ts`
- `comms-calls-api.ts`
- `competitors-api.ts`
- `compliance-api.ts`
- `consults-api.ts`
- `contacts-api.ts`
- `developer-settings-api.ts`
- `forms-api.ts`
- `growth-api.ts`
- `health-audit-api.ts`
- `insights-api.ts`
- `internal-ops-api.ts`
- `locations-integrations-api.ts`
- `marketing-api.ts`
- `monthly-action-plans-api.ts`
- `operations-api.ts`
- `ops-logs-api.ts`
- `pipeline-api.ts`
- `profile-settings-api.ts`
- `reports-ops-api.ts`
- `revenue-api.ts`
- `sequences-api.ts`
- `sla-api.ts`
- `team-api.ts`
- `workflows-api.ts`

Important recently added call endpoints:

- `GET /api/calls`
- `PATCH /api/calls/:id`
- `POST /api/calls/:id/generate-intelligence`
- `POST /api/calls/:id/transcribe`
- `GET /api/calls/summary`
- `GET /api/metrics/calls/staff`

## Live Page Hook Map

These pages currently depend on live backend hooks/API calls and should not become static-only in the replacement.

- `/login`: `useLoginPage`, auth login, 2FA, OAuth URL.
- `/signup`: `SignupContent`, register clinic, invite acceptance, OAuth signup, billing handoff.
- `/forgot-password`: forgot password.
- `/reset-password`: reset password.
- `/verify-email`: verify/resend email.
- `/oauth/callback`: stores OAuth session from callback params.
- `/reports/shared`: public report share token read.

Authenticated pages:

- `/app`: dashboard shell/home content.
- `/app/revenue`: live dashboard summary, funnel, channel/treatment revenue, leakage, opportunities.
- `/app/leakage`: leakage details, insights generation/status/task handoff.
- `/app/action-plan`: monthly action plan read/generate/update.
- `/app/reports/overview`: report list, dashboard summaries, monthly generation.
- `/app/reports/detail`: report detail, sharing, workflow status.
- `/app/reports/leads`: dashboard summary/funnel/channel/treatment.
- `/app/reports/ads`: ROAS and campaign metrics.
- `/app/reports/noshows`: appointments plus leakage metrics.
- `/app/leads`: contacts list, linked activity, update linked calls.
- `/app/crm/contacts`: contact list/search/filter/actions.
- `/app/crm/contacts/import`: import, import history, duplicate candidates.
- `/app/crm/contacts/new`: create contact.
- `/app/crm/calendar`: appointments, tasks, appointment status actions.
- `/app/crm/calendar/new`: contacts, treatments, clinicians, availability, create appointment.
- `/app/crm/pipeline`: stages, deals, move deal.
- `/app/crm/pipeline/settings`: stage CRUD.
- `/app/crm/tasks`: task list/update.
- `/app/crm/tasks/new`: contacts, clinicians, create task.
- `/app/crm/forms`: form definitions.
- `/app/crm/forms/builder`: create/update form.
- `/app/crm/forms/submissions`: form submissions.
- `/app/comms/calls`: call list/update/generate intelligence/transcribe/staff metrics.
- `/app/comms/inbox`: inbox conversations.
- `/app/comms/sequences`: sequence list/update.
- `/app/comms/sequences/new`: create sequence.
- `/app/comms/templates`: template list/update.
- `/app/comms/templates/new`: create template.
- `/app/consults`: consult list/summary/practitioner conversion.
- `/app/manual-consult`: consult CRUD.
- `/app/manual-spend`: spend CRUD.
- `/app/deposits`: deposits list/update.
- `/app/treatment-plans`: treatment plan list/create/update.
- `/app/treatment-performance`: treatments, treatment plans, treatment revenue.
- `/app/sla`: SLA summary/leads/breaches/mark contacted.
- `/app/integrations`: integrations list/connect/update.
- `/app/marketing/campaigns`: campaign list/status.
- `/app/marketing/campaigns/new`: create campaign.
- `/app/marketing/offers`: offer list/create/update/delete.
- `/app/marketing/offers/new`: create offer.
- `/app/marketing/reviews`: review list/status.
- `/app/ops/client-accounts`: client profile, account summaries, services, internal tasks, strategy logs, team.
- `/app/ops/team`: team list/invite/remove/resend/cancel/update role.
- `/app/ops/team/invite`: invite form.
- `/app/ops/roles`: role list.
- `/app/ops/sops`: SOP list/create/update/delete.
- `/app/ops/automations`: automation list/create/update/delete.
- `/app/background-jobs`: jobs list/status update.
- `/app/duplicates`: duplicate candidates/status.
- `/app/webhooks`: webhook endpoints list/create/update/delete.
- `/app/audit-log` and `/app/events`: audit log list.
- `/app/settings/*`: clinic profile, billing, API keys, preferences, security, team, treatments, locations, compliance.
- `/app/ai/projects`: AI project list/create/update.
- `/app/ai/runs`: AI run list.
- AI tool/agent pages: create AI runs where wired.

## Common UI Contracts To Preserve

- Loading states from `useAuthenticatedQuery`.
- Error/toast handling through `useToast`.
- Tenant switching in top bar for multi-clinic accounts.
- Auth guard before rendering `/app/*`.
- All protected API calls must include `session.token`.
- Public shared report route must work without auth.
- Stripe embedded checkout requires `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Static export route paths require trailing slash compatibility.

## Replacement Checklist

When the Sintra build lands:

1. Keep or re-add `next.config.ts` static export settings unless deployment changes.
2. Keep `lib/env.ts`, `lib/api-client.ts`, `lib/api-client/*`, `lib/api-types/*`, auth context, tenant context, and provider stack unless intentionally replacing them.
3. Ensure `/app/*` routes are wrapped in auth and tenant providers.
4. Reconnect live pages to existing hooks or port hooks into the new UI components.
5. Reconnect tenant switcher and active clinic state.
6. Reconnect login/signup/forgot/reset/verify/OAuth flows.
7. Reconnect call intelligence/transcription actions on the calls page.
8. Reconnect report sharing/public report route.
9. Run `npm run typecheck`, `npm run lint`, `npm run build`, and targeted browser verification before deploy.

